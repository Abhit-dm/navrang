const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN'), async (req, res) => {
  const { dateFrom, dateTo, category } = req.query;
  const where = {};
  if (category) where.category = category;
  if (dateFrom || dateTo) {
    where.expenseDate = {};
    if (dateFrom) where.expenseDate.gte = new Date(dateFrom);
    if (dateTo) where.expenseDate.lte = new Date(dateTo);
  }
  const expenses = await prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' } });
  res.json(expenses);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const { category, description, amount, paymentMethod, expenseDate, notes } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: 'Bad Request', message: 'Category and amount are required.' });
  }
  const expense = await prisma.expense.create({
    data: {
      category,
      description,
      amount: Number(amount),
      paymentMethod,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      notes,
    },
  });
  await logAudit({ userId: req.user.id, action: 'EXPENSE_CREATED', entity: 'Expense', entityId: expense.id });
  res.status(201).json(expense);
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { category, description, amount, paymentMethod, expenseDate, notes } = req.body;
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      category,
      description,
      amount: amount !== undefined ? Number(amount) : undefined,
      paymentMethod,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      notes,
    },
  });
  await logAudit({ userId: req.user.id, action: 'EXPENSE_UPDATED', entity: 'Expense', entityId: id });
  res.json(expense);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.expense.delete({ where: { id } });
  await logAudit({ userId: req.user.id, action: 'EXPENSE_DELETED', entity: 'Expense', entityId: id });
  res.json({ message: 'Expense deleted' });
});

module.exports = router;
