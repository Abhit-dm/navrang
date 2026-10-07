import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadInvoicePdf } from '../utils/download.js';
import { PAYMENT_STATUSES, formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';

export default function Invoices() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', customerId: '', paymentStatus: '', isGst: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadSummary = () => api.get('/invoices/summary').then((res) => setSummary(res.data)).catch(() => {});

  const load = () => {
    setLoading(true);
    setError('');
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/invoices', { params })
      .then((res) => setInvoices(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load invoices.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [filters.paymentStatus, filters.customerId, filters.isGst]);

  const cancelInvoice = async (inv) => {
    if (!window.confirm(`Cancel ${inv.invoiceNumber}? The linked sale is cancelled and stock is restored. This cannot be undone.`)) return;
    try {
      await api.post(`/invoices/${inv.id}/cancel`);
      setNotice(`${inv.invoiceNumber} cancelled.`);
      load();
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel the invoice.');
    }
  };

  const pdf = async (inv) => {
    setBusyId(inv.id);
    try { await downloadInvoicePdf(inv.id, inv.invoiceNumber); } catch { setError('Could not download the PDF.'); } finally { setBusyId(null); }
  };

  const cards = summary && [
    { label: 'Total Invoices', value: summary.totalInvoices },
    { label: 'Total Invoice Amount', value: formatCurrency(summary.totalAmount) },
    { label: 'Paid Invoices', value: summary.paid, cls: 'success' },
    { label: 'Pending Invoices', value: summary.pending, cls: 'warn' },
    { label: 'Partially Paid', value: summary.partiallyPaid, cls: 'warn' },
    { label: 'Overdue', value: summary.overdue, cls: summary.overdue ? 'danger' : '' },
    { label: 'Amount Received', value: formatCurrency(summary.received), cls: 'success' },
    { label: 'Total Outstanding', value: formatCurrency(summary.outstanding), cls: summary.outstanding ? 'danger' : '' },
  ];

  return (
    <div>
      {cards && <div className="cards-grid">{cards.map((c) => (
        <div key={c.label} className={`stat-card ${c.cls || ''}`}><div className="label">{c.label}</div><div className="value">{c.value}</div></div>
      ))}</div>}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Invoices</h3>
          <Link className="btn btn-secondary" to="/admin/sales/new">+ New Sale</Link>
        </div>
        <form className="search-bar" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input placeholder="Invoice no, customer, mobile, vehicle" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input type="date" aria-label="From date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" aria-label="To date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          <select aria-label="Customer" value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}>
            <option value="">All customers</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
          </select>
          <select aria-label="Payment status" value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
            <option value="">All payment status</option>{[...PAYMENT_STATUSES, 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Invoice type" value={filters.isGst} onChange={(e) => setFilters({ ...filters, isGst: e.target.value })}>
            <option value="">GST & Non-GST</option><option value="true">GST Only</option><option value="false">Non-GST Only</option>
          </select>
          <button className="btn btn-outline" type="submit">Filter</button>
        </form>
        {notice && <div className="success-text">{notice}</div>}
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Vehicle</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>{inv.customer?.name}</td>
                  <td>{inv.customer?.phone}</td>
                  <td>{inv.vehicle?.vehicleNumber || '-'}</td>
                  <td>{formatCurrency(inv.grandTotal)}</td>
                  <td>{formatCurrency(inv.paidAmount)}</td>
                  <td>{formatCurrency(inv.dueAmount)}</td>
                  <td><span className={statusBadgeClass(inv.displayStatus)}>{inv.displayStatus}</span></td>
                  <td>
                    <div className="form-actions" style={{ flexWrap: 'wrap', marginTop: 0 }}>
                      <Link className="btn btn-outline btn-sm" to={`/admin/invoices/${inv.id}`}>View</Link>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/invoices/${inv.id}?print=1`)}>Print</button>
                      <button className="btn btn-outline btn-sm" disabled={busyId === inv.id} onClick={() => pdf(inv)}>{busyId === inv.id ? '...' : 'PDF'}</button>
                      {inv.status === 'ACTIVE' && inv.dueAmount > 0 && <Link className="btn btn-outline btn-sm" to={`/admin/invoices/${inv.id}?pay=1`}>Payment</Link>}
                      {isAdmin && inv.status === 'ACTIVE' && <button className="btn btn-danger btn-sm" onClick={() => cancelInvoice(inv)}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={10}>Loading...</td></tr>}
              {!loading && invoices.length === 0 && <tr><td colSpan={10}>No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
