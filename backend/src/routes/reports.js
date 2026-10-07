const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

// ============ ADMIN DASHBOARD ============
router.get('/dashboard', async (req, res) => {
  const now = new Date();
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);
  const month0 = startOfMonth(now);
  const month1 = endOfMonth(now);
  const settings = (await prisma.businessSettings.findFirst()) || { lowStockThreshold: 5, warrantyExpiryDays: 30 };

  const totalProducts = await prisma.product.count({ where: { status: 'ACTIVE' } });
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: { inventory: true } });
  const totalStockQty = products.reduce((s, p) => s + p.inventory.reduce((a, i) => a + i.quantity, 0), 0);
  const totalCustomers = await prisma.customer.count();

  const todaysInvoices = await prisma.invoice.findMany({ where: { invoiceDate: { gte: today0, lte: today1 }, status: 'ACTIVE' } });
  const todaysSales = todaysInvoices.length;
  const todaysRevenue = todaysInvoices.reduce((s, i) => s + i.grandTotal, 0);

  const monthlyInvoices = await prisma.invoice.findMany({ where: { invoiceDate: { gte: month0, lte: month1 }, status: 'ACTIVE' } });
  const monthlySales = monthlyInvoices.reduce((s, i) => s + i.grandTotal, 0);

  const monthlyPurchases = await prisma.purchase.findMany({ where: { purchaseDate: { gte: month0, lte: month1 } } });
  const monthlyPurchaseTotal = monthlyPurchases.reduce((s, p) => s + p.total, 0);

  // Monthly profit (gross): revenue - COGS
  const monthlySaleItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: month0, lte: month1 } } },
  });
  const monthlyCogs = monthlySaleItems.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
  const monthlyRevenueFromSales = monthlySaleItems.reduce((s, i) => s + i.total, 0);
  const monthlyProfit = monthlyRevenueFromSales - monthlyCogs;

  const outOfStock = products.filter((p) => p.inventory.reduce((a, i) => a + i.quantity, 0) <= 0).length;
  const lowStock = products.filter((p) => {
    const qty = p.inventory.reduce((a, i) => a + i.quantity, 0);
    return qty > 0 && qty <= p.minStockLevel;
  }).length;

  const expiryLimit = new Date();
  expiryLimit.setDate(expiryLimit.getDate() + (settings.warrantyExpiryDays || 30));
  const warrantyExpiring = await prisma.warranty.count({
    where: { warrantyEnd: { gte: now, lte: expiryLimit }, status: { notIn: ['CLAIMED', 'REPLACED', 'EXPIRED'] } },
  });

  // Chart: monthly sales/purchases/profit for last 6 months
  const chartMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    chartMonths.push(d);
  }
  const monthlyChart = [];
  for (const d of chartMonths) {
    const s0 = startOfMonth(d), s1 = endOfMonth(d);
    const invs = await prisma.invoice.findMany({ where: { invoiceDate: { gte: s0, lte: s1 }, status: 'ACTIVE' } });
    const purs = await prisma.purchase.findMany({ where: { purchaseDate: { gte: s0, lte: s1 } } });
    const sItems = await prisma.saleItem.findMany({ where: { sale: { createdAt: { gte: s0, lte: s1 } } } });
    const cogs = sItems.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
    const rev = invs.reduce((s, i) => s + i.grandTotal, 0);
    monthlyChart.push({
      month: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      sales: rev,
      purchases: purs.reduce((s, p) => s + p.total, 0),
      profit: rev - cogs,
    });
  }

  // Top selling products (all time, top 5)
  const allSaleItems = await prisma.saleItem.findMany({ include: { product: true } });
  const productMap = {};
  for (const item of allSaleItems) {
    if (!productMap[item.productId]) productMap[item.productId] = { name: item.product.name, unitsSold: 0, revenue: 0 };
    productMap[item.productId].unitsSold += item.quantity;
    productMap[item.productId].revenue += item.total;
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  // Payment method distribution
  const payments = await prisma.payment.findMany();
  const paymentDist = {};
  for (const p of payments) {
    paymentDist[p.method] = (paymentDist[p.method] || 0) + p.amount;
  }

  res.json({
    totalProducts,
    totalStockQty,
    totalCustomers,
    todaysSales,
    todaysRevenue,
    monthlySales,
    monthlyPurchases: monthlyPurchaseTotal,
    monthlyProfit,
    outOfStock,
    lowStock,
    warrantyExpiring,
    monthlyChart,
    topProducts,
    paymentDistribution: Object.entries(paymentDist).map(([method, amount]) => ({ method, amount })),
  });
});

// ============ EMPLOYEE DASHBOARD ============
router.get('/dashboard/employee', async (req, res) => {
  const now = new Date();
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);

  const todaysInvoices = await prisma.invoice.findMany({
    where: { invoiceDate: { gte: today0, lte: today1 }, status: 'ACTIVE' },
    include: { customer: true },
  });
  const todaysSales = todaysInvoices.length;
  const todaysRevenue = todaysInvoices.reduce((s, i) => s + i.grandTotal, 0);

  const customersToday = await prisma.customer.count({ where: { createdAt: { gte: today0, lte: today1 } } });

  const pendingInvoices = await prisma.invoice.findMany({ where: { paymentStatus: { in: ['PENDING', 'PARTIALLY PAID'] }, status: 'ACTIVE' } });
  const pendingAmount = pendingInvoices.reduce((s, i) => s + i.dueAmount, 0);

  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: { inventory: true } });
  const lowStockList = products
    .map((p) => ({ name: p.name, sku: p.sku, qty: p.inventory.reduce((a, i) => a + i.quantity, 0), min: p.minStockLevel }))
    .filter((p) => p.qty <= p.min);

  const recentSales = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { customer: true },
  });
  const recentCustomers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });

  res.json({
    todaysSales,
    todaysRevenue,
    customersToday,
    pendingPaymentsCount: pendingInvoices.length,
    pendingAmount,
    lowStockAlerts: lowStockList.length,
    recentSales,
    recentCustomers,
  });
});

// ============ MONTHLY REPORT ============
router.get('/monthly', async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const s0 = new Date(year, month - 1, 1);
  const s1 = new Date(year, month, 0, 23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({ where: { invoiceDate: { gte: s0, lte: s1 }, status: 'ACTIVE' } });
  const purchases = await prisma.purchase.findMany({ where: { purchaseDate: { gte: s0, lte: s1 } } });
  const saleItems = await prisma.saleItem.findMany({ where: { sale: { createdAt: { gte: s0, lte: s1 } } } });
  const purchaseItems = await prisma.purchaseItem.findMany({ where: { purchase: { purchaseDate: { gte: s0, lte: s1 } } } });

  const salesRevenue = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const purchaseCost = purchases.reduce((s, p) => s + p.total, 0);
  const gstCollected = invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
  const discounts = invoices.reduce((s, i) => s + i.discount, 0);
  const paid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const outstanding = invoices.reduce((s, i) => s + i.dueAmount, 0);
  const salesQty = saleItems.reduce((s, i) => s + i.quantity, 0);
  const purchaseQty = purchaseItems.reduce((s, i) => s + i.quantity, 0);
  const cogs = saleItems.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);

  // opening stock = stock as of s0 (sum of movements before s0)
  const allProducts = await prisma.product.findMany({ include: { inventory: true } });
  const closingStock = allProducts.reduce((s, p) => s + p.inventory.reduce((a, i) => a + i.quantity, 0), 0);
  const openingStock = closingStock - purchaseQty + salesQty;

  res.json({
    month, year,
    openingStock,
    purchases: purchaseQty,
    salesQuantity: salesQty,
    closingStock,
    salesRevenue,
    purchaseCost,
    grossProfit: salesRevenue - cogs,
    gstCollected,
    discounts,
    paid,
    outstanding,
  });
});

// ============ TOP PRODUCTS ============
router.get('/top-products', async (req, res) => {
  const { from, to } = req.query;
  const where = {};
  if (from || to) {
    where.sale = { createdAt: {} };
    if (from) where.sale.createdAt.gte = new Date(from);
    if (to) where.sale.createdAt.lte = new Date(to);
  }
  const saleItems = await prisma.saleItem.findMany({ where, include: { product: true, sale: true } });
  const map = {};
  for (const item of saleItems) {
    const key = item.productId;
    if (!map[key]) {
      map[key] = {
        product: item.product.name,
        brand: item.product.brand,
        sku: item.product.sku,
        unitsSold: 0,
        revenue: 0,
        salesCount: new Set(),
      };
    }
    map[key].unitsSold += item.quantity;
    map[key].revenue += item.total;
    map[key].salesCount.add(item.saleId);
  }
  const result = Object.values(map)
    .map((r) => ({ ...r, numberOfSales: r.salesCount.size, salesCount: undefined }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .map((r, idx) => ({ rank: idx + 1, ...r }));
  res.json(result);
});

// ============ PROFIT REPORT ============
router.get('/profit', async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasRange = from || to;

  const invoiceWhere = { status: 'ACTIVE' };
  if (hasRange) invoiceWhere.invoiceDate = dateFilter;
  const invoices = await prisma.invoice.findMany({ where: invoiceWhere });

  const saleItemWhere = {};
  if (hasRange) saleItemWhere.sale = { createdAt: dateFilter };
  const saleItems = await prisma.saleItem.findMany({ where: saleItemWhere });

  const purchaseWhere = {};
  if (hasRange) purchaseWhere.purchaseDate = dateFilter;
  const purchases = await prisma.purchase.findMany({ where: purchaseWhere });

  const expenseWhere = {};
  if (hasRange) expenseWhere.expenseDate = dateFilter;
  const expenses = await prisma.expense.findMany({ where: expenseWhere });

  const salesRevenue = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const discounts = invoices.reduce((s, i) => s + i.discount, 0);
  const gst = invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
  const cogs = saleItems.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
  const grossProfit = salesRevenue - cogs;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const totalPurchases = purchases.reduce((s, p) => s + p.total, 0);

  res.json({
    salesRevenue,
    cogs,
    grossProfit,
    discounts,
    gst,
    expenses: totalExpenses,
    netProfit,
    billingVsPurchase: {
      sales: salesRevenue,
      purchases: totalPurchases,
      difference: salesRevenue - totalPurchases,
      label: 'Billing vs Purchase Summary (not true accounting profit)',
    },
  });
});

// ============ PAYMENT METHOD REPORT ============
router.get('/payments', async (req, res) => {
  const { from, to } = req.query;
  const where = {};
  if (from || to) {
    where.paidAt = {};
    if (from) where.paidAt.gte = new Date(from);
    if (to) where.paidAt.lte = new Date(to);
  }
  const payments = await prisma.payment.findMany({ where });
  const map = {};
  for (const p of payments) {
    if (!map[p.method]) map[p.method] = { method: p.method, total: 0, count: 0 };
    map[p.method].total += p.amount;
    map[p.method].count += 1;
  }
  res.json(Object.values(map));
});

// ============ STOCK REPORT ============
router.get('/stock', async (req, res) => {
  const products = await prisma.product.findMany({ include: { inventory: true } });
  const purchaseItems = await prisma.purchaseItem.groupBy({ by: ['productId'], _sum: { quantity: true } });
  const saleItems = await prisma.saleItem.groupBy({ by: ['productId'], _sum: { quantity: true } });
  const purchaseMap = Object.fromEntries(purchaseItems.map((p) => [p.productId, p._sum.quantity || 0]));
  const saleMap = Object.fromEntries(saleItems.map((p) => [p.productId, p._sum.quantity || 0]));

  const rows = products.map((p) => {
    const currentStock = p.inventory.reduce((a, i) => a + i.quantity, 0);
    return {
      product: p.name,
      sku: p.sku,
      totalPurchaseQty: purchaseMap[p.id] || 0,
      totalSalesQty: saleMap[p.id] || 0,
      currentStock,
      status: currentStock <= 0 ? 'OUT OF STOCK' : currentStock <= p.minStockLevel ? 'LOW STOCK' : 'IN STOCK',
    };
  });
  res.json(rows);
});

// ============ MONTHLY BILLING REPORT ============
router.get('/monthly-billing', async (req, res) => {
  const { month, year, employeeId, paymentMethod, isGst } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();
  const s0 = new Date(y, m - 1, 1);
  const s1 = new Date(y, m, 0, 23, 59, 59, 999);

  const where = { invoiceDate: { gte: s0, lte: s1 } };
  if (employeeId) where.employeeId = Number(employeeId);
  if (isGst !== undefined && isGst !== '') where.isGst = isGst === 'true';
  const invoices = await prisma.invoice.findMany({ where, include: { sale: true } });
  const filtered = paymentMethod ? invoices.filter((i) => i.sale?.paymentMethod === paymentMethod) : invoices;

  res.json({
    totalInvoices: filtered.length,
    gstInvoices: filtered.filter((i) => i.isGst).length,
    nonGstInvoices: filtered.filter((i) => !i.isGst).length,
    totalSales: filtered.reduce((s, i) => s + i.grandTotal, 0),
    totalGst: filtered.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
    totalDiscounts: filtered.reduce((s, i) => s + i.discount, 0),
    totalPaid: filtered.reduce((s, i) => s + i.paidAmount, 0),
    totalDue: filtered.reduce((s, i) => s + i.dueAmount, 0),
  });
});

module.exports = router;
