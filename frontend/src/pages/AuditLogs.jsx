import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { formatDateTime } from '../utils/format.js';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');

  const load = () => api.get('/audit', { params: action ? { action } : {} }).then((res) => setLogs(res.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <h3>Audit Logs</h3>
      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Filter by action (e.g. SALE_CREATED)" value={action} onChange={(e) => setAction(e.target.value)} />
        <button className="btn btn-outline" type="submit">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{formatDateTime(l.createdAt)}</td>
                <td>{l.user?.name || 'System'}</td>
                <td>{l.action}</td>
                <td>{l.entity || '-'}</td>
                <td>{l.entityId || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5}>No audit log entries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
