import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

const emptyForm = { name: '', phone: '', altPhone: '', email: '', address: '', gstin: '', city: '', state: '', pincode: '', customerType: 'Individual', notes: '', vehicleNumber: '', vehicleModel: '', vehicleType: '' };
const VEHICLE_TYPES = ['Car', 'SUV', 'Motorcycle', 'Scooter', 'Truck', 'Bus', 'Other'];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = (q) => {
    setLoading(true);
    api.get('/customers', { params: q ? { search: q } : {} }).then((res) => setCustomers(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!form.name.trim()) { setError('Customer name is required.'); return; }
    if (!/^[0-9]{10}$/.test(form.phone)) { setError('Mobile number must be 10 digits.'); return; }
    if (form.altPhone && !/^[0-9]{10}$/.test(form.altPhone)) { setError('Alternate number must be 10 digits.'); return; }
    setSaving(true);
    try {
      if (editingId) await api.put(`/customers/${editingId}`, form);
      else await api.post('/customers', form);
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const editCustomer = (customer) => {
    const { vehicles, ...rest } = customer;
    const v = vehicles?.[0];
    setEditingId(customer.id);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(Object.entries(rest).map(([k, val]) => [k, val ?? ''])),
      vehicleNumber: v?.vehicleNumber || '', vehicleModel: v?.model || '', vehicleType: v?.vehicleType || '',
    });
    setShowForm(true);
    setError('');
  };

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Customers</h3>
          <button className="btn btn-secondary" onClick={() => { setShowForm((visible) => !visible); setEditingId(null); setForm(emptyForm); setError(''); }}>
            {showForm ? 'Cancel' : '+ Add Customer'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <h4>{editingId ? 'Edit Customer' : 'New Customer'}</h4>
            <div className="form-grid">
              <div className="form-group"><label>Customer Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label>Mobile Number * (10 digits)</label><input required inputMode="numeric" maxLength="10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
              <div className="form-group"><label>Alternate Number</label><input inputMode="numeric" maxLength="10" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-group"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-group"><label>GST Number</label><input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
              <div className="form-group"><label>Vehicle Number</label><input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} /></div>
              <div className="form-group"><label>Vehicle Model</label><input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} /></div>
              <div className="form-group"><label>Vehicle Type</label><select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}><option value="">Select type</option>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="form-group"><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="form-group"><label>Pincode</label><input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
              <div className="form-group">
                <label>Customer Type</label>
                <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                  <option>Individual</option><option>Business</option><option>Fleet</option>
                </select>
              </div>
              <div className="form-group"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions"><button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Customer' : 'Save Customer'}</button><button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancel</button></div>
          </form>
        )}
      </div>

      <div className="panel">
        <form className="search-bar" onSubmit={handleSearch}>
          <input placeholder="Search by name, mobile number or vehicle number..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-outline" type="submit">Search</button>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Customer ID</th><th>Name</th><th>Mobile</th><th>Alternate</th><th>Email</th><th>Vehicle</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.customerCode}</td>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.altPhone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.vehicles?.length ? c.vehicles.map((v) => `${v.vehicleNumber}${v.model ? ` (${v.model})` : ''}`).join(', ') : '-'}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  <td><div className="form-actions" style={{ marginTop: 0 }}><Link className="btn btn-outline btn-sm" to={`/admin/customers/${c.id}`}>View</Link><button className="btn btn-outline btn-sm" onClick={() => editCustomer(c)}>Edit</button></div></td>
                </tr>
              ))}
              {loading && <tr><td colSpan={8}>Loading...</td></tr>}
              {!loading && customers.length === 0 && <tr><td colSpan={8}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
