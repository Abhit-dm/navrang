import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { PAYMENT_METHODS, formatCurrency, formatDate, formatDateTime, statusBadgeClass } from '../utils/format.js';

const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function SaleView() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = params.get('edit') === '1';

  const load = () => api.get(`/sales/${id}`)
    .then((res) => {
      setSale(res.data);
      setForm({
        paymentMethod: res.data.paymentMethod || '', saleDate: dateInput(res.data.saleDate),
        dueDate: dateInput(res.data.invoice?.dueDate), notes: res.data.notes || '',
      });
    })
    .catch((err) => setError(err.response?.data?.message || 'Could not load the sale.'));

  useEffect(() => { load(); }, [id]);

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      await api.put(`/sales/${id}`, { ...form, paymentMethod: form.paymentMethod || undefined });
      await load();
      setMessage('Sale updated.');
      setParams({}, { replace: true });
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not update the sale.');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="panel"><div className="error-text">{error}</div><Link className="btn btn-outline" to="/admin/sales">Back to Sales</Link></div>;
  if (!sale) return <div className="empty-state">Loading sale...</div>;

  const inv = sale.invoice;

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{sale.saleNumber} <span className={statusBadgeClass(sale.paymentStatus)}>{sale.paymentStatus}</span></h3>
          <div className="form-actions" style={{ marginTop: 0 }}>
            <Link className="btn btn-outline btn-sm" to="/admin/sales">Back</Link>
            {sale.status === 'ACTIVE' && !editing && <button className="btn btn-outline btn-sm" onClick={() => setParams({ edit: '1' })}>Edit</button>}
            {inv && <Link className="btn btn-secondary btn-sm" to={`/admin/invoices/${inv.id}`}>View Invoice ({inv.invoiceNumber})</Link>}
            {inv && sale.status === 'ACTIVE' && sale.balance > 0 && <Link className="btn btn-outline btn-sm" to={`/admin/invoices/${inv.id}?pay=1`}>Add Payment</Link>}
          </div>
        </div>
        {message && <div className={message === 'Sale updated.' ? 'success-text' : 'error-text'}>{message}</div>}
        <div className="grid-3" style={{ marginTop: 14 }}>
          <div><strong>Sale Date:</strong> {formatDate(sale.saleDate)}</div>
          <div><strong>Customer:</strong> <Link to={`/admin/customers/${sale.customerId}`}>{sale.customer.name}</Link></div>
          <div><strong>Mobile:</strong> {sale.customer.phone}</div>
          <div><strong>Vehicle:</strong> {sale.vehicle ? `${sale.vehicle.vehicleNumber} ${sale.vehicle.model || ''}` : '-'}</div>
          <div><strong>Payment Method:</strong> {sale.paymentMethod || '-'}</div>
          <div><strong>Due Date:</strong> {inv?.dueDate ? formatDate(inv.dueDate) : '-'}</div>
          <div><strong>Created By:</strong> {sale.employee?.name || '-'}</div>
          <div><strong>Invoice Type:</strong> {sale.isGst ? 'GST' : 'Non-GST'}</div>
          <div><strong>Notes:</strong> {sale.notes || '-'}</div>
        </div>
      </div>

      {editing && form && (
        <div className="panel">
          <h3>Edit Sale</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Items and totals cannot be changed after a sale. To correct them, cancel this sale and create a new one.</p>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="form-group"><label>Sale Date</label><input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></div>
              <div className="form-group"><label>Payment Due Date</label><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div className="form-group">
                <label>Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="">Not set</option>
                  {[...new Set([...PAYMENT_METHODS, form.paymentMethod].filter(Boolean))].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              <button className="btn btn-outline" type="button" onClick={() => setParams({}, { replace: true })}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <h3>Items</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>#</th><th>Brand</th><th>Product</th><th>Model</th><th>Tyre Size</th><th>Qty</th><th>Price</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
            <tbody>
              {sale.items.map((i, idx) => (
                <tr key={i.id}>
                  <td>{idx + 1}</td><td>{i.product.brand || '-'}</td><td>{i.product.name}</td><td>{i.product.pattern || '-'}</td><td>{i.product.size || '-'}</td>
                  <td>{i.quantity}</td><td>{formatCurrency(i.sellingPrice)}</td><td>{formatCurrency(i.discount)}</td>
                  <td>{i.gstPercent ? `${i.gstPercent}%` : '-'}</td><td>{formatCurrency(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals-box" style={{ marginTop: 16 }}>
          <div className="row"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
          <div className="row"><span>Discount</span><span>-{formatCurrency(sale.discount)}</span></div>
          <div className="row"><span>Tax</span><span>{formatCurrency(sale.gstAmount)}</span></div>
          <div className="row grand"><span>Grand Total</span><span>{formatCurrency(sale.total)}</span></div>
          <div className="row"><span>Amount Paid</span><span>{formatCurrency(sale.amountPaid)}</span></div>
          <div className="row"><span>Balance</span><span>{formatCurrency(sale.balance)}</span></div>
        </div>
      </div>

      {inv?.payments?.length > 0 && (
        <div className="panel">
          <h3>Payments</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
              <tbody>{inv.payments.map((p) => <tr key={p.id}><td>{formatDateTime(p.paidAt)}</td><td>{formatCurrency(p.amount)}</td><td>{p.method}</td><td>{p.referenceNumber || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
