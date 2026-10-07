import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [tab, setTab] = useState('invoices');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/customers/${id}`).then((res) => setCustomer(res.data)).catch((err) => setError(err.response?.data?.message || 'Could not load the customer.'));
  }, [id]);

  if (error) return <div className="panel"><div className="error-text">{error}</div><Link className="btn btn-outline" to="/admin/customers">Back to Customers</Link></div>;
  if (!customer) return <div className="empty-state">Loading...</div>;

  const stats = customer.stats || { totalPurchases: 0, totalSpent: 0, totalPaid: 0, totalOutstanding: 0 };
  const lastPurchase = customer.invoices?.[0]?.invoiceDate;

  return (
    <div>
      <div className="panel">
        <h3>{customer.name} <span className="badge badge-info">{customer.customerCode}</span></h3>
        <div className="grid-3">
          <div><strong>Phone:</strong> {customer.phone}</div>
          <div><strong>Alternate Phone:</strong> {customer.altPhone || '-'}</div>
          <div><strong>Vehicle:</strong> {customer.vehicles?.map((vehicle) => `${vehicle.vehicleNumber}${vehicle.model ? ` (${vehicle.model})` : ''}`).join(', ') || '-'}</div>
          <div><strong>Email:</strong> {customer.email || '-'}</div>
          <div><strong>GST Number:</strong> {customer.gstin || '-'}</div>
          <div><strong>Customer Since:</strong> {formatDate(customer.createdAt)}</div>
          <div><strong>Last Purchase:</strong> {lastPurchase ? formatDate(lastPurchase) : '-'}</div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="stat-card"><div className="label">Total Purchases</div><div className="value">{stats.totalPurchases}</div></div>
        <div className="stat-card"><div className="label">Total Amount Spent</div><div className="value">{formatCurrency(stats.totalSpent)}</div></div>
        <div className="stat-card success"><div className="label">Total Amount Paid</div><div className="value">{formatCurrency(stats.totalPaid)}</div></div>
        <div className={`stat-card ${stats.totalOutstanding ? 'danger' : ''}`}><div className="label">Total Outstanding</div><div className="value">{formatCurrency(stats.totalOutstanding)}</div></div>
      </div>

      <div className="tabs">
        {['invoices', 'overview', 'vehicles', 'warranties', 'payments'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'invoices' ? 'Purchase History' : t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="panel">
          <p><strong>Address:</strong> {customer.address || '-'}, {customer.pincode || ''}</p>
          <p><strong>Customer Type:</strong> {customer.customerType}</p>
          <p><strong>Notes:</strong> {customer.notes || '-'}</p>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Vehicle No</th><th>Type</th><th>Brand</th><th>Model</th><th>Year</th></tr></thead>
            <tbody>
              {customer.vehicles.map((v) => (
                <tr key={v.id}><td>{v.vehicleNumber}</td><td>{v.vehicleType}</td><td>{v.brand}</td><td>{v.model}</td><td>{v.year}</td></tr>
              ))}
              {customer.vehicles.length === 0 && <tr><td colSpan={5}>No vehicles registered</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Sale No</th><th>Invoice No</th><th>Date</th><th>Tyres / Products</th><th>Qty</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {customer.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.sale ? <Link to={`/admin/sales/${inv.saleId}`}>{inv.sale.saleNumber}</Link> : '-'}</td>
                  <td>{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>{inv.items.map((item) => `${item.product?.brand || ''} ${item.product?.name || ''}${item.product?.size ? ` (${item.product.size})` : ''}`.trim()).join(', ') || '-'}</td>
                  <td>{inv.items.reduce((quantity, item) => quantity + item.quantity, 0)}</td>
                  <td>{formatCurrency(inv.grandTotal)}</td>
                  <td>{formatCurrency(inv.paidAmount)}</td>
                  <td>{formatCurrency(inv.dueAmount)}</td>
                  <td><span className={statusBadgeClass(inv.displayStatus)}>{inv.displayStatus}</span></td>
                  <td><Link className="btn btn-outline btn-sm" to={`/admin/invoices/${inv.id}`}>Open Invoice</Link></td>
                </tr>
              ))}
              {customer.invoices.length === 0 && <tr><td colSpan={10}>No purchases yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'warranties' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Warranty Code</th><th>Product</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {customer.warranties.map((w) => (
                <tr key={w.id}>
                  <td>{w.warrantyCode}</td><td>{w.product?.name}</td><td>{formatDate(w.warrantyStart)}</td><td>{formatDate(w.warrantyEnd)}</td>
                  <td><span className={statusBadgeClass(w.status)}>{w.status}</span></td>
                </tr>
              ))}
              {customer.warranties.length === 0 && <tr><td colSpan={5}>No warranties</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {customer.payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.paidAt)}</td><td>{formatCurrency(p.amount)}</td><td>{p.method}</td>
                  <td><span className={statusBadgeClass(p.status)}>{p.status}</span></td>
                </tr>
              ))}
              {customer.payments.length === 0 && <tr><td colSpan={4}>No payments recorded</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
