import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PAYMENT_STATUSES, formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';

const RANGES = [['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom Date']];

export default function Sales() {
  const { isAdmin } = useAuth();
  const [range, setRange] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');

  const [filters, setFilters] = useState({ search: '', from: '', to: '', paymentStatus: '', customerId: '' });
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSummary = () => {
    if (range === 'custom' && !custom.from) return;
    setSummaryError('');
    api.get('/sales/summary', { params: range === 'custom' ? { range, ...custom } : { range } })
      .then((res) => setSummary(res.data))
      .catch((err) => setSummaryError(err.response?.data?.message || 'Could not load the sales summary.'));
  };

  const loadSales = () => {
    setLoading(true);
    setError('');
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/sales', { params })
      .then((res) => setSales(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load sales.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); }, [range, custom.from, custom.to]);
  useEffect(() => { loadSales(); }, [filters.paymentStatus, filters.customerId]);
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {}); }, []);

  const cancelSale = async (sale) => {
    if (!window.confirm(`Cancel ${sale.saleNumber}? Its invoice will be cancelled and stock restored.`)) return;
    try {
      await api.post(`/sales/${sale.id}/cancel`);
      setNotice(`${sale.saleNumber} cancelled and stock restored.`);
      loadSales();
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel the sale.');
    }
  };

  const cards = summary && [
    { label: "Today's Sales", value: summary.todaySales },
    { label: "Today's Revenue", value: formatCurrency(summary.todayRevenue) },
    { label: 'Total Sales', value: summary.totalSales },
    { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue), cls: 'success' },
    { label: 'Paid Sales', value: summary.paid, cls: 'success' },
    { label: 'Partially Paid', value: summary.partiallyPaid, cls: 'warn' },
    { label: 'Pending Payments', value: summary.pending, cls: 'warn' },
    { label: 'Overdue Payments', value: summary.overdue, cls: summary.overdue ? 'danger' : '' },
  ];

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Sales Dashboard</h3>
          <Link className="btn btn-secondary" to="/admin/sales/new">+ New Sale</Link>
        </div>
        <div className="search-bar" style={{ marginTop: 14 }}>
          {RANGES.map(([key, label]) => (
            <button key={key} type="button" className={`btn btn-sm ${range === key ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setRange(key)}>{label}</button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" aria-label="From date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <input type="date" aria-label="To date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </>
          )}
        </div>
        {summaryError && <div className="error-text">{summaryError}</div>}
        {!summary && !summaryError && <div className="empty-state">Loading summary...</div>}
        {cards && <div className="cards-grid">{cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.cls || ''}`}><div className="label">{c.label}</div><div className="value">{c.value}</div></div>
        ))}</div>}
      </div>

      {summary && (
        <div className="grid-2">
          <div className="panel">
            <h3>Daily Sales</h3>
            {summary.daily.length === 0 ? <div className="empty-state">No sales in this period</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.daily}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} /><YAxis allowDecimals={false} />
                  <Tooltip /><Bar dataKey="sales" name="Sales" fill="#111827" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="panel">
            <h3>Revenue</h3>
            {summary.daily.length === 0 ? <div className="empty-state">No revenue in this period</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={summary.daily}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} /><YAxis />
                  <Tooltip formatter={(v) => formatCurrency(v)} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#DC2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3>Monthly Sales ({new Date().getFullYear()})</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.monthly}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis yAxisId="l" allowDecimals={false} /><YAxis yAxisId="r" orientation="right" />
                <Tooltip formatter={(v, n) => (n === 'Revenue' ? formatCurrency(v) : v)} /><Legend />
                <Bar yAxisId="l" dataKey="sales" name="Sales" fill="#111827" /><Bar yAxisId="r" dataKey="revenue" name="Revenue" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Sales List</h3>
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); loadSales(); }}>
          <input placeholder="Sale no, customer, mobile, vehicle" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input type="date" aria-label="From date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" aria-label="To date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <select aria-label="Customer" value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}>
            <option value="">All customers</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
          </select>
          <select aria-label="Payment status" value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
            <option value="">All payment status</option>{[...PAYMENT_STATUSES, 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-outline" type="submit">Filter</button>
        </form>
        {notice && <div className="success-text">{notice}</div>}
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Sale No</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Vehicle</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.saleNumber}</td>
                  <td>{formatDate(s.saleDate)}</td>
                  <td>{s.customer?.name}</td>
                  <td>{s.customer?.phone}</td>
                  <td>{s.vehicle?.vehicleNumber || '-'}</td>
                  <td>{formatCurrency(s.total)}</td>
                  <td>{formatCurrency(s.amountPaid)}</td>
                  <td>{formatCurrency(s.balance)}</td>
                  <td><span className={statusBadgeClass(s.paymentStatus)}>{s.paymentStatus}</span></td>
                  <td>
                    <div className="form-actions" style={{ flexWrap: 'wrap', marginTop: 0 }}>
                      <Link className="btn btn-outline btn-sm" to={`/admin/sales/${s.id}`}>View</Link>
                      {s.status === 'ACTIVE' && <Link className="btn btn-outline btn-sm" to={`/admin/sales/${s.id}?edit=1`}>Edit</Link>}
                      {s.invoice && <Link className="btn btn-outline btn-sm" to={`/admin/invoices/${s.invoice.id}`}>View Invoice</Link>}
                      {s.invoice && s.status === 'ACTIVE' && s.balance > 0 && <Link className="btn btn-outline btn-sm" to={`/admin/invoices/${s.invoice.id}?pay=1`}>Payment</Link>}
                      {isAdmin && s.status === 'ACTIVE' && <button className="btn btn-danger btn-sm" onClick={() => cancelSale(s)}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={10}>Loading...</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan={10}>No sales found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
