const { PrismaClient } = require('@prisma/client');
const { isStrongPassword, validateEmail } = require('../src/utils/validation');
const { provisionAdmin } = require('../src/utils/adminProvisioning');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!validateEmail(adminEmail)) throw new Error('SEED_ADMIN_EMAIL must be set to a valid administrator email address.');
  if (!isStrongPassword(adminPassword) || Buffer.byteLength(adminPassword, 'utf8') > 72) {
    throw new Error('SEED_ADMIN_PASSWORD must be strong and no more than 72 UTF-8 bytes.');
  }

  // Business settings
  const existingSettings = await prisma.businessSettings.findFirst();
  if (!existingSettings) {
    await prisma.businessSettings.create({
      data: {
        businessName: 'NAVRANG TYRES',
        tagline: 'Quality Tyres. Trusted Service.',
        address: 'D.no.27-18-103/2, Congress Office Road, Governorpeta, Vijayawada-2',
        phone: '9550540777',
        email: null,
        gstin: null,
        state: 'Andhra Pradesh',
        stateCode: '37',
        invoicePrefix: 'INV',
        currency: 'INR',
        defaultGstPercent: 18,
        lowStockThreshold: 5,
        warrantyExpiryDays: 30,
        invoiceTerms: null,
        footerText: 'Thank you for your business!',
        allowNegativeStock: false,
        whatsapp: '9550540777',
        businessHours: 'Mon - Sat: 9:00 AM - 8:00 PM',
      },
    });
  } else {
    const cleanup = {};
    if (existingSettings.email === 'contact@navrangtyres.local') cleanup.email = null;
    if (existingSettings.gstin === '24AAAAA0000A1Z5') cleanup.gstin = null;
    if (existingSettings.state === 'Gujarat' && existingSettings.stateCode === '24') {
      cleanup.state = 'Andhra Pradesh';
      cleanup.stateCode = '37';
    }
    if (existingSettings.invoiceTerms === 'Goods once sold will not be taken back. Warranty as per manufacturer terms. This is a DEMO invoice terms text.') {
      cleanup.invoiceTerms = null;
    }
    if (existingSettings.footerText === 'Thank you for your business! (DEMO DATA)') {
      cleanup.footerText = 'Thank you for your business!';
    }
    if (Object.keys(cleanup).length > 0) {
      await prisma.businessSettings.update({ where: { id: existingSettings.id }, data: cleanup });
    }
  }

  await provisionAdmin(prisma, adminEmail, adminPassword);

  const sampleEmployee = await prisma.user.findUnique({ where: { email: 'employee@navrangtyres.local' } });
  if (sampleEmployee?.name === 'Employee (Demo)') {
    await prisma.user.update({
      where: { id: sampleEmployee.id },
      data: { name: 'Former Employee', email: `former-employee-${sampleEmployee.id}@example.invalid`, isActive: false },
    });
    await prisma.tokenBlacklist.deleteMany({ where: { userId: sampleEmployee.id } });
  }

  console.log(`Administrator provisioned: ${adminEmail}`);
  console.log('Password value was not logged.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
