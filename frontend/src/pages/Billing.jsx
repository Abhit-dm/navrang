import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PAYMENT_METHODS, formatCurrency, statusBadgeClass, todayInput } from '../utils/format.js';

const EMPTY_CUSTOMER = { name: '', phone: '', altPhone: '', email: '', address: '', gstin: '' };
const EMPTY_VEHICLE = { vehicleNumber: '', model: '', vehicleType: '' };
const VEHICLE_TYPES = ['Car', 'SUV', 'Motorcycle', 'Scooter', 'Truck', 'Bus', 'Other'];

export default function Billing() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerDetails, setCustomerDetails] = useState(EMPTY_CUSTOMER);
  const [customerId, setCustomerId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState(EMPTY_VEHICLE);

  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [cart, setCart] = useState([]);

  const [saleDate, setSaleDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isGst, setIsGst] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = customerSearch.trim();
    if (query.length < 2) { setCustomerResults([]); return undefined; }
    const timer = setTimeout(() => {
      api.get('/customers', { params: { search: query } })
        .then((res) => setCustomerResults(res.data))
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (customerId) api.get('/vehicles', { params: { customerId } }).then((res) => setVehicles(res.data));
    else setVehicles([]);
  }, [customerId]);

  const searchProducts = (q) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    api.get('/products', { params: { search: q, status: 'ACTIVE' } }).then((res) => setProductResults(res.data));
  };

  const addToCart = (p) => {
    if (cart.find((c) => c.productId === p.id)) return;
    setCart([...cart, {
      productId: p.id, name: p.name, brand: p.brand, model: p.pattern, sku: p.sku, size: p.size, availableStock: p.availableStock,
      sellingPrice: p.sellingPrice, listPrice: p.sellingPrice, gstPercent: p.gstPercent, quantity: 1, discount: 0,
    }]);
    setProductSearch(''); setProductResults([]);
  };

  const updateCartItem = (idx, field, value) => setCart(cart.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  const removeFromCart = (idx) => setCart(cart.filter((_, i) => i !== idx));

  // Display-only estimate; the server recalculates and validates every total on save.
  const lineTaxable = (item) => Number(item.sellingPrice) * Number(item.quantity) - Number(item.discount || 0);
  const lineTotal = (item) => lineTaxable(item) + (isGst ? (lineTaxable(item) * Number(item.gstPercent)) / 100 : 0);
  const subtotal = cart.reduce((s, i) => s + Number(i.sellingPrice) * Number(i.quantity), 0);
  const itemDiscounts = cart.reduce((s, i) => s + Number(i.discount || 0), 0);
  const totalDiscount = itemDiscounts + Number(discount || 0);
  const gstTotal = cart.reduce((s, i) => s + (isGst ? (lineTaxable(i) * Number(i.gstPercent)) / 100 : 0), 0);
  const grandTotal = subtotal - totalDiscount + gstTotal;
  const paid = Number(paidAmount || 0);
  const balance = grandTotal - paid;
  let paymentStatus = 'PENDING';
  if (grandTotal > 0 && paid >= grandTotal) paymentStatus = 'PAID';
  else if (paid > 0) paymentStatus = 'PARTIALLY PAID';
  if (paymentStatus !== 'PAID' && dueDate && dueDate < todayInput()) paymentStatus = 'OVERDUE';

  const stockError = cart.find((i) => Number(i.quantity) > i.availableStock);

  const selectCustomer = (customer) => {
    setCustomerId(String(customer.id));
    setCustomerDetails({
      name: customer.name || '', phone: customer.phone || '', altPhone: customer.altPhone || '',
      email: customer.email || '', address: customer.address || '', gstin: customer.gstin || '',
    });
    const first = customer.vehicles?.[0];
    setVehicleId(first ? String(first.id) : '');
    setVehicleDetails(first ? { vehicleNumber: first.vehicleNumber || '', model: first.model || '', vehicleType: first.vehicleType || '' } : EMPTY_VEHICLE);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const clearCustomer = () => {
    setCustomerId(''); setCustomerDetails(EMPTY_CUSTOMER); setVehicleId(''); setVehicleDetails(EMPTY_VEHICLE);
  };

  const selectVehicle = (id) => {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => String(item.id) === id);
    setVehicleDetails(vehicle ? {
      vehicleNumber: vehicle.vehicleNumber || '', model: vehicle.model || '', vehicleType: vehicle.vehicleType || '',
    } : EMPTY_VEHICLE);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!customerDetails.name.trim()) { setError('Customer name is required.'); return; }
    if (!/^[0-9]{10}$/.test(customerDetails.phone.trim())) { setError('Enter a valid 10-digit mobile number.'); return; }
    if (customerDetails.altPhone && !/^[0-9]{10}$/.test(customerDetails.altPhone)) { setError('Alternate number must be 10 digits.'); return; }
    if (cart.length === 0) { setError('Add at least one product to the sale.'); return; }
    if (stockError) { setError(`Insufficient stock for ${stockError.name}`); return; }
    if (cart.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0)) { setError('Each quantity must be a whole number greater than zero.'); return; }
    if (cart.some((item) => !Number.isFinite(Number(item.sellingPrice)) || Number(item.sellingPrice) < 0)) { setError('Each price must be a valid amount.'); return; }
    if (cart.some((item) => !Number.isFinite(Number(item.discount || 0)) || Number(item.discount || 0) < 0 || Number(item.discount || 0) > Number(item.sellingPrice) * Number(item.quantity))) { setError('Each item discount must be between zero and its line amount.'); return; }
    if (!Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > subtotal - itemDiscounts) { setError('Discount must be a valid amount no greater than the subtotal.'); return; }
    if (!Number.isFinite(paid) || paid < 0 || paid > grandTotal + 0.005) { setError('Amount paid must be between zero and the grand total.'); return; }
    if (paid > 0 && !paymentMethod) { setError('Select a payment method.'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/sales', {
        customerId: customerId || null,
        customer: customerDetails,
        vehicleId: vehicleId || null,
        vehicle: vehicleDetails,
        items: cart.map((c) => ({
          productId: c.productId, quantity: Number(c.quantity), discount: Number(c.discount || 0),
          ...(isAdmin ? { sellingPrice: Number(c.sellingPrice) } : {}),
        })),
        discount: Number(discount || 0),
        isGst,
        saleDate,
        dueDate: dueDate || null,
        notes,
        paymentMethod,
        paidAmount: paid,
        paymentDate,
        paymentReference,
      });
      setSuccess(data.invoice);
      setCart([]); setDiscount(0); setPaidAmount(''); setNotes(''); setDueDate(''); setPaymentReference('');
      clearCustomer(); setVehicles([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the sale.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="panel">
        <h3>✅ Sale Saved and Invoice Generated</h3>
        <p>Sale Number: <strong>{success.sale?.saleNumber || '-'}</strong> | Invoice Number: <strong>{success.invoiceNumber}</strong></p>
        <p>Grand Total: <strong>{formatCurrency(success.grandTotal)}</strong> | Paid: {formatCurrency(success.paidAmount)} | Balance: {formatCurrency(success.dueAmount)} | Status: <span className={statusBadgeClass(success.displayStatus || success.paymentStatus)}>{success.displayStatus || success.paymentStatus}</span></p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/admin/invoices/${success.id}`)}>View / Print Invoice</button>
          <button className="btn btn-outline" onClick={() => navigate(`/admin/sales/${success.saleId}`)}>View Sale</button>
          <button className="btn btn-outline" onClick={() => setSuccess(null)}>New Sale</button>
        </div>
      </div>
    );
  }

  const update = (setter, state, key) => (e) => setter({ ...state, [key]: e.target.value });

  return (
    <form onSubmit={handleSubmit}>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>New Sale</h3>
          <Link className="btn btn-outline btn-sm" to="/admin/sales">Back to Sales</Link>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group"><label>Sale Number</label><input disabled value="Generated automatically on save" /></div>
          <div className="form-group"><label>Sale Date *</label><input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div>
        </div>
      </div>

      <div className="panel">
        <h3>1. Customer Details</h3>
        <div className="form-grid">
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Search Existing Customer</label>
            <input autoComplete="off" placeholder="Name, mobile or vehicle number" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            {customerResults.length > 0 && <div className="panel" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
              {customerResults.map((c) => (
                <button key={c.id} className="btn btn-outline btn-block" type="button" style={{ justifyContent: 'flex-start', marginBottom: 4 }} onClick={() => selectCustomer(c)}>
                  {c.name} · {c.phone}{c.vehicles?.length ? ` · ${c.vehicles.map((v) => v.vehicleNumber).join(', ')}` : ''}
                </button>
              ))}
            </div>}
            {customerSearch.trim().length >= 2 && customerResults.length === 0 && <small>No matching customer. Enter the details below to create one.</small>}
            {customerId && <small>Existing customer selected. Changes below update this customer when the sale is saved. <button className="btn btn-outline btn-sm" type="button" onClick={clearCustomer}>Clear</button></small>}
          </div>
          <div className="form-group"><label>Customer Name *</label><input required value={customerDetails.name} onChange={update(setCustomerDetails, customerDetails, 'name')} /></div>
          <div className="form-group"><label>Mobile Number *</label><input required inputMode="numeric" maxLength="10" pattern="[0-9]{10}" title="Enter a 10-digit mobile number" value={customerDetails.phone} onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
          <div className="form-group"><label>Alternate Number</label><input inputMode="numeric" maxLength="10" value={customerDetails.altPhone} onChange={(e) => setCustomerDetails({ ...customerDetails, altPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
          <div className="form-group"><label>Email</label><input type="email" value={customerDetails.email} onChange={update(setCustomerDetails, customerDetails, 'email')} /></div>
          <div className="form-group"><label>Address</label><input value={customerDetails.address} onChange={update(setCustomerDetails, customerDetails, 'address')} /></div>
          <div className="form-group"><label>GST Number</label><input value={customerDetails.gstin} onChange={(e) => setCustomerDetails({ ...customerDetails, gstin: e.target.value.toUpperCase() })} /></div>
          <div className="form-group"><label>Vehicle Number</label><input value={vehicleDetails.vehicleNumber} onChange={(e) => { setVehicleId(''); setVehicleDetails({ ...vehicleDetails, vehicleNumber: e.target.value.toUpperCase() }); }} /></div>
          <div className="form-group"><label>Vehicle Model</label><input value={vehicleDetails.model} onChange={(e) => { setVehicleId(''); setVehicleDetails({ ...vehicleDetails, model: e.target.value }); }} /></div>
          <div className="form-group"><label>Vehicle Type</label>
            <select value={vehicleDetails.vehicleType} onChange={(e) => { setVehicleId(''); setVehicleDetails({ ...vehicleDetails, vehicleType: e.target.value }); }}>
              <option value="">Select type</option>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {customerId && vehicles.length > 0 && (
            <div className="form-group"><label>Saved Vehicles</label>
              <select value={vehicleId} onChange={(e) => selectVehicle(e.target.value)}>
                <option value="">Enter vehicle details manually</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber} · {v.model || v.vehicleType}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>2. Sale Details</h3>
        <div className="form-group" style={{ position: 'relative' }}>
          <input placeholder="Search product by name, brand, SKU, size, barcode..." value={productSearch} onChange={(e) => searchProducts(e.target.value)} />
          {productResults.length > 0 && (
            <div className="panel" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
              {productResults.map((p) => (
                <div key={p.id} style={{ padding: '8px 4px', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => addToCart(p)}>
                  <strong>{p.name}</strong> ({p.brand}) — SKU: {p.sku} — Size: {p.size || '-'} — Stock: {p.availableStock} — Price: {formatCurrency(p.sellingPrice)} — GST: {p.gstPercent}%
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="data-table cart-table">
            <thead><tr><th>Brand</th><th>Product</th><th>Model</th><th>Tyre Size</th><th>Qty</th><th>Price</th><th>Discount</th><th>Tax</th><th>Item Total</th><th></th></tr></thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr key={item.productId}>
                  <td>{item.brand || '-'}</td>
                  <td>{item.name}<div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{item.sku}</div></td>
                  <td>{item.model || '-'}</td>
                  <td>{item.size || '-'}</td>
                  <td>
                    <input type="number" min="1" step="1" style={{ width: 70 }} value={item.quantity} onChange={(e) => updateCartItem(idx, 'quantity', e.target.value)} />
                    {Number(item.quantity) > item.availableStock && <div className="error-text">Only {item.availableStock} in stock</div>}
                  </td>
                  <td>
                    {isAdmin
                      ? <input type="number" min="0" step="0.01" style={{ width: 90 }} value={item.sellingPrice} onChange={(e) => updateCartItem(idx, 'sellingPrice', e.target.value)} />
                      : formatCurrency(item.sellingPrice)}
                  </td>
                  <td><input type="number" min="0" step="0.01" style={{ width: 80 }} value={item.discount} onChange={(e) => updateCartItem(idx, 'discount', e.target.value)} /></td>
                  <td>{isGst ? `${item.gstPercent}%` : '-'}</td>
                  <td>{formatCurrency(lineTotal(item))}</td>
                  <td><button className="btn btn-danger btn-sm" type="button" onClick={() => removeFromCart(idx)}>×</button></td>
                </tr>
              ))}
              {cart.length === 0 && <tr><td colSpan={10}>No products added yet. Search above to add one or more tyres.</td></tr>}
            </tbody>
          </table>
        </div>
        {!isAdmin && <small style={{ color: 'var(--muted)' }}>Only an admin can change the selling price.</small>}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>3. Payment Details</h3>
          <div className="form-group">
            <label>Invoice Type</label>
            <select value={isGst ? 'GST' : 'NON-GST'} onChange={(e) => setIsGst(e.target.value === 'GST')}>
              <option value="GST">GST Invoice</option><option value="NON-GST">Non-GST Invoice</option>
            </select>
          </div>
          <div className="form-group"><label>Overall Discount</label><input type="number" min="0" max={Math.max(0, subtotal - itemDiscounts)} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="form-group"><label>Amount Paid</label><input type="number" min="0" max={grandTotal} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></div>
          <div className="form-group">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div className="form-group"><label>Payment Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          <div className="form-group"><label>Balance Due Date (optional)</label><input type="date" value={dueDate} min={saleDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="form-group"><label>Transaction / Reference Number (optional)</label><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></div>
          <div className="form-group"><label>Notes (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <div className="panel">
          <h3>Bill Summary</h3>
          <div className="totals-box">
            <div className="row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="row"><span>Discount</span><span>-{formatCurrency(totalDiscount)}</span></div>
            {isGst && <div className="row"><span>Tax (GST)</span><span>{formatCurrency(gstTotal)}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
            <div className="row"><span>Amount Paid</span><span>{formatCurrency(paid)}</span></div>
            <div className="row"><span>Balance Amount</span><span>{formatCurrency(balance)}</span></div>
            <div className="row"><span>Payment Status</span><span className={statusBadgeClass(paymentStatus)}>{paymentStatus}</span></div>
          </div>
          <small style={{ color: 'var(--muted)' }}>Totals are recalculated and checked by the server when you save.</small>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-secondary" type="submit" disabled={submitting}>{submitting ? 'Saving Sale...' : 'Save Sale'}</button>
            <button className="btn btn-outline" type="button" onClick={() => navigate('/admin/sales')}>Cancel</button>
          </div>
        </div>
      </div>
    </form>
  );
}
