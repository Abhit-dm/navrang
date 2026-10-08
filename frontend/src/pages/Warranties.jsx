import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { formatDate, statusBadgeClass } from '../utils/format.js';

export default function Warranties() {
  const [warranties, setWarranties] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get('/warranties', { params });
      setWarranties(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const active = warranties.filter((w) => w.status === 'ACTIVE' || w.computedStatus === 'ACTIVE').length;
  const claims = warranties.filter((w) => w.status === 'CLAIMED' || w.claimStatus === 'OPEN').length;
  const returns = warranties.reduce((sum, w) => sum + w.returns.length, 0);

  return (
    <div>
      <div className="cards-grid">
        <div className="stat-card success"><div className="label">Active warranties</div><div className="value">{active}</div></div>
        <div className="stat-card warn"><div className="label">Open claims</div><div className="value">{claims}</div></div>
        <div className="stat-card"><div className="label">Return records</div><div className="value">{returns}</div></div>
      </div>
      <div className="panel">
        <h3>Warranty & Return Management</h3>
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input placeholder="Search customer, phone, vehicle, product, serial..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option><option value="EXPIRING SOON">Expiring soon</option><option value="EXPIRED">Expired</option>
            <option value="CLAIMED">Claimed</option><option value="REPLACED">Replaced</option><option value="RETURNED">Returned</option>
          </select>
          <button className="btn btn-outline" type="submit">Search</button>
          <Link className="btn btn-secondary" to="/admin/returns">Returns</Link>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Warranty Code</th><th>Customer</th><th>Vehicle</th><th>Product</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {warranties.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.warrantyCode}</strong></td>
                  <td>{w.customer?.name}<br /><small>{w.customer?.phone}</small></td>
                  <td>{w.vehicle?.vehicleNumber || '-'}</td><td>{w.product?.name}</td>
                  <td>{formatDate(w.warrantyEnd)}</td>
                  <td><span className={statusBadgeClass(w.status)}>{w.status}</span></td>
                  <td><Link className="btn btn-outline btn-sm" to={`/admin/warranties/${w.id}`}>View</Link></td>
                </tr>
              ))}
              {!loading && warranties.length === 0 && <tr><td colSpan={7}>No warranties found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
