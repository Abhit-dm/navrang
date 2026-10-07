import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime, statusBadgeClass, telLink, whatsappLink } from '../utils/format.js';

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'];

export default function Enquiries() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/enquiries', { params: { status, search, archived } })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load enquiries.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, archived]);

  const open = (row) => { setSelected(row); setNotes(row.notes || ''); setMessage(''); };

  const save = async (patch) => {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put(`/enquiries/${selected.id}`, patch);
      setSelected(data);
      setRows((list) => list.map((r) => (r.id === data.id ? data : r)));
      setMessage('Saved.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!window.confirm('Archive this enquiry? It will be hidden from the main list.')) return;
    try {
      await api.delete(`/enquiries/${selected.id}`);
      setSelected(null);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not archive enquiry.');
    }
  };

  return (
    <div>
      <div className="panel">
        <h3>Contact Enquiries</h3>
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input placeholder="Search name, phone, email, subject..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived
          </label>
          <button className="btn btn-outline" type="submit">Search</button>
        </form>
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Email</th><th>Subject</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.createdAt)}</td><td>{r.name}</td><td>{r.phone}</td><td>{r.email || '-'}</td>
                  <td>{r.subject}</td>
                  <td><span className={statusBadgeClass(r.status)}>{r.status}</span></td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => open(r)}>View</button></td>
                </tr>
              ))}
              {loading && <tr><td colSpan={7}>Loading...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7}>No enquiries found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{selected.subject}</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p style={{ color: 'var(--muted)' }}>
            {selected.name} · <a href={telLink(selected.phone)}>{selected.phone}</a>
            {selected.email && <> · <a href={`mailto:${selected.email}`}>{selected.email}</a></>} · {formatDateTime(selected.createdAt)}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: 12, borderRadius: 8 }}>{selected.message}</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Status</label>
              <select value={selected.status} disabled={saving} onChange={(e) => save({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Internal notes</label>
              <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {message && <div className={message === 'Saved.' ? 'success-text' : 'error-text'}>{message}</div>}
          <div className="form-actions">
            <button className="btn btn-secondary" disabled={saving} onClick={() => save({ notes })}>Save Notes</button>
            <a className="btn btn-outline" href={whatsappLink(selected.phone, `Hello ${selected.name}, thank you for contacting Navrang Tyres.`)} target="_blank" rel="noreferrer">WhatsApp</a>
            {isAdmin && !selected.archived && <button className="btn btn-danger" onClick={archive}>Archive</button>}
          </div>
        </div>
      )}
    </div>
  );
}
