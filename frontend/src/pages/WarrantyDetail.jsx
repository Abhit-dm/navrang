import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, statusBadgeClass } from '../utils/format.js';

export default function WarrantyDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [warranty, setWarranty] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get(`/warranties/${id}`).then((res) => setWarranty(res.data));
  useEffect(() => { load(); }, [id]);

  const fileClaim = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/warranties/${id}/claims`, { reason, status: 'OPEN' });
      setReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to file claim');
    }
  };

  if (!warranty) return <div className="empty-state">Loading...</div>;

  return (
    <div>
      <div className="panel">
        <h3>Warranty {warranty.warrantyCode} <span className={statusBadgeClass(warranty.status)}>{warranty.status}</span></h3>
        <div className="grid-3">
          <div><strong>Customer:</strong> {warranty.customer?.name}</div>
          <div><strong>Vehicle:</strong> {warranty.vehicle?.vehicleNumber || '-'}</div>
          <div><strong>Product:</strong> {warranty.product?.name}</div>
          <div><strong>Serial Number:</strong> {warranty.serialNumber || '-'}</div>
          <div><strong>Purchase Date:</strong> {formatDate(warranty.purchaseDate)}</div>
          <div><strong>Warranty Type:</strong> {warranty.warrantyType}</div>
          <div><strong>Start:</strong> {formatDate(warranty.warrantyStart)}</div>
          <div><strong>End:</strong> {formatDate(warranty.warrantyEnd)}</div>
          <div><strong>Invoice:</strong> {warranty.invoice?.invoiceNumber || '-'}</div>
        </div>
        <p><strong>Terms:</strong> {warranty.warrantyTerms || 'As per manufacturer warranty policy.'}</p>
      </div>

      <div className="panel">
        <h3>Warranty Claims</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Reason</th><th>Status</th><th>Resolution</th></tr></thead>
            <tbody>
              {warranty.claims.map((c) => (
                <tr key={c.id}><td>{formatDate(c.claimDate)}</td><td>{c.reason}</td><td><span className={statusBadgeClass(c.status)}>{c.status}</span></td><td>{c.resolution || '-'}</td></tr>
              ))}
              {warranty.claims.length === 0 && <tr><td colSpan={4}>No claims filed</td></tr>}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <form onSubmit={fileClaim} style={{ marginTop: 14 }}>
            <div className="form-group"><label>File a New Claim - Reason</label><input required value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-secondary" type="submit">Submit Claim</button>
          </form>
        )}
      </div>
    </div>
  );
}
