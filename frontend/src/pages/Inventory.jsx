import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ productId: '', quantity: '', purchasePrice: '', batch: '' });
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stock');

  const load = () => {
    api.get('/inventory/summary').then((res) => setSummary(res.data));
    api.get('/inventory').then((res) => setInventory(res.data));
    api.get('/products').then((res) => setProducts(res.data));
    api.get('/inventory/movements').then((res) => setMovements(res.data));
  };

  useEffect(() => { load(); }, []);

  const handleAddStock = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventory/add-stock', addForm);
      setShowAdd(false);
      setAddForm({ productId: '', quantity: '', purchasePrice: '', batch: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add stock');
    }
  };

  return (
    <div>
      {summary && (
        <div className="cards-grid">
          <div className="stat-card"><div className="label">Total Products</div><div className="value">{summary.totalProducts}</div></div>
          <div className="stat-card"><div className="label">Total Units</div><div className="value">{summary.totalUnits}</div></div>
          <div className="stat-card success"><div className="label">Total Stock Value</div><div className="value">{formatCurrency(summary.totalStockValue)}</div></div>
          <div className="stat-card warn"><div className="label">Low Stock</div><div className="value">{summary.lowStockCount}</div></div>
          <div className="stat-card danger"><div className="label">Out of Stock</div><div className="value">{summary.outOfStockCount}</div></div>
        </div>
      )}

      {isAdmin && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Add Stock</h3>
            <button className="btn btn-secondary" onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Add Stock'}</button>
          </div>
          {showAdd && (
            <form onSubmit={handleAddStock} style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Product *</label>
                  <select required value={addForm.productId} onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Quantity *</label><input type="number" required value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} /></div>
                <div className="form-group"><label>Purchase Price</label><input type="number" value={addForm.purchasePrice} onChange={(e) => setAddForm({ ...addForm, purchasePrice: e.target.value })} /></div>
                <div className="form-group"><label>Batch/Lot No.</label><input value={addForm.batch} onChange={(e) => setAddForm({ ...addForm, batch: e.target.value })} /></div>
              </div>
              {error && <div className="error-text">{error}</div>}
              <div className="form-actions"><button className="btn btn-secondary" type="submit">Save</button></div>
            </form>
          )}
        </div>
      )}

      <div className="tabs">
        <div className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Stock Batches</div>
        <div className={`tab ${tab === 'low' ? 'active' : ''}`} onClick={() => setTab('low')}>Low Stock</div>
        <div className={`tab ${tab === 'out' ? 'active' : ''}`} onClick={() => setTab('out')}>Out of Stock</div>
        <div className={`tab ${tab === 'movements' ? 'active' : ''}`} onClick={() => setTab('movements')}>Stock Movements</div>
      </div>

      {tab === 'stock' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Batch</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>Supplier</th><th>Purchase Date</th></tr></thead>
            <tbody>
              {inventory.map((i) => (
                <tr key={i.id}>
                  <td>{i.product?.name}</td><td>{i.batch}</td><td>{i.quantity}</td>
                  <td>{formatCurrency(i.purchasePrice)}</td><td>{formatCurrency(i.sellingPrice)}</td>
                  <td>{i.supplier?.name || '-'}</td><td>{formatDate(i.purchaseDate)}</td>
                </tr>
              ))}
              {inventory.length === 0 && <tr><td colSpan={7}>No inventory batches</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'low' && summary && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Current Stock</th><th>Minimum Stock</th><th>Status</th></tr></thead>
            <tbody>
              {summary.lowStock.map((p, idx) => (
                <tr key={idx}><td>{p.product}</td><td>{p.currentStock}</td><td>{p.minStock}</td><td><span className="badge badge-warn">{p.status}</span></td></tr>
              ))}
              {summary.lowStock.length === 0 && <tr><td colSpan={4}>No low stock products</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'out' && summary && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Status</th></tr></thead>
            <tbody>
              {summary.outOfStock.map((p, idx) => (
                <tr key={idx}><td>{p.product}</td><td>{p.sku}</td><td><span className="badge badge-danger">{p.status}</span></td></tr>
              ))}
              {summary.outOfStock.length === 0 && <tr><td colSpan={3}>No out of stock products</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>User</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.createdAt)}</td><td>{m.product?.name}</td><td>{m.type}</td><td>{m.quantity}</td><td>{m.reference}</td><td>{m.user?.name || '-'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={6}>No stock movements</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
