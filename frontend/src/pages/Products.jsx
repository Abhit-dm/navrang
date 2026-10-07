import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, statusBadgeClass } from '../utils/format.js';

const CATEGORIES = ['Car Tyres', 'Bike Tyres', 'SUV Tyres', 'Commercial Tyres', 'Other'];
const VEHICLE_TYPES = ['Car', 'SUV', 'Bike', 'Scooter', 'Truck', 'Bus', 'Tractor', 'Other'];
const BRANDS = ['MRF', 'CEAT', 'Apollo', 'Bridgestone', 'Michelin', 'JK Tyre', 'Yokohama', 'Other'];
const WARRANTY_TYPES = ['Manufacturer Warranty', 'Replacement Warranty', 'Pro-Rata Warranty', 'Store Warranty', 'Road Hazard Warranty', 'No Warranty'];

const emptyForm = {
  name: '', brand: '', category: 'Car Tyres', productType: 'Tyre', sku: '', barcode: '',
  size: '', width: '', profile: '', rimSize: '', tyreType: 'Tubeless', vehicleCompatibility: '',
  speedRating: '', loadIndex: '', pattern: '',
  purchasePrice: '', sellingPrice: '', mrp: '', gstPercent: 18, minStockLevel: 5, invoiceStock: 0,
  warrantyType: 'Manufacturer Warranty', warrantyDuration: 12,
  imageUrl: '', description: '', featured: false,
};

export default function Products() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/products', { params: { search, category } }).then((res) => setProducts(res.data));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.invoiceStock !== '' && (!Number.isInteger(Number(form.invoiceStock)) || Number(form.invoiceStock) < 0)) {
      setError('Invoice Stock must be a whole number of 0 or more.');
      return;
    }
    try {
      if (editId) {
        await api.put(`/products/${editId}`, form);
      } else {
        await api.post('/products', form);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
    }
  };

  const startEdit = (p) => {
    setForm({ ...emptyForm, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? emptyForm[k] ?? ''])) });
    setEditId(p.id);
    setShowForm(true);
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this product?')) return;
    await api.delete(`/products/${id}`);
    load();
  };

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Products</h3>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => { setShowForm((v) => !v); setEditId(null); setForm(emptyForm); }}>
              {showForm ? 'Cancel' : '+ Add Product'}
            </button>
          )}
        </div>

        {showForm && isAdmin && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <div className="form-group"><label>Product Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group">
                <label>Brand</label>
                <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                  <option value="">Select brand</option>{BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label>SKU *</label><input required disabled={!!editId} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="form-group"><label>Barcode</label><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              <div className="form-group"><label>Tyre Size (e.g. 195/65 R15)</label><input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
              <div className="form-group"><label>Width</label><input value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></div>
              <div className="form-group"><label>Profile</label><input value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })} /></div>
              <div className="form-group"><label>Rim Size</label><input value={form.rimSize} onChange={(e) => setForm({ ...form, rimSize: e.target.value })} /></div>
              <div className="form-group">
                <label>Tubeless / Tube Type</label>
                <select value={form.tyreType} onChange={(e) => setForm({ ...form, tyreType: e.target.value })}>
                  <option>Tubeless</option><option>Tube Type</option>
                </select>
              </div>
              <div className="form-group"><label>Vehicle Type (shown on website)</label><input list="vehicle-types" value={form.vehicleCompatibility} onChange={(e) => setForm({ ...form, vehicleCompatibility: e.target.value })} /><datalist id="vehicle-types">{VEHICLE_TYPES.map((v) => <option key={v} value={v} />)}</datalist></div>
              <div className="form-group"><label>Speed Rating</label><input value={form.speedRating} onChange={(e) => setForm({ ...form, speedRating: e.target.value })} /></div>
              <div className="form-group"><label>Load Index</label><input value={form.loadIndex} onChange={(e) => setForm({ ...form, loadIndex: e.target.value })} /></div>
              <div className="form-group"><label>Pattern</label><input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} /></div>
              <div className="form-group"><label>Purchase Price *</label><input type="number" required value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></div>
              <div className="form-group"><label>Selling Price *</label><input type="number" required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
              <div className="form-group"><label>MRP</label><input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></div>
              <div className="form-group"><label>GST %</label><input type="number" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} /></div>
              <div className="form-group"><label>Minimum Stock Level</label><input type="number" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} /></div>
              <div className="form-group"><label>Invoice Stock</label><input type="number" min="0" step="1" value={form.invoiceStock} onChange={(e) => setForm({ ...form, invoiceStock: e.target.value })} /></div>
              <div className="form-group">
                <label>Warranty Type</label>
                <select value={form.warrantyType} onChange={(e) => setForm({ ...form, warrantyType: e.target.value })}>
                  {WARRANTY_TYPES.map((w) => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Warranty Duration (months)</label><input type="number" value={form.warrantyDuration} onChange={(e) => setForm({ ...form, warrantyDuration: e.target.value })} /></div>
              <div className="form-group"><label>Image URL (shown on website)</label><input placeholder="https://... or /images/tyre.jpg" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
              <div className="form-group"><label>Show as featured on website</label><select value={form.featured ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, featured: e.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></select></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Website Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions"><button className="btn btn-secondary" type="submit">{editId ? 'Update Product' : 'Save Product'}</button></div>
          </form>
        )}
      </div>

      <div className="panel">
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input placeholder="Search by name, brand, SKU, barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn btn-outline" type="submit">Search</button>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Brand</th><th>SKU</th><th>Size</th><th>MRP</th><th>Selling Price</th><th>Invoice Stock</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.brand}</td><td>{p.sku}</td><td>{p.size || '-'}</td>
                  <td>{formatCurrency(p.mrp)}</td><td>{formatCurrency(p.sellingPrice)}</td>
                  <td>{p.invoiceStock}</td>
                  <td><span className={statusBadgeClass(p.stockStatus)}>{p.stockStatus}</span></td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(p.id)}>Deactivate</button>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={9}>No products found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
