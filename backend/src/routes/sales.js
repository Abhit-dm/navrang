const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { generateCustomerCode, generateSaleNumber, generateInvoiceNumber, generateWarrantyCode } = require('../utils/codes');
const { round2, percentOf } = require('../utils/money');
const { reduceStock } = require('../utils/stock');
const { isValidPaymentMethod, invoiceStatus, withStatus, parseDate } = require('../utils/status');
const { cancelSale } = require('../utils/saleCancel');

const router = express.Router();
router.use(authenticate);

const SALE_INCLUDE = {
  customer: true,
  vehicle: true,
  employee: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { product: true } },
  invoice: { include: { payments: true } },
};

const bad = (res, message) => res.status(400).json({ error: 'Bad Request', message });

function withDisplay(sale) {
  const inv = sale.invoice;
  const total = inv ? inv.grandTotal : sale.total;
  const paid = inv ? inv.paidAmount : 0;
  return {
    ...sale,
    amountPaid: paid,
    balance: round2(total - paid),
    paymentStatus: sale.status === 'CANCELLED' ? 'CANCELLED' : inv ? invoiceStatus(inv) : 'PENDING',
  };
}

function rangeFor(range, from, to) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 3600 * 1000 - 1);
  if (range === 'today') return { gte: start, lte: end };
  if (range === 'week') {
    const s = new Date(start);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return { gte: s, lte: end };
  }
  if (range === 'month') return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: end };
  if (range === 'year') return { gte: new Date(now.getFullYear(), 0, 1), lte: end };
  if (range === 'custom') {
    const f = parseDate(from);
    const t = parseDate(to);
    if (f === undefined || t === undefined) return undefined;
    const r = {};
    if (f) r.gte = f;
    if (t) r.lte = new Date(t.getTime() + 24 * 3600 * 1000 - 1);
    return r;
  }
  return {};
}

router.get('/', async (req, res) => {
  const { search, from, to, customerId, paymentStatus, status } = req.query;
  const where = {};
  if (customerId) where.customerId = Number(customerId);
  if (status) where.status = status;
  const dates = rangeFor(from || to ? 'custom' : '', from, to);
  if (dates === undefined) return bad(res, 'Invalid date filter.');
  if (dates.gte || dates.lte) where.saleDate = dates;
  if (search) {
    where.OR = [
      { saleNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
      { vehicle: { vehicleNumber: { contains: search } } },
    ];
  }
  const sales = await prisma.sale.findMany({ where, include: SALE_INCLUDE, orderBy: { saleDate: 'desc' } });
  let result = sales.map(withDisplay);
  if (paymentStatus) result = result.filter((s) => s.paymentStatus === paymentStatus);
  res.json(result);
});

router.get('/summary', async (req, res) => {
  const { range = 'month', from, to } = req.query;
  const dates = rangeFor(range, from, to);
  if (dates === undefined) return bad(res, 'Invalid date range.');

  const inRange = await prisma.sale.findMany({
    where: { status: 'ACTIVE', ...(dates.gte || dates.lte ? { saleDate: dates } : {}) },
    include: { invoice: true },
  });
  const today = await prisma.sale.findMany({ where: { status: 'ACTIVE', saleDate: rangeFor('today') } });

  const counts = { PAID: 0, 'PARTIALLY PAID': 0, PENDING: 0, OVERDUE: 0 };
  let outstanding = 0;
  let received = 0;
  for (const s of inRange) {
    const st = s.invoice ? invoiceStatus(s.invoice) : 'PENDING';
    if (counts[st] !== undefined) counts[st] += 1;
    if (s.invoice) { outstanding += s.invoice.dueAmount; received += s.invoice.paidAmount; }
  }

  const daily = {};
  for (const s of inRange) {
    const k = new Date(s.saleDate).toISOString().slice(0, 10);
    daily[k] = daily[k] || { date: k, sales: 0, revenue: 0 };
    daily[k].sales += 1;
    daily[k].revenue = round2(daily[k].revenue + s.total);
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearSales = await prisma.sale.findMany({ where: { status: 'ACTIVE', saleDate: { gte: yearStart } }, select: { saleDate: true, total: true } });
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: new Date(yearStart.getFullYear(), i, 1).toLocaleString('en-IN', { month: 'short' }), sales: 0, revenue: 0 }));
  for (const s of yearSales) {
    const m = new Date(s.saleDate).getMonth();
    monthly[m].sales += 1;
    monthly[m].revenue = round2(monthly[m].revenue + s.total);
  }

  res.json({
    todaySales: today.length,
    todayRevenue: round2(today.reduce((a, s) => a + s.total, 0)),
    totalSales: inRange.length,
    totalRevenue: round2(inRange.reduce((a, s) => a + s.total, 0)),
    paid: counts.PAID,
    partiallyPaid: counts['PARTIALLY PAID'],
    pending: counts.PENDING,
    overdue: counts.OVERDUE,
    amountReceived: round2(received),
    outstanding: round2(outstanding),
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    monthly,
  });
});

router.get('/:id', async (req, res) => {
  const sale = await prisma.sale.findUnique({ where: { id: Number(req.params.id) }, include: SALE_INCLUDE });
  if (!sale) return res.status(404).json({ error: 'Not Found', message: 'Sale not found' });
  res.json(withDisplay(sale));
});

// Core billing endpoint: create sale + invoice + reduce stock + create warranty + record payment
router.post('/', async (req, res, next) => {
  try {
    const {
      customerId,
      customer: customerDetails,
      vehicleId: requestedVehicleId,
      vehicle: vehicleDetails,
      items,
      discount,
      isGst,
      paymentMethod,
      paidAmount,
      paymentReference,
      paymentDate,
      saleDate,
      dueDate,
      notes,
    } = req.body;

    const customerName = String(customerDetails?.name || '').trim();
    const customerPhone = String(customerDetails?.phone || '').trim();
    if ((!customerId && (!customerName || !customerPhone)) || !Array.isArray(items) || items.length === 0) {
      return bad(res, 'Customer name, mobile number, and at least one product item are required.');
    }
    if (customerDetails && (!customerName || !/^[0-9]{10}$/.test(customerPhone))) {
      return bad(res, 'Enter a customer name and a valid 10-digit mobile number.');
    }
    if (customerDetails?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerDetails.email)) {
      return bad(res, 'Enter a valid email address.');
    }
    if (!Number.isFinite(Number(discount || 0)) || Number(discount || 0) < 0) return bad(res, 'Discount must be a valid non-negative amount.');
    if (!Number.isFinite(Number(paidAmount || 0)) || Number(paidAmount || 0) < 0) return bad(res, 'Paid amount must be a valid non-negative amount.');
    if (Number(paidAmount || 0) > 0 && !isValidPaymentMethod(paymentMethod)) return bad(res, 'Select a valid payment method.');

    const saleDateValue = parseDate(saleDate);
    const dueDateValue = parseDate(dueDate);
    const paymentDateValue = parseDate(paymentDate);
    if ([saleDateValue, dueDateValue, paymentDateValue].includes(undefined)) return bad(res, 'One of the dates is invalid.');

    const seen = new Set();
    for (const item of items) {
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) return bad(res, 'Each item quantity must be a whole number greater than zero.');
      if ((item.sellingPrice !== undefined && (!Number.isFinite(Number(item.sellingPrice)) || Number(item.sellingPrice) < 0)) || !Number.isFinite(Number(item.discount || 0)) || Number(item.discount || 0) < 0) {
        return bad(res, 'Item prices and discounts must be valid non-negative amounts.');
      }
      if (seen.has(Number(item.productId))) return bad(res, 'The same product appears twice. Combine it into one line.');
      seen.add(Number(item.productId));
    }

    let customer = customerId
      ? await prisma.customer.findUnique({ where: { id: Number(customerId) } })
      : await prisma.customer.findFirst({ where: { phone: customerPhone } });
    if (customerId && !customer) return res.status(404).json({ error: 'Not Found', message: 'Customer not found' });

    const settings = (await prisma.businessSettings.findFirst()) || {};

    // Prices and tax rates come from the product record; only admins may override the selling price.
    let subtotal = 0;
    let totalGst = 0;
    const saleItemsData = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: Number(item.productId) } });
      if (!product || product.status !== 'ACTIVE') return res.status(404).json({ error: 'Not Found', message: `Product ${item.productId} not found or inactive` });
      const agg = await prisma.inventory.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
      const available = agg._sum.quantity || 0;
      if (!settings.allowNegativeStock && Number(item.quantity) > available) {
        return bad(res, `Insufficient stock for ${product.name}. Available: ${available}, requested: ${item.quantity}`);
      }
      const qty = Number(item.quantity);
      const canOverride = req.user.role === 'ADMIN' && item.sellingPrice !== undefined;
      const rate = canOverride ? Number(item.sellingPrice) : product.sellingPrice;
      const lineDiscount = round2(item.discount || 0);
      const lineTotal = round2(rate * qty);
      if (lineDiscount > lineTotal) return bad(res, 'An item discount cannot exceed its line total.');
      const taxable = round2(lineTotal - lineDiscount);
      const gstPercent = isGst ? product.gstPercent : 0;
      const gst = isGst ? percentOf(taxable, gstPercent) : 0;
      subtotal = round2(subtotal + lineTotal);
      totalGst = round2(totalGst + gst);
      saleItemsData.push({
        productId: product.id, quantity: qty, sellingPrice: rate, purchasePrice: product.purchasePrice,
        gstPercent, discount: lineDiscount, total: round2(taxable + gst), _product: product,
      });
    }
    // Item discounts and the overall discount both come off the total; GST is charged on each line after its own discount.
    const itemDiscountTotal = round2(saleItemsData.reduce((a, i) => a + i.discount, 0));
    const totalDiscount = round2(itemDiscountTotal + round2(discount || 0));
    if (totalDiscount > subtotal) return bad(res, 'Discount cannot be greater than the subtotal.');
    const taxableAmount = round2(subtotal - totalDiscount);
    const grandTotal = round2(taxableAmount + totalGst);
    const paid = round2(paidAmount || 0);
    if (paid > grandTotal) return bad(res, 'Paid amount cannot be greater than the final amount.');

    if (customerDetails) {
      // Fields left out of the request keep their saved value; an empty string clears them.
      const optional = (key) => (customerDetails[key] === undefined ? undefined : customerDetails[key] || null);
      const customerData = {
        name: customerName,
        phone: customerPhone,
        altPhone: optional('altPhone'),
        email: optional('email'),
        address: optional('address'),
        gstin: optional('gstin'),
        state: optional('state'),
      };
      const duplicate = await prisma.customer.findFirst({ where: { phone: customerPhone, ...(customer ? { id: { not: customer.id } } : {}) } });
      if (duplicate) return res.status(409).json({ error: 'Conflict', message: 'This mobile number belongs to another customer. Select that customer from search.' });
      customer = customer
        ? await prisma.customer.update({ where: { id: customer.id }, data: customerData })
        : await prisma.customer.create({ data: { customerCode: await generateCustomerCode(), ...customerData } });
    }

    let saleVehicleId = requestedVehicleId ? Number(requestedVehicleId) : null;
    const vehicleNumber = String(vehicleDetails?.vehicleNumber || '').trim().toUpperCase();
    if (vehicleDetails && vehicleNumber) {
      const existingVehicle = await prisma.vehicle.findFirst({ where: { customerId: customer.id, vehicleNumber } });
      const vehicleData = {
        vehicleNumber,
        vehicleType: vehicleDetails.vehicleType || existingVehicle?.vehicleType || 'Other',
        model: vehicleDetails.model || null,
      };
      const savedVehicle = existingVehicle
        ? await prisma.vehicle.update({ where: { id: existingVehicle.id }, data: vehicleData })
        : await prisma.vehicle.create({ data: { customerId: customer.id, ...vehicleData } });
      saleVehicleId = savedVehicle.id;
    } else if (saleVehicleId) {
      const existingVehicle = await prisma.vehicle.findFirst({ where: { id: saleVehicleId, customerId: customer.id } });
      if (!existingVehicle) return bad(res, 'Selected vehicle does not belong to this customer.');
    }

    let cgst = 0, sgst = 0, igst = 0;
    if (isGst) {
      const customerState = customerDetails?.state || customer?.state;
      const sameState = settings.state && customerState && settings.state.toLowerCase() === customerState.toLowerCase();
      if (sameState || !customerState) {
        cgst = round2(totalGst / 2);
        sgst = round2(totalGst - cgst);
      } else {
        igst = totalGst;
      }
    }

    const saleNumber = await generateSaleNumber();
    const invoiceNumber = await generateInvoiceNumber(settings.invoicePrefix || 'INV');
    const due = round2(grandTotal - paid);
    let paymentStatus = 'PENDING';
    if (paid >= grandTotal && grandTotal > 0) paymentStatus = 'PAID';
    else if (paid > 0) paymentStatus = 'PARTIALLY PAID';

    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        customerId: customer.id,
        vehicleId: saleVehicleId,
        employeeId: req.user.id,
        subtotal,
        discount: totalDiscount,
        gstAmount: totalGst,
        total: grandTotal,
        paymentMethod: paymentMethod || null,
        isGst: !!isGst,
        saleDate: saleDateValue || new Date(),
        notes: notes || null,
        items: {
          create: saleItemsData.map((i) => ({
            productId: i.productId, quantity: i.quantity, sellingPrice: i.sellingPrice, purchasePrice: i.purchasePrice,
            gstPercent: i.gstPercent, discount: i.discount, total: i.total,
          })),
        },
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        saleId: sale.id,
        customerId: customer.id,
        vehicleId: saleVehicleId,
        employeeId: req.user.id,
        isGst: !!isGst,
        invoiceDate: sale.saleDate,
        dueDate: dueDateValue,
        subtotal,
        discount: totalDiscount,
        taxableAmount,
        cgst,
        sgst,
        igst,
        grandTotal,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus,
        items: {
          create: saleItemsData.map((i) => ({
            productId: i.productId, quantity: i.quantity, rate: i.sellingPrice, discount: i.discount, gstPercent: i.gstPercent, amount: i.total,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of saleItemsData) {
      await reduceStock(item.productId, item.quantity, req.user.id, invoiceNumber, 'SALE');
    }

    if (paid > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: customer.id,
          amount: paid,
          method: paymentMethod,
          referenceNumber: paymentReference || null,
          status: 'PAID',
          paidAt: paymentDateValue || new Date(),
        },
      });
    }

    const warranties = [];
    for (const item of saleItemsData) {
      const product = item._product;
      if (product.warrantyType && product.warrantyType !== 'No Warranty' && Number(product.warrantyDuration) > 0) {
        const warrantyCode = await generateWarrantyCode();
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(product.warrantyDuration));
        warranties.push(await prisma.warranty.create({
          data: {
            warrantyCode, customerId: customer.id, vehicleId: saleVehicleId, productId: product.id, invoiceId: invoice.id, saleId: sale.id,
            purchaseDate: start, warrantyStart: start, warrantyEnd: end, warrantyType: product.warrantyType,
            warrantyDuration: product.warrantyDuration, status: 'ACTIVE',
          },
        }));
      }
    }

    await logAudit({ userId: req.user.id, action: 'SALE_CREATED', entity: 'Sale', entityId: sale.id });
    await logAudit({ userId: req.user.id, action: 'INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id });
    if (paid > 0) await logAudit({ userId: req.user.id, action: 'PAYMENT_RECORDED', entity: 'Invoice', entityId: invoice.id, details: { amount: paid } });

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true, vehicle: true,
        employee: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { product: true } }, payments: true, warranties: true, sale: true,
      },
    });
    res.status(201).json({ sale, invoice: withStatus(fullInvoice), warranties });
  } catch (err) {
    next(err);
  }
});

// Edit sale details that do not change stock or totals.
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sale = await prisma.sale.findUnique({ where: { id }, include: { invoice: true } });
    if (!sale) return res.status(404).json({ error: 'Not Found', message: 'Sale not found' });
    if (sale.status === 'CANCELLED') return bad(res, 'A cancelled sale cannot be edited.');

    const { paymentMethod, notes, saleDate, dueDate } = req.body;
    if (paymentMethod && !isValidPaymentMethod(paymentMethod)) return bad(res, 'Select a valid payment method.');
    const saleDateValue = parseDate(saleDate);
    const dueDateValue = parseDate(dueDate);
    if (saleDateValue === undefined || dueDateValue === undefined) return bad(res, 'One of the dates is invalid.');

    await prisma.sale.update({
      where: { id },
      data: {
        paymentMethod: paymentMethod || undefined,
        notes: notes === undefined ? undefined : notes || null,
        saleDate: saleDateValue || undefined,
      },
    });
    if (sale.invoice && (dueDate !== undefined || saleDateValue)) {
      await prisma.invoice.update({
        where: { id: sale.invoice.id },
        data: { dueDate: dueDate === undefined ? undefined : dueDateValue, invoiceDate: saleDateValue || undefined },
      });
    }
    await logAudit({ userId: req.user.id, action: 'SALE_UPDATED', entity: 'Sale', entityId: id });
    const updated = await prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    res.json(withDisplay(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', authorize('ADMIN'), async (req, res, next) => {
  try {
    await cancelSale(Number(req.params.id), req.user.id);
    res.json({ message: 'Sale cancelled and stock restored.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
