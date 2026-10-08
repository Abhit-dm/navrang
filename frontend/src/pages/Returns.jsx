import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { formatDate, formatCurrency, statusBadgeClass } from '../utils/format.js';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await api.get('/warranties');
    setReturns(res.data.flatMap((w) => w.returns.map((r) => ({ ...r, warrantyId: w.id, warrantyCode: w.warrantyCode, customer: w.customer }))));
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const updateStatus = async (warrantyId, returnId, status) => {
    await api.patch(`/warranties/${warrantyId}/returns/${returnId}`, { status });
    setMessage(`Return status updated to ${status}.`);
    await load();
  };

  return (
    <div className="panel">
      <h3>Warranty Returns</h3>
      {message && <div className="success-text">{message}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Warranty</th><th>Customer</th><th>Product</th><th>Return Date</th><th>Reason</th><th>Refund</th><th>Status</th></tr></thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.warrantyCode}</strong></td>
                <td>{r.customer?.name}</td>
                <td>{r.product?.name}</td>
                <td>{formatDate(r.returnDate)}</td>
                <td>{r.reason}</td>
                <td>{formatCurrency(r.refundAmount)}</td>
                <td><span className={statusBadgeClass(r.status)}>{r.status}</span><br />
                  <select className="btn btn-outline btn-sm" value={r.status} onChange={(e) => updateStatus(r.warrantyId, r.id, e.target.value)}>
                    <option value="RECEIVED">Received</option><option value="INSPECTED">Inspected</option><option value="RESTOCKED">Restocked</option><option value="DISPOSED">Disposed</option>
                  </select>
                </td>
              </tr>
            ))}
            {!loading && returns.length === 0 && <tr><td colSpan={7}>No warranty returns found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
