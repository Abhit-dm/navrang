import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

const VEHICLE_TYPES = ['Car', 'SUV', 'MUV', 'Bike', 'Scooter', 'Truck', 'Bus', 'Tractor', 'Commercial Vehicle', 'Other'];
const emptyForm = { customerId: '', vehicleNumber: '', vehicleType: 'Car', brand: '', model: '', year: '', fuelType: '', odometerReading: '', notes: '' };

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = (q) => api.get('/vehicles', { params: q ? { search: q } : {} }).then((res) => setVehicles(res.data));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/vehicles', form);
      setShowForm(false);
      setForm(emptyForm);
      load(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vehicle');
    }
  };

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Vehicles</h3>
          <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add Vehicle'}</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Customer *</label>
                <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Vehicle Number *</label><input required value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} /></div>
              <div className="form-group">
                <label>Vehicle Type *</label>
                <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                  {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Brand</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div className="form-group"><label>Model</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div className="form-group"><label>Year</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              <div className="form-group">
                <label>Fuel Type</label>
                <select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                  <option value="">Select</option><option>Petrol</option><option>Diesel</option><option>CNG</option><option>Electric</option>
                </select>
              </div>
              <div className="form-group"><label>Odometer Reading</label><input type="number" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} /></div>
              <div className="form-group"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions"><button className="btn btn-secondary" type="submit">Save Vehicle</button></div>
          </form>
        )}
      </div>

      <div className="panel">
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(search); }}>
          <input placeholder="Search by vehicle number, brand..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-outline" type="submit">Search</button>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Vehicle No</th><th>Customer</th><th>Type</th><th>Brand</th><th>Model</th><th>Year</th><th>Fuel</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>{v.vehicleNumber}</td><td>{v.customer?.name}</td><td>{v.vehicleType}</td><td>{v.brand}</td><td>{v.model}</td><td>{v.year}</td><td>{v.fuelType}</td>
                </tr>
              ))}
              {vehicles.length === 0 && <tr><td colSpan={7}>No vehicles found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
