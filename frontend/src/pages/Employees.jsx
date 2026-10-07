import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { formatDateTime } from '../utils/format.js';

const emptyForm = { name: '', email: '', password: '', role: 'EMPLOYEE', phone: '' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const load = () => api.get('/employees').then((res) => setEmployees(res.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/employees', form);
      setShowForm(false); setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee');
    }
  };

  const toggleActive = async (emp) => {
    await api.post(`/employees/${emp.id}/${emp.isActive ? 'disable' : 'enable'}`);
    load();
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    await api.post(`/employees/${resetTarget.id}/reset-password`, { newPassword });
    setResetTarget(null); setNewPassword('');
  };

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Employees</h3>
          <button className="btn btn-secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add Employee'}</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <div className="form-group"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-group"><label>Password *</label><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option>EMPLOYEE</option><option>ADMIN</option>
                </select>
              </div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="form-actions"><button className="btn btn-secondary" type="submit">Create Employee</button></div>
          </form>
        )}
      </div>

      {resetTarget && (
        <div className="panel">
          <h4>Reset Password for {resetTarget.name}</h4>
          <form onSubmit={resetPassword}>
            <div className="form-group"><label>New Password</label><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="form-actions">
              <button className="btn btn-secondary" type="submit">Reset</button>
              <button className="btn btn-outline" type="button" onClick={() => setResetTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.name}</td><td>{emp.email}</td><td>{emp.role}</td><td>{emp.phone}</td>
                <td><span className={`badge ${emp.isActive ? 'badge-success' : 'badge-danger'}`}>{emp.isActive ? 'ACTIVE' : 'DISABLED'}</span></td>
                <td>{formatDateTime(emp.createdAt)}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => toggleActive(emp)}>{emp.isActive ? 'Disable' : 'Enable'}</button>{' '}
                  <button className="btn btn-outline btn-sm" onClick={() => setResetTarget(emp)}>Reset Password</button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan={7}>No employees found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
