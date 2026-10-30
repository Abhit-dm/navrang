import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { formatDate, statusBadgeClass } from '../utils/format.js';
import { warrantyDurationLabel } from '../utils/warranty.js';

export default function Warranties() {
  const [warranties, setWarranties] = useState([]);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [status, setStatus] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [endFrom, setEndFrom] = useState('');
  const [endTo, setEndTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        startFrom, startTo, endFrom, endTo,
        customer: customerFilter, product: productFilter, invoiceNumber: invoiceFilter,
      };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get('/warranties', { params });
      setWarranties(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load warranty records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const active = warranties.filter((w) => w.computedStatus === 'ACTIVE').length;
  const expiring = warranties.filter((w) => w.computedStatus === 'EXPIRING SOON').length;
  const expired = warranties.filter((w) => w.computedStatus === 'EXPIRED').length;
  const claims = warranties.filter((w) => w.status === 'CLAIMED' || w.claimStatus === 'OPEN').length;
  const returns = warranties.reduce((sum, w) => sum + w.returns.length, 0);

  return (
    <div>
      <div className="cards-grid">
        <div className="stat-card success"><div className="label">Active warranties</div><div className="value">{active}</div></div>
        <div className="stat-card warn"><div className="label">Expiring soon</div><div className="value">{expiring}</div></div>
        <div className="stat-card danger"><div className="label">Expired warranties</div><div className="value">{expired}</div></div>
        <div className="stat-card warn"><div className="label">Open claims</div><div className="value">{claims}</div></div>
        <div className="stat-card"><div className="label">Return records</div><div className="value">{returns}</div></div>
      </div>
      <div className="panel">
        <h3>Warranty Management</h3>
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input aria-label="Search warranties" placeholder="Customer, mobile, product, invoice or sale number" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input aria-label="Filter by customer" placeholder="Customer / mobile filter" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
          <input aria-label="Filter by product" placeholder="Product / brand / model filter" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
          <input aria-label="Filter by invoice" placeholder="Invoice number filter" value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option><option value="EXPIRING SOON">Expiring soon</option>
            <option value="EXPIRED">Expired</option><option value="NO WARRANTY">No warranty</option>
            <option value="CLAIMED">Claimed</option><option value="REPLACED">Replaced</option><option value="RETURNED">Returned</option>
          </select>
          <button className="btn btn-outline" type="submit">Search</button>
          <Link className="btn btn-secondary" to="/admin/returns">Returns</Link>
          <div className="warranty-date-filters">
            <label>Start date from <input type="date" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} /></label>
            <label>to <input type="date" value={startTo} onChange={(e) => setStartTo(e.target.value)} /></label>
            <label>Expiry from <input type="date" value={endFrom} onChange={(e) => setEndFrom(e.target.value)} /></label>
            <label>to <input type="date" value={endTo} onChange={(e) => setEndTo(e.target.value)} /></label>
          </div>
        </form>
        {error && <div className="error-text" role="alert">{error}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Product / Model</th><th>Invoice / Sale</th><th>Start</th><th>Expires</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {warranties.map((w) => (
                <tr key={w.id}>
                  <td>{w.customer?.name}<br /><small>{w.customer?.phone}</small></td>
                  <td>{w.product?.name}<br /><small>{w.product?.brand || '-'}{w.product?.pattern ? ` · ${w.product.pattern}` : ''}</small></td>
                  <td>{w.invoice?.invoiceNumber || '-'}<br /><small>{w.sale?.saleNumber || '-'}</small></td>
                  <td>{formatDate(w.warrantyStart)}</td>
                  <td>{w.computedStatus === 'NO WARRANTY' ? '-' : formatDate(w.warrantyEnd)}</td>
                  <td>{warrantyDurationLabel(w)}</td>
                  <td><span className={statusBadgeClass(w.computedStatus)}>{w.computedStatus}</span></td>
                  <td><Link className="btn btn-outline btn-sm" to={`/admin/warranties/${w.id}`}>View / Edit / Print</Link></td>
                </tr>
              ))}
              {!loading && warranties.length === 0 && <tr><td colSpan={8}>No warranty records found</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <div className="empty-state">Loading warranty records...</div>}
      </div>
    </div>
  );
}
