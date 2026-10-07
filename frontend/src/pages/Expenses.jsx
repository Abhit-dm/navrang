import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';

const CATEGORIES = ['Rent', 'Electricity', 'Salary', 'Transport', 'Maintenance', 'Internet', 'Other'];
const PAYMENT_METHODS = ['UPI', 'PhonePe', 'Google Pay', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallet', 'Cash', 'Cash on Delivery'];
const emptyForm = { category: 'Rent', description: '', amount: '', paymentMethod: 'Cash', expenseDate: new Date().toISOString().slice(0, 10), notes: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => api.get('/expenses').then((res) => setExpenses(res.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/expenses', form);
      setShowForm(false); setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense');
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Expenses (Total: {formatCurrency(total)})</h3>
          <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add Expense'}</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Amount *</label><input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="form-group"><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group">
                <label>Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Date</label><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></div>
              <div className="form-group"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions"><button className="btn btn-secondary" type="submit">Save Expense</button></div>
          </form>
        )}
      </div>
      <div className="panel table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}><td>{formatDate(e.expenseDate)}</td><td>{e.category}</td><td>{e.description}</td><td>{formatCurrency(e.amount)}</td><td>{e.paymentMethod}</td></tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5}>No expenses recorded</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
