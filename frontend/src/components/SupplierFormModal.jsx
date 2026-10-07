import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

const EMPTY = {
  name: '', phone: '', companyName: '', altPhone: '', email: '', gstin: '', contactPerson: '',
  address: '', city: '', state: '', pincode: '', notes: '', status: 'ACTIVE',
};
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function validate(f) {
  if (!f.name.trim()) return 'Supplier name is required.';
  if (!/^[0-9]{10}$/.test(f.phone.trim())) return 'Mobile number must be 10 digits.';
  if (f.altPhone.trim() && !/^[0-9]{10}$/.test(f.altPhone.trim())) return 'Alternate number must be 10 digits.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email address.';
  if (f.gstin.trim() && !GSTIN.test(f.gstin.trim().toUpperCase())) return 'Enter a valid 15-character GST number.';
  if (f.pincode.trim() && !/^[0-9]{6}$/.test(f.pincode.trim())) return 'Pincode must be 6 digits.';
  return '';
}

// Add/edit supplier dialog. Calls onSaved(supplier) after the server confirms; the caller decides what to do next.
export default function SupplierFormModal({ supplier, onSaved, onClose }) {
  const editing = !!supplier;
  const [form, setForm] = useState(() => (supplier ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, supplier[k] ?? EMPTY[k]])) : EMPTY));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const digits = (key) => (e) => setForm({ ...form, [key]: e.target.value.replace(/\D/g, '') });

  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form, gstin: form.gstin.trim().toUpperCase() };
      const { data } = editing ? await api.put(`/suppliers/${supplier.id}`, body) : await api.post('/suppliers', body);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the supplier. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={editing ? 'Edit Supplier' : 'Add New Supplier'}>
        <div className="modal-head">
          <h3>{editing ? `Edit Supplier${supplier.supplierCode ? ` · ${supplier.supplierCode}` : ''}` : 'Add New Supplier'}</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <div className="form-group"><label htmlFor="sp-name">Supplier Name *</label><input id="sp-name" autoFocus value={form.name} onChange={set('name')} maxLength={120} /></div>
            <div className="form-group"><label htmlFor="sp-phone">Mobile Number *</label><input id="sp-phone" inputMode="numeric" maxLength={10} value={form.phone} onChange={digits('phone')} /></div>
            <div className="form-group"><label htmlFor="sp-company">Company Name</label><input id="sp-company" value={form.companyName} onChange={set('companyName')} /></div>
            <div className="form-group"><label htmlFor="sp-alt">Alternate Number</label><input id="sp-alt" inputMode="numeric" maxLength={10} value={form.altPhone} onChange={digits('altPhone')} /></div>
            <div className="form-group"><label htmlFor="sp-email">Email</label><input id="sp-email" type="email" value={form.email} onChange={set('email')} /></div>
            <div className="form-group"><label htmlFor="sp-gst">GST Number</label><input id="sp-gst" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
            <div className="form-group"><label htmlFor="sp-contact">Contact Person</label><input id="sp-contact" value={form.contactPerson} onChange={set('contactPerson')} /></div>
            <div className="form-group">
              <label htmlFor="sp-status">Status</label>
              <select id="sp-status" value={form.status} onChange={set('status')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
            </div>
            <div className="form-group"><label htmlFor="sp-city">City</label><input id="sp-city" value={form.city} onChange={set('city')} /></div>
            <div className="form-group"><label htmlFor="sp-state">State</label><input id="sp-state" value={form.state} onChange={set('state')} /></div>
            <div className="form-group"><label htmlFor="sp-pin">Pincode</label><input id="sp-pin" inputMode="numeric" maxLength={6} value={form.pincode} onChange={digits('pincode')} /></div>
            <div className="form-group"><label htmlFor="sp-address">Address</label><input id="sp-address" value={form.address} onChange={set('address')} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label htmlFor="sp-notes">Notes</label><textarea id="sp-notes" rows={2} value={form.notes} onChange={set('notes')} /></div>
          </div>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Supplier' : 'Save Supplier'}</button>
            <button className="btn btn-outline" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
