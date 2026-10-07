import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import SupplierFormModal from '../components/SupplierFormModal.jsx';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';

const FILTERS = [['', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null); // { supplier? } for add/edit
  const [detail, setDetail] = useState(null); // { supplier, purchases, stats } for view/history
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = (q = search, s = status) => {
    setLoading(true);
    setError('');
    api.get('/suppliers', { params: { search: q || undefined, status: s || undefined } })
      .then((res) => setSuppliers(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load suppliers.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const openDetail = async (supplier) => {
    setDetailLoading(true);
    setDetail({ supplier, purchases: [], stats: null });
    try {
      const { data } = await api.get(`/suppliers/${supplier.id}`);
      const { purchases, stats, ...rest } = data;
      setDetail({ supplier: rest, purchases, stats });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load supplier details.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleStatus = async (s) => {
    const next = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const message = next === 'INACTIVE'
      ? `Deactivate ${s.name}? They will no longer appear when creating new purchases. Past purchases are kept.`
      : `Activate ${s.name}?`;
    if (!window.confirm(message)) return;
    setBusyId(s.id);
    setNotice('');
    try {
      await api.patch(`/suppliers/${s.id}/status`, { status: next });
      setNotice(`${s.name} is now ${next === 'ACTIVE' ? 'active' : 'inactive'}.`);
      load();
      if (detail?.supplier.id === s.id) setDetail({ ...detail, supplier: { ...detail.supplier, status: next } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the status.');
    } finally {
      setBusyId(null);
    }
  };

  const saved = (supplier) => {
    setNotice(`${supplier.name} ${modal?.supplier ? 'updated' : 'added'} (${supplier.supplierCode}).`);
    setModal(null);
    load();
    if (detail?.supplier.id === supplier.id) openDetail(supplier);
  };

  const d = detail?.supplier;
  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Suppliers</h3>
          <button className="btn btn-secondary" onClick={() => setModal({})}>+ Add New Supplier</button>
        </div>
        <form className="search-bar" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input placeholder="Search name, company, mobile or GST number" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-outline" type="submit">Search</button>
        </form>
        {notice && <div className="success-text">{notice}</div>}
        {error && <div className="error-text" role="alert">{error}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Supplier ID</th><th>Supplier Name</th><th>Company</th><th>Mobile</th><th>Alternate</th><th>Email</th><th>GST Number</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.supplierCode || `#${s.id}`}</td>
                  <td>{s.name}</td>
                  <td>{s.companyName || '-'}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.altPhone || '-'}</td>
                  <td>{s.email || '-'}</td>
                  <td>{s.gstin || '-'}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{[s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ') || '-'}</td>
                  <td><span className={statusBadgeClass(s.status)}>{s.status}</span></td>
                  <td>
                    <div className="form-actions" style={{ flexWrap: 'wrap', marginTop: 0 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openDetail(s)}>View</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ supplier: s })}>Edit</button>
                      <button className={`btn btn-sm ${s.status === 'ACTIVE' ? 'btn-danger' : 'btn-secondary'}`} disabled={busyId === s.id} onClick={() => toggleStatus(s)}>
                        {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={10}>Loading...</td></tr>}
              {!loading && suppliers.length === 0 && <tr><td colSpan={10}>{search || status ? 'No suppliers match your search' : 'No suppliers yet. Add your first supplier.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="panel" id="supplier-detail">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{d.name} {d.supplierCode && <span className="badge badge-info">{d.supplierCode}</span>} <span className={statusBadgeClass(d.status)}>{d.status}</span></h3>
            <button className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="grid-3" style={{ marginTop: 12 }}>
            <div><strong>Company:</strong> {d.companyName || '-'}</div>
            <div><strong>Contact Person:</strong> {d.contactPerson || '-'}</div>
            <div><strong>Mobile:</strong> {d.phone || '-'}</div>
            <div><strong>Alternate:</strong> {d.altPhone || '-'}</div>
            <div><strong>Email:</strong> {d.email || '-'}</div>
            <div><strong>GST Number:</strong> {d.gstin || '-'}</div>
            <div><strong>Address:</strong> {[d.address, d.city, d.state, d.pincode].filter(Boolean).join(', ') || '-'}</div>
            <div><strong>Notes:</strong> {d.notes || '-'}</div>
            <div><strong>Added:</strong> {d.createdAt ? formatDate(d.createdAt) : '-'}</div>
          </div>

          <h4 style={{ marginBottom: 8 }}>Purchase History</h4>
          {detailLoading && <div className="empty-state">Loading...</div>}
          {detail.stats && (
            <>
              <div className="cards-grid">
                <div className="stat-card"><div className="label">Total Purchases</div><div className="value">{detail.stats.totalPurchases}</div></div>
                <div className="stat-card"><div className="label">Total Purchase Amount</div><div className="value">{formatCurrency(detail.stats.totalAmount)}</div></div>
                <div className="stat-card success"><div className="label">Total Paid</div><div className="value">{formatCurrency(detail.stats.totalPaid)}</div></div>
                <div className={`stat-card ${detail.stats.totalOutstanding ? 'danger' : ''}`}><div className="label">Total Outstanding</div><div className="value">{formatCurrency(detail.stats.totalOutstanding)}</div></div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Purchase No</th><th>Purchase Date</th><th>Items</th><th>Total Amount</th><th>Amount Paid</th><th>Balance</th><th>Payment Status</th></tr></thead>
                  <tbody>
                    {detail.purchases.map((p) => (
                      <tr key={p.id}>
                        <td>{p.purchaseNumber}</td><td>{formatDate(p.purchaseDate)}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{p.items.map((i) => `${i.product?.name || 'Item'} × ${i.quantity}`).join(', ')}</td>
                        <td>{formatCurrency(p.total)}</td><td>{formatCurrency(Math.min(p.paidAmount, p.total))}</td><td>{formatCurrency(p.balance)}</td>
                        <td><span className={statusBadgeClass(p.paymentStatus)}>{p.paymentStatus}</span></td>
                      </tr>
                    ))}
                    {detail.purchases.length === 0 && <tr><td colSpan={7}>No purchases from this supplier yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {modal && <SupplierFormModal supplier={modal.supplier} onSaved={saved} onClose={() => setModal(null)} />}
    </div>
  );
}
