import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatDateTime, statusBadgeClass } from '../utils/format.js';

export default function WarrantyDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [warranty, setWarranty] = useState(null);
  const [products, setProducts] = useState([]);
  const [claimReason, setClaimReason] = useState('');
  const [claimId, setClaimId] = useState('');
  const [replacementProductId, setReplacementProductId] = useState('');
  const [replacementSerial, setReplacementSerial] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [wRes, pRes] = await Promise.all([api.get(`/warranties/${id}`), api.get('/products')]);
    setWarranty(wRes.data);
    setProducts(pRes.data);
  };
  useEffect(() => { load().catch((err) => setError(err.response?.data?.message || 'Unable to load warranty')); }, [id]);

  const action = async (path, body, label, method = 'post') => {
    setBusy(label); setError(''); setMessage('');
    try {
      await api[method](path, body);
      setMessage(`${label} completed.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${label.toLowerCase()}`);
    } finally { setBusy(''); }
  };

  if (!warranty) return <div className="empty-state">Loading...</div>;
  const openClaim = warranty.claims.find((c) => c.status === 'OPEN');
  const returnRecord = warranty.returns[0];

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3>Warranty {warranty.warrantyCode}</h3>
          <div className="form-actions">
            <span className={statusBadgeClass(warranty.status)}>{warranty.status}</span>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <div className="grid-3">
          <div><strong>Customer:</strong> {warranty.customer?.name}<br /><small>{warranty.customer?.phone}</small></div>
          <div><strong>Vehicle:</strong> {warranty.vehicle?.vehicleNumber || '-'}</div>
          <div><strong>Product:</strong> {warranty.product?.name}</div>
          <div><strong>Serial Number:</strong> {warranty.serialNumber || '-'}</div>
          <div><strong>Purchase Date:</strong> {formatDate(warranty.purchaseDate)}</div>
          <div><strong>Warranty:</strong> {warranty.warrantyType} · {warranty.warrantyDuration} months</div>
          <div><strong>Start:</strong> {formatDate(warranty.warrantyStart)}</div>
          <div><strong>End:</strong> {formatDate(warranty.warrantyEnd)}</div>
          <div><strong>Invoice:</strong> {warranty.invoice?.invoiceNumber || '-'}</div>
        </div>
        <p><strong>Terms:</strong> {warranty.warrantyTerms || 'As per manufacturer warranty policy.'}</p>
      </div>

      {isAdmin && (
        <div className="grid-2">
          <div className="panel">
            <h3>File Claim</h3>
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); action(`/warranties/${id}/claims`, { reason: claimReason }, 'Claim filed'); }}>
              <div className="form-group"><label>Reason</label><textarea required value={claimReason} onChange={(e) => setClaimReason(e.target.value)} /></div>
              <button className="btn btn-secondary" disabled={busy}>{busy || 'Submitting...'}</button>
            </form>
          </div>
          <div className="panel">
            <h3>Process Approved Claim</h3>
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); action(`/warranties/${id}/replacements`, { claimId: Number(claimId), productId: Number(replacementProductId), serialNumber: replacementSerial, replacementReason: 'Warranty approved replacement' }, 'Replacement processed'); }}>
              <div className="form-group"><label>Approved claim</label><select value={claimId} onChange={(e) => setClaimId(e.target.value)}><option value="">Select claim</option>{warranty.claims.filter((c) => c.status === 'APPROVED').map((c) => <option key={c.id} value={c.id}>#{c.id} · {formatDate(c.claimDate)}</option>)}</select></div>
              <div className="form-group"><label>Replacement product</label><select value={replacementProductId} onChange={(e) => setReplacementProductId(e.target.value)}><option value="">Select product</option>{products.filter((p) => p.status === 'ACTIVE').map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
              <div className="form-group"><label>Replacement serial</label><input required value={replacementSerial} onChange={(e) => setReplacementSerial(e.target.value)} /></div>
              <button className="btn btn-success" disabled={busy}>{busy || 'Replace tyre'}</button>
            </form>
          </div>
        </div>
      )}

      {isAdmin && openClaim && (
        <div className="panel">
          <h3>Claim #{openClaim.id} · {openClaim.status}</h3>
          <p>{openClaim.reason}</p>
          <div className="form-actions">
            <button className="btn btn-success" onClick={() => action(`/warranties/${id}/claims/${openClaim.id}/approve`, { resolution: 'Claim approved for resolution' }, 'Claim approved', 'patch')}>Approve</button>
            <button className="btn btn-danger" onClick={() => action(`/warranties/${id}/claims/${openClaim.id}/reject`, { resolution: 'Claim rejected' }, 'Claim rejected', 'patch')}>Reject</button>
          </div>
        </div>
      )}

      {isAdmin && !returnRecord && (
        <div className="panel">
          <h3>Process Approved Return</h3>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); action(`/warranties/${id}/returns`, { claimId: Number(claimId), returnDate, reason: returnReason, paymentMethod: 'Original Payment' }, 'Return processed'); }}>
            <div className="form-group"><label>Approved claim</label><select required value={claimId} onChange={(e) => setClaimId(e.target.value)}><option value="">Select claim</option>{warranty.claims.filter((c) => c.status === 'APPROVED').map((c) => <option key={c.id} value={c.id}>#{c.id} · {formatDate(c.claimDate)}</option>)}</select></div>
            <div className="form-group"><label>Return date</label><input required type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
            <div className="form-group"><label>Return reason</label><textarea required value={returnReason} onChange={(e) => setReturnReason(e.target.value)} /></div>
            <button className="btn btn-danger" disabled={busy}>{busy || 'Receive return'}</button>
          </form>
        </div>
      )}

      {message && <div className="success-text">{message}</div>}
      {error && <div className="error-text">{error}</div>}

      <div className="panel">
        <h3>Events & History</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Event</th><th>Details</th><th>Actor</th></tr></thead>
            <tbody>
              {warranty.claims.map((c) => <tr key={c.id}><td>{formatDateTime(c.claimDate)}</td><td>{c.status} claim</td><td>{c.reason}<br />{c.resolution || ''}</td><td>{c.claimedByUser?.name || '-'}</td></tr>)}
              {warranty.replacements.map((r) => <tr key={r.id}><td>{formatDate(r.replacementDate)}</td><td>Replacement installed</td><td>{r.product?.name} · {r.serialNumber}<br />{r.replacementReason}</td><td>-</td></tr>)}
              {warranty.returns.map((r) => <tr key={r.id}><td>{formatDate(r.returnDate)}</td><td>{r.status} return</td><td>{r.reason} · {r.refundAmount} refund<br />{r.notes || ''}</td><td>-</td></tr>)}
              {warranty.claims.length === 0 && warranty.replacements.length === 0 && warranty.returns.length === 0 && <tr><td colSpan={4}>No warranty events recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
