import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';

const RANGES = [
  { label: 'Today', getRange: () => { const d = new Date(); return [d, d]; } },
  { label: 'This Week', getRange: () => { const d = new Date(); const start = new Date(d); start.setDate(d.getDate() - d.getDay()); return [start, d]; } },
  { label: 'This Month', getRange: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
  { label: 'Last Month', getRange: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]; } },
  { label: 'All Time', getRange: () => [null, null] },
];

export default function TopProducts() {
  const [rows, setRows] = useState([]);
  const [rangeLabel, setRangeLabel] = useState('All Time');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = (f, t) => {
    const params = {};
    if (f) params.from = f;
    if (t) params.to = t;
    api.get('/reports/top-products', { params }).then((res) => setRows(res.data));
  };

  useEffect(() => { load(); }, []);

  const applyRange = (label) => {
    setRangeLabel(label);
    const r = RANGES.find((x) => x.label === label);
    const [f, t] = r.getRange();
    setFrom(f ? f.toISOString().slice(0, 10) : '');
    setTo(t ? t.toISOString().slice(0, 10) : '');
    load(f ? f.toISOString() : undefined, t ? t.toISOString() : undefined);
  };

  return (
    <div className="panel">
      <h3>Frequently Selling Products</h3>
      <div className="search-bar">
        <select value={rangeLabel} onChange={(e) => applyRange(e.target.value)}>
          {RANGES.map((r) => <option key={r.label}>{r.label}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-outline" onClick={() => load(from, to)}>Apply Custom Range</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Rank</th><th>Product</th><th>Brand</th><th>SKU</th><th>Units Sold</th><th>Revenue</th><th># of Sales</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank}><td>{r.rank}</td><td>{r.product}</td><td>{r.brand}</td><td>{r.sku}</td><td>{r.unitsSold}</td><td>{formatCurrency(r.revenue)}</td><td>{r.numberOfSales}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7}>No sales data for selected range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
