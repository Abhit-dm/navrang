import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { formatDate, statusBadgeClass } from '../utils/format.js';

export default function Warranties() {
  const [warranties, setWarranties] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    api.get('/warranties', { params }).then((res) => setWarranties(res.data));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <h3>Warranties</h3>
      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Search customer, phone, vehicle, product, serial..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>ACTIVE</option><option>EXPIRING SOON</option><option>EXPIRED</option><option>CLAIMED</option><option>REPLACED</option>
        </select>
        <button className="btn btn-outline" type="submit">Search</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Warranty Code</th><th>Customer</th><th>Product</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {warranties.map((w) => (
              <tr key={w.id}>
                <td>{w.warrantyCode}</td>
                <td>{w.customer?.name}</td>
                <td>{w.product?.name}</td>
                <td>{formatDate(w.warrantyStart)}</td>
                <td>{formatDate(w.warrantyEnd)}</td>
                <td><span className={statusBadgeClass(w.status)}>{w.status}</span></td>
                <td><Link className="btn btn-outline btn-sm" to={`/admin/warranties/${w.id}`}>View</Link></td>
              </tr>
            ))}
            {warranties.length === 0 && <tr><td colSpan={7}>No warranties found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
