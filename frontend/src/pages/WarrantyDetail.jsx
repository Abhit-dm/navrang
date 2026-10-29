import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatDateTime, statusBadgeClass } from '../utils/format.js';
import { addWarrantyDuration, warrantyDurationLabel } from '../utils/warranty.js';

const dateInput = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

export default function WarrantyDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [warranty, setWarranty] = useState(null);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
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
    const [wRes, pRes, sRes] = await Promise.all([api.get(`/warranties/${id}`), api.get('/products'), api.get('/settings')]);
    setWarranty(wRes.data);
    setProducts(pRes.data);
    setSettings(sRes.data || {});
    setForm({
      status: wRes.data.status === 'NO WARRANTY' ? 'NONE' : 'APPLICABLE',
      startDate: dateInput(wRes.data.warrantyStart),
      endDate: dateInput(wRes.data.warrantyEnd),
      years: wRes.data.warrantyYears ?? Math.floor(Number(wRes.data.warrantyDuration || 0) / 12),
      months: wRes.data.warrantyMonths ?? Number(wRes.data.warrantyDuration || 0) % 12,
      days: wRes.data.warrantyDays || 0,
      terms: wRes.data.warrantyTerms || '',
    });
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
  const hasHistory = warranty.claims.length > 0 || warranty.returns.length > 0 || warranty.replacements.length > 0;
  const durationLabel = warrantyDurationLabel(warranty);

  const saveWarranty = async (e) => {
    e.preventDefault();
    setBusy('Saving warranty'); setError(''); setMessage('');
    try {
      await api.put(`/warranties/${id}`, form);
      setEditing(false);
      setMessage('Warranty updated.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update warranty.');
    } finally {
      setBusy('');
    }
  };

  const updateForm = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value };
    if (field !== 'endDate') next.endDate = addWarrantyDuration(next.startDate, next.years, next.months, next.days);
    if (field === 'status' && value === 'NONE') next.endDate = next.startDate;
    return next;
  });

  return (
    <div className="warranty-detail">
      <div className="panel warranty-certificate">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="warranty-business">
            {settings.logoUrl && <img className="warranty-business-logo" src={settings.logoUrl} alt={`${settings.businessName || 'Navrang Tyres'} logo`} />}
            <div>
              <h2>{settings.businessName || 'NAVRANG TYRES'}</h2>
              <div>{settings.tagline || 'Quality Tyres. Trusted Service.'}</div>
              {settings.address && <div>{settings.address}</div>}
              <div>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div className="form-actions no-print">
            <span className={statusBadgeClass(warranty.computedStatus)}>{warranty.computedStatus}</span>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>Print</button>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setEditing((value) => !value)}>{editing ? 'Close Editor' : 'Edit Warranty'}</button>}
          </div>
        </div>
        <div className="warranty-certificate-title">
          <h1>Product Warranty Certificate</h1>
          <div>Certificate {warranty.warrantyCode}</div>
        </div>
        <div className="warranty-certificate-grid">
          <div><strong>Customer Name</strong><span>{warranty.customer?.name || '-'}</span></div>
          <div><strong>Mobile Number</strong><span>{warranty.customer?.phone || '-'}</span></div>
          <div><strong>Product</strong><span>{warranty.product?.name || '-'}</span></div>
          <div><strong>Brand / Model</strong><span>{[warranty.product?.brand, warranty.product?.pattern].filter(Boolean).join(' / ') || '-'}</span></div>
          <div><strong>Invoice Number</strong><span>{warranty.invoice?.invoiceNumber || '-'}</span></div>
          <div><strong>Sale Number</strong><span>{warranty.sale?.saleNumber || '-'}</span></div>
          <div><strong>Warranty Duration</strong><span>{durationLabel}</span></div>
          <div><strong>Warranty Status</strong><span>{warranty.computedStatus}</span></div>
          <div><strong>Warranty Start Date</strong><span>{formatDate(warranty.warrantyStart)}</span></div>
          <div><strong>Warranty Expiry Date</strong><span>{warranty.computedStatus === 'NO WARRANTY' ? '-' : formatDate(warranty.warrantyEnd)}</span></div>
          <div><strong>Vehicle</strong><span>{warranty.vehicle?.vehicleNumber || '-'}</span></div>
          <div><strong>Serial Number</strong><span>{warranty.serialNumber || '-'}</span></div>
        </div>
        <div className="warranty-terms"><strong>Warranty terms and conditions</strong><p>{warranty.warrantyTerms || 'As per manufacturer warranty policy.'}</p></div>
      </div>

      {isAdmin && editing && form && (
        <div className="panel no-print">
          <h3>Edit Warranty</h3>
          <form onSubmit={saveWarranty}>
            <div className="form-grid">
              <div className="form-group">
                <label>Warranty Status</label>
                <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                  <option value="APPLICABLE">Warranty Applicable</option>
                  <option value="NONE" disabled={hasHistory}>No Warranty{hasHistory ? ' (history exists)' : ''}</option>
                </select>
              </div>
              {form.status === 'APPLICABLE' && (
                <>
                  <div className="warranty-duration-inputs">
                    <label>Warranty Duration</label>
                    <div className="warranty-duration-fields">
                      <input aria-label="Warranty years" placeholder="Years" type="number" min="0" max="100" step="1" value={form.years} onChange={(e) => updateForm('years', e.target.value)} />
                      <input aria-label="Warranty months" placeholder="Months" type="number" min="0" max="1200" step="1" value={form.months} onChange={(e) => updateForm('months', e.target.value)} />
                      <input aria-label="Warranty days" placeholder="Days" type="number" min="0" max="36500" step="1" value={form.days} onChange={(e) => updateForm('days', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group"><label>Warranty Start Date</label><input required type="date" value={form.startDate} onChange={(e) => updateForm('startDate', e.target.value)} /></div>
                  <div className="form-group"><label>Warranty Expiry Date</label><input required type="date" min={form.startDate} value={form.endDate} onChange={(e) => updateForm('endDate', e.target.value)} /></div>
                </>
              )}
              <div className="form-group"><label>Warranty Notes / Terms</label><textarea maxLength={2000} value={form.terms} onChange={(e) => updateForm('terms', e.target.value)} /></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" type="submit" disabled={Boolean(busy)}>{busy || 'Save Warranty'}</button>
              <button className="btn btn-outline" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && warranty.computedStatus !== 'NO WARRANTY' && warranty.computedStatus !== 'EXPIRED' && (
        <div className="grid-2 no-print">
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
        <div className="panel no-print">
          <h3>Claim #{openClaim.id} · {openClaim.status}</h3>
          <p>{openClaim.reason}</p>
          <div className="form-actions">
            <button className="btn btn-success" onClick={() => action(`/warranties/${id}/claims/${openClaim.id}/approve`, { resolution: 'Claim approved for resolution' }, 'Claim approved', 'patch')}>Approve</button>
            <button className="btn btn-danger" onClick={() => action(`/warranties/${id}/claims/${openClaim.id}/reject`, { resolution: 'Claim rejected' }, 'Claim rejected', 'patch')}>Reject</button>
          </div>
        </div>
      )}

      {isAdmin && !returnRecord && (
        <div className="panel no-print">
          <h3>Process Approved Return</h3>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); action(`/warranties/${id}/returns`, { claimId: Number(claimId), returnDate, reason: returnReason, paymentMethod: 'Original Payment' }, 'Return processed'); }}>
            <div className="form-group"><label>Approved claim</label><select required value={claimId} onChange={(e) => setClaimId(e.target.value)}><option value="">Select claim</option>{warranty.claims.filter((c) => c.status === 'APPROVED').map((c) => <option key={c.id} value={c.id}>#{c.id} · {formatDate(c.claimDate)}</option>)}</select></div>
            <div className="form-group"><label>Return date</label><input required type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
            <div className="form-group"><label>Return reason</label><textarea required value={returnReason} onChange={(e) => setReturnReason(e.target.value)} /></div>
            <button className="btn btn-danger" disabled={busy}>{busy || 'Receive return'}</button>
          </form>
        </div>
      )}

      {(message || error) && <div className={`no-print ${error ? 'error-text' : 'success-text'}`} role={error ? 'alert' : 'status'}>{error || message}</div>}

      <div className="panel no-print">
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
