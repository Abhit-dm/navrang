const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// Fields safe to show to anonymous visitors; GSTIN, cost prices and internal settings stay private.
const PUBLIC_SETTINGS = {
  businessName: true, tagline: true, logoUrl: true, address: true, phone: true, email: true, whatsapp: true,
  businessHours: true, facebookUrl: true, instagramUrl: true, aboutText: true, missionText: true, visionText: true, commitmentText: true,
};

async function stockByProduct() {
  const rows = await prisma.inventory.groupBy({ by: ['productId'], _sum: { quantity: true } });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity || 0]));
}

function availability(qty, min) {
  if (qty <= 0) return 'OUT OF STOCK';
  if (qty <= min) return 'LOW STOCK';
  return 'IN STOCK';
}

function toPublicProduct(p, stock) {
  const qty = stock.get(p.id) || 0;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    size: p.size,
    rimSize: p.rimSize,
    tyreType: p.tyreType,
    pattern: p.pattern,
    speedRating: p.speedRating,
    loadIndex: p.loadIndex,
    vehicleType: p.vehicleCompatibility,
    description: p.description,
    imageUrl: p.imageUrl,
    featured: p.featured,
    price: p.sellingPrice > 0 ? p.sellingPrice : null,
    mrp: p.mrp > 0 ? p.mrp : null,
    availability: availability(qty, p.minStockLevel),
  };
}

router.get('/settings', async (req, res) => {
  const settings = await prisma.businessSettings.findFirst({ select: PUBLIC_SETTINGS });
  res.json(settings || {});
});

router.get('/products/filters', async (req, res) => {
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { brand: true, category: true, vehicleCompatibility: true } });
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  res.json({
    brands: uniq(products.map((p) => p.brand)),
    categories: uniq(products.map((p) => p.category)),
    vehicleTypes: uniq(products.map((p) => p.vehicleCompatibility)),
  });
});

router.get('/products', async (req, res) => {
  const { search, category, brand, vehicleType, minPrice, maxPrice, featured } = req.query;
  const where = { status: 'ACTIVE' };
  if (category) where.category = String(category);
  if (brand) where.brand = String(brand);
  if (vehicleType) where.vehicleCompatibility = String(vehicleType);
  if (featured === 'true') where.featured = true;
  const price = {};
  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(Number(minPrice))) price.gte = Number(minPrice);
  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) price.lte = Number(maxPrice);
  if (price.gte !== undefined || price.lte !== undefined) where.sellingPrice = price;
  if (search) {
    const q = String(search).slice(0, 80);
    where.OR = [{ name: { contains: q } }, { brand: { contains: q } }, { size: { contains: q } }, { pattern: { contains: q } }];
  }
  const [products, stock] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    stockByProduct(),
  ]);
  res.json(products.map((p) => toPublicProduct(p, stock)));
});

router.get('/products/:id', async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: Number(req.params.id) || 0, status: 'ACTIVE' } });
  if (!product) return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
  res.json(toPublicProduct(product, await stockByProduct()));
});

// Simple in-memory limiter: 5 enquiries per IP per 15 minutes.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (recent.length >= 5) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

router.post('/enquiries', async (req, res) => {
  const bad = (message) => res.status(400).json({ error: 'Bad Request', message });
  const { name, phone, email, subject, message, website } = req.body || {};
  if (website) return res.status(201).json({ message: 'Thank you. We will contact you soon.' }); // honeypot for bots
  const clean = (v, max) => String(v || '').trim().slice(0, max);
  const data = { name: clean(name, 100), phone: clean(phone, 15), email: clean(email, 150), subject: clean(subject, 150), message: clean(message, 2000) };
  if (data.name.length < 2) return bad('Please enter your name.');
  if (!/^[0-9+\-\s]{10,15}$/.test(data.phone)) return bad('Please enter a valid phone number.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return bad('Please enter a valid email address.');
  if (data.subject.length < 3) return bad('Please enter a subject.');
  if (data.message.length < 10) return bad('Please enter a message of at least 10 characters.');
  if (limited(req.ip)) return res.status(429).json({ error: 'Too Many Requests', message: 'Too many enquiries. Please try again later.' });

  await prisma.contactEnquiry.create({ data: { ...data, email: data.email || null } });
  res.status(201).json({ message: 'Thank you. We have received your enquiry and will contact you soon.' });
});

module.exports = router;
