import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';

const COLORS = ['#DC2626', '#F59E0B', '#111827', '#16A34A', '#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];

export default function PaymentsReport() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/payments', { params }).then((res) => setRows(res.data));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="panel">
        <h3>Payment Method Report</h3>
        <div className="search-bar">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn btn-outline" onClick={load}>Apply</button>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Method</th><th>Total</th><th>Transactions</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.method}><td>{r.method}</td><td>{formatCurrency(r.total)}</td><td>{r.count}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan={3}>No payment data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={100} label>
                {rows.map((entry, index) => <Cell key={entry.method} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
