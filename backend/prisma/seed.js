const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function createSeedPassword(environmentVariable, fallback) {
  const password = process.env[environmentVariable] || fallback;
  if (password) return password;
  return crypto.randomBytes(24).toString('base64');
}

async function main() {
  console.log('Seeding NAVRANG TYRES demo data...');

  // Business settings
  const existingSettings = await prisma.businessSettings.findFirst();
  if (!existingSettings) {
    await prisma.businessSettings.create({
      data: {
        businessName: 'NAVRANG TYRES',
        tagline: 'Quality Tyres. Trusted Service.',
        address: 'Shop No. 12, Ring Road, Ahmedabad, Gujarat',
        phone: '9876543210',
        email: 'contact@navrangtyres.local',
        gstin: '24AAAAA0000A1Z5',
        state: 'Gujarat',
        stateCode: '24',
        invoicePrefix: 'INV',
        currency: 'INR',
        defaultGstPercent: 18,
        lowStockThreshold: 5,
        warrantyExpiryDays: 30,
        invoiceTerms: 'Goods once sold will not be taken back. Warranty as per manufacturer terms. This is a DEMO invoice terms text.',
        footerText: 'Thank you for your business! (DEMO DATA)',
        allowNegativeStock: false,
        whatsapp: '9876543210',
        businessHours: 'Mon - Sat: 9:00 AM - 8:00 PM',
      },
    });
  }

  // Demo users
  const adminEmail = 'admin@navrangtyres.local';
  const empEmail = 'employee@navrangtyres.local';
  const adminPassword = createSeedPassword('SEED_ADMIN_PASSWORD');
  const employeePassword = createSeedPassword('SEED_EMPLOYEE_PASSWORD');

  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: 'Admin (Demo)',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: 'ADMIN',
        phone: '9000000001',
      },
    });
  }

  const empExists = await prisma.user.findUnique({ where: { email: empEmail } });
  let employee = empExists;
  if (!empExists) {
    employee = await prisma.user.create({
      data: {
        name: 'Employee (Demo)',
        email: empEmail,
        passwordHash: await bcrypt.hash(employeePassword, 10),
        role: 'EMPLOYEE',
        phone: '9000000002',
      },
    });
  }

  // Demo supplier
  let supplier = await prisma.supplier.findFirst({ where: { name: 'Demo Tyre Distributors' } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: 'Demo Tyre Distributors',
        contactPerson: 'Suresh Patel',
        phone: '9123456780',
        email: 'supplier@demo.local',
        address: 'Industrial Area, Ahmedabad',
        gstin: '24BBBBB1111B2Z6',
        state: 'Gujarat',
        notes: 'DEMO DATA supplier',
      },
    });
  }

  // Demo products (tyres)
  const demoProducts = [
    { name: 'MRF ZVTV', brand: 'MRF', size: '195/65 R15', width: '195', profile: '65', rimSize: '15', purchasePrice: 3200, sellingPrice: 4200, mrp: 4500, invoiceStock: 20 },
    { name: 'CEAT Milaze', brand: 'CEAT', size: '195/65 R15', width: '195', profile: '65', rimSize: '15', purchasePrice: 3000, sellingPrice: 4000, mrp: 4300, invoiceStock: 15 },
    { name: 'Apollo Alnac', brand: 'Apollo', size: '185/65 R15', width: '185', profile: '65', rimSize: '15', purchasePrice: 2800, sellingPrice: 3700, mrp: 4000, invoiceStock: 18 },
    { name: 'Bridgestone Ecopia', brand: 'Bridgestone', size: '205/55 R16', width: '205', profile: '55', rimSize: '16', purchasePrice: 4500, sellingPrice: 5800, mrp: 6200, invoiceStock: 10 },
    { name: 'Michelin Primacy', brand: 'Michelin', size: '215/60 R16', width: '215', profile: '60', rimSize: '16', purchasePrice: 5200, sellingPrice: 6800, mrp: 7200, invoiceStock: 8 },
  ];

  for (const p of demoProducts) {
    const sku = `${p.brand.substring(0, 3).toUpperCase()}-${p.size.replace(/[^0-9]/g, '')}`;
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) continue;
    const product = await prisma.product.create({
      data: {
        name: `${p.name} ${p.size} (DEMO)`,
        brand: p.brand,
        category: 'Car Tyres',
        productType: 'Tyre',
        sku,
        barcode: `890000${sku.replace(/-/g, '')}`,
        size: p.size,
        width: p.width,
        profile: p.profile,
        rimSize: p.rimSize,
        tyreType: 'Tubeless',
        vehicleCompatibility: 'Car',
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        gstPercent: 28,
        minStockLevel: 5,
        supplierId: supplier.id,
        warrantyType: 'Manufacturer Warranty',
        warrantyDuration: 24,
        status: 'ACTIVE',
      },
    });
    await prisma.inventory.create({
      data: {
        productId: product.id,
        batch: 'OPENING-DEMO',
        quantity: p.invoiceStock,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        gstPercent: 28,
        supplierId: supplier.id,
        purchaseDate: new Date(),
      },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'OPENING_STOCK', quantity: p.invoiceStock, reference: 'Seed data', userId: employee?.id || null },
    });
  }

  // Demo customer + vehicle
  let customer = await prisma.customer.findFirst({ where: { phone: '9000000000' } });
  if (!customer) {
    const year = new Date().getFullYear();
    const count = await prisma.customer.count();
    customer = await prisma.customer.create({
      data: {
        customerCode: `CUS-${year}-${String(count + 1).padStart(6, '0')}`,
        name: 'Demo Customer',
        phone: '9000000000',
        address: 'Demo Address, Ahmedabad',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
        customerType: 'Individual',
        notes: 'DEMO DATA customer',
      },
    });
  }

  let vehicle = await prisma.vehicle.findFirst({ where: { vehicleNumber: 'AP00XX0000' } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        customerId: customer.id,
        vehicleNumber: 'AP00XX0000',
        vehicleType: 'Car',
        brand: 'Hyundai',
        model: 'Creta',
        year: 2022,
        fuelType: 'Petrol',
        odometerReading: 15000,
        notes: 'DEMO DATA vehicle',
      },
    });
  }

  console.log('Seed complete.');
  console.log(`ADMIN: ${adminEmail} (password supplied by SEED_ADMIN_PASSWORD)`);
  console.log(`EMPLOYEE: ${empEmail} (password supplied by SEED_EMPLOYEE_PASSWORD)`);
  if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_EMPLOYEE_PASSWORD) {
    console.warn('Seed passwords were generated securely and were not printed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
