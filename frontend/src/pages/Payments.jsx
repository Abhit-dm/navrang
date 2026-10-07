import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { formatCurrency, formatDateTime } from '../utils/format.js';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState('');

  const load = () => api.get('/payments', { params: method ? { method } : {} }).then((res) => setPayments(res.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <h3>Payments</h3>
      <div className="search-bar">
        <select value={method} onChange={(e) => { setMethod(e.target.value); }}>
          <option value="">All Methods</option>
          {['UPI', 'PhonePe', 'Google Pay', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallet', 'Cash', 'Cash on Delivery'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <button className="btn btn-outline" onClick={load}>Filter</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{formatDateTime(p.paidAt)}</td>
                <td>{p.customer?.name || '-'}</td>
                <td>{p.invoice?.invoiceNumber || '-'}</td>
                <td>{formatCurrency(p.amount)}</td>
                <td>{p.method}</td>
                <td>{p.referenceNumber || '-'}</td>
                <td><span className="badge badge-success">{p.status}</span></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={7}>No payments found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
