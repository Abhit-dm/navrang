import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SupplierFormModal from '../components/SupplierFormModal.jsx';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';

const PAYMENT_METHODS = ['UPI', 'PhonePe', 'Google Pay', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallet', 'Cash', 'Cash on Delivery'];

export default function Purchases() {
  const { isAdmin } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);

  const load = () => api.get('/purchases').then((res) => setPurchases(res.data));
  // Only active suppliers can receive new purchases; old purchases keep showing their (possibly inactive) supplier.
  const loadSuppliers = () => api.get('/suppliers', { params: { status: 'ACTIVE' } }).then((res) => setSuppliers(res.data));

  useEffect(() => {
    load();
    loadSuppliers();
    api.get('/products').then((res) => setProducts(res.data));
  }, []);

  const supplierAdded = async (supplier) => {
    setSupplierModal(false);
    await loadSuppliers();
    if (supplier.status === 'ACTIVE') {
      setSupplierId(String(supplier.id));
      setNotice(`${supplier.name} (${supplier.supplierCode}) added and selected.`);
    } else {
      setNotice(`${supplier.name} was saved as inactive, so it cannot be used for new purchases.`);
    }
  };

  const addItem = () => setItems([...items, { productId: '', quantity: 1, purchasePrice: 0, gstPercent: 18, discount: 0 }]);
  const updateItem = (idx, field, value) => {
    const copy = [...items];
    copy[idx][field] = value;
    if (field === 'productId') {
      const p = products.find((x) => String(x.id) === String(value));
      if (p) { copy[idx].purchasePrice = p.purchasePrice; copy[idx].gstPercent = p.gstPercent; }
    }
    setItems(copy);
  };
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + (Number(i.purchasePrice) * Number(i.quantity) || 0), 0);
  // Display-only estimate; the server recalculates the real total.
  const estimatedTotal = items.reduce((s, i) => {
    const taxable = (Number(i.purchasePrice) * Number(i.quantity) || 0) - Number(i.discount || 0);
    return s + taxable + (taxable * Number(i.gstPercent || 0)) / 100;
  }, 0) - Number(discount || 0);
  const paidEntered = paidAmount !== '';
  const shownStatus = paidEntered
    ? (Number(paidAmount) >= estimatedTotal && estimatedTotal > 0 ? 'PAID' : Number(paidAmount) > 0 ? 'PARTIALLY PAID' : 'PENDING')
    : paymentStatus;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    if (!supplierId) { setError('Select a supplier, or add a new one.'); return; }
    if (items.length === 0) { setError('Add at least one item'); return; }
    if (items.some((i) => !i.productId)) { setError('Select a product for every item.'); return; }
    if (items.some((i) => !Number.isInteger(Number(i.quantity)) || Number(i.quantity) <= 0)) { setError('Each quantity must be a whole number greater than zero.'); return; }
    if (items.some((i) => !Number.isFinite(Number(i.purchasePrice)) || Number(i.purchasePrice) < 0)) { setError('Each purchase price must be a valid amount.'); return; }
    if (paidEntered && (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) < 0 || Number(paidAmount) > estimatedTotal + 0.005)) { setError('Amount paid must be between zero and the purchase total.'); return; }
    setSaving(true);
    try {
      await api.post('/purchases', { supplierId, items, discount, paymentStatus, paymentMethod, ...(paidEntered ? { paidAmount: Number(paidAmount) } : {}) });
      setShowForm(false);
      setItems([]); setSupplierId(''); setDiscount(0); setPaidAmount('');
      load();
      setNotice('Purchase saved and stock updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {isAdmin && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Record Purchase</h3>
            <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New Purchase'}</button>
          </div>
          {showForm && (
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Supplier *</label>
                  <div className="supplier-select">
                    <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.companyName ? ` — ${s.companyName}` : ''}</option>)}
                    </select>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setSupplierModal(true)}>+ Add New Supplier</button>
                  </div>
                </div>
                <div className="form-group"><label>Discount</label><input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
                <div className="form-group"><label>Amount Paid (optional)</label><input type="number" min="0" step="0.01" placeholder="Leave empty to use Payment Status" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select value={shownStatus} disabled={paidEntered} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option>PENDING</option><option>PARTIALLY PAID</option><option>PAID</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table cart-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Purchase Price</th><th>GST %</th><th>Discount</th><th></th></tr></thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <select value={it.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)}>
                            <option value="">Select</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td><input type="number" style={{ width: 70 }} value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></td>
                        <td><input type="number" style={{ width: 90 }} value={it.purchasePrice} onChange={(e) => updateItem(idx, 'purchasePrice', e.target.value)} /></td>
                        <td><input type="number" style={{ width: 70 }} value={it.gstPercent} onChange={(e) => updateItem(idx, 'gstPercent', e.target.value)} /></td>
                        <td><input type="number" style={{ width: 70 }} value={it.discount} onChange={(e) => updateItem(idx, 'discount', e.target.value)} /></td>
                        <td><button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>+ Add Item</button>

              <div className="totals-box" style={{ marginTop: 14 }}>
                <div className="row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="row"><span>Estimated Total (with GST)</span><span>{formatCurrency(estimatedTotal)}</span></div>
                {paidEntered && <div className="row"><span>Balance</span><span>{formatCurrency(estimatedTotal - Number(paidAmount || 0))}</span></div>}
              </div>

              {error && <div className="error-text" role="alert">{error}</div>}
              <div className="form-actions"><button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Purchase'}</button></div>
            </form>
          )}
        </div>
      )}

      <div className="panel table-wrap">
        {notice && <div className="success-text">{notice}</div>}
        <table className="data-table">
          <thead><tr><th>Purchase#</th><th>Supplier</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment Status</th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.purchaseNumber}</td><td>{p.supplier?.name}{p.supplier?.status === 'INACTIVE' && <span className="badge badge-muted" style={{ marginLeft: 6 }}>inactive</span>}</td><td>{formatDate(p.purchaseDate)}</td>
                <td>{formatCurrency(p.total)}</td><td>{formatCurrency(Math.min(p.paidAmount, p.total))}</td><td>{formatCurrency(p.balance)}</td>
                <td><span className={statusBadgeClass(p.paymentStatus)}>{p.paymentStatus}</span></td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={7}>No purchases recorded</td></tr>}
          </tbody>
        </table>
      </div>

      {supplierModal && <SupplierFormModal onSaved={supplierAdded} onClose={() => setSupplierModal(false)} />}
    </div>
  );
}
