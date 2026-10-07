import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get('/settings').then((res) => setForm(res.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    const { id, updatedAt, ...payload } = form;
    await api.put('/settings', payload);
    setSaved(true);
  };

  if (!form) return <div className="empty-state">Loading settings...</div>;

  return (
    <div className="panel">
      <h3>Business Settings</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group"><label>Business Name</label><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
          <div className="form-group"><label>Tagline</label><input value={form.tagline || ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
          <div className="form-group"><label>Address</label><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>GSTIN</label><input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
          <div className="form-group"><label>State</label><input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div className="form-group"><label>State Code</label><input value={form.stateCode || ''} onChange={(e) => setForm({ ...form, stateCode: e.target.value })} /></div>
          <div className="form-group"><label>Invoice Prefix</label><input value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} /></div>
          <div className="form-group"><label>Default GST %</label><input type="number" value={form.defaultGstPercent} onChange={(e) => setForm({ ...form, defaultGstPercent: Number(e.target.value) })} /></div>
          <div className="form-group"><label>Low Stock Threshold</label><input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} /></div>
          <div className="form-group"><label>Warranty Expiry Alert (days)</label><input type="number" value={form.warrantyExpiryDays} onChange={(e) => setForm({ ...form, warrantyExpiryDays: Number(e.target.value) })} /></div>
          <div className="form-group">
            <label>Allow Negative Stock</label>
            <select value={form.allowNegativeStock ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.value === 'yes' })}>
              <option value="no">No (default)</option><option value="yes">Yes</option>
            </select>
          </div>
          <div className="form-group"><label>Invoice Terms</label><textarea rows={3} value={form.invoiceTerms || ''} onChange={(e) => setForm({ ...form, invoiceTerms: e.target.value })} /></div>
          <div className="form-group"><label>Footer Text</label><textarea rows={2} value={form.footerText || ''} onChange={(e) => setForm({ ...form, footerText: e.target.value })} /></div>
        </div>

        <h3 style={{ marginTop: 24 }}>Public Website</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>These details appear on the public website. Leave a text box empty to use the default wording.</p>
        <div className="form-grid">
          <div className="form-group"><label>WhatsApp Number</label><input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
          <div className="form-group"><label>Business Hours</label><input value={form.businessHours || ''} onChange={(e) => setForm({ ...form, businessHours: e.target.value })} /></div>
          <div className="form-group"><label>Facebook URL</label><input value={form.facebookUrl || ''} onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })} /></div>
          <div className="form-group"><label>Instagram URL</label><input value={form.instagramUrl || ''} onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })} /></div>
          <div className="form-group"><label>About Us Text</label><textarea rows={3} value={form.aboutText || ''} onChange={(e) => setForm({ ...form, aboutText: e.target.value })} /></div>
          <div className="form-group"><label>Our Mission</label><textarea rows={3} value={form.missionText || ''} onChange={(e) => setForm({ ...form, missionText: e.target.value })} /></div>
          <div className="form-group"><label>Our Vision</label><textarea rows={3} value={form.visionText || ''} onChange={(e) => setForm({ ...form, visionText: e.target.value })} /></div>
          <div className="form-group"><label>Our Commitment</label><textarea rows={3} value={form.commitmentText || ''} onChange={(e) => setForm({ ...form, commitmentText: e.target.value })} /></div>
        </div>
        {saved && <div className="success-text">Settings saved successfully.</div>}
        <div className="form-actions"><button className="btn btn-secondary" type="submit">Save Settings</button></div>
      </form>
    </div>
  );
}
