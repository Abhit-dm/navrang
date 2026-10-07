import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';

export default function Profit() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/profit', { params }).then((res) => setData(res.data));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="panel">
        <h3>Profit &amp; Loss Report</h3>
        <div className="search-bar">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn btn-outline" onClick={load}>Apply</button>
          <button className="btn btn-outline no-print" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {data && (
        <>
          <div className="panel">
            <h4>Accounting Profit (Revenue - COGS)</h4>
            <div className="cards-grid">
              <div className="stat-card success"><div className="label">Sales Revenue</div><div className="value">{formatCurrency(data.salesRevenue)}</div></div>
              <div className="stat-card"><div className="label">COGS</div><div className="value">{formatCurrency(data.cogs)}</div></div>
              <div className="stat-card success"><div className="label">Gross Profit</div><div className="value">{formatCurrency(data.grossProfit)}</div></div>
              <div className="stat-card"><div className="label">Discounts</div><div className="value">{formatCurrency(data.discounts)}</div></div>
              <div className="stat-card"><div className="label">GST</div><div className="value">{formatCurrency(data.gst)}</div></div>
              <div className="stat-card danger"><div className="label">Expenses</div><div className="value">{formatCurrency(data.expenses)}</div></div>
              <div className="stat-card success"><div className="label">Net Profit</div><div className="value">{formatCurrency(data.netProfit)}</div></div>
            </div>
          </div>

          <div className="panel">
            <h4>{data.billingVsPurchase.label}</h4>
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              This is a simple cash-flow style comparison and is NOT true accounting profit,
              since purchases made in a period may not all be sold within the same period.
            </p>
            <div className="cards-grid">
              <div className="stat-card"><div className="label">Sales</div><div className="value">{formatCurrency(data.billingVsPurchase.sales)}</div></div>
              <div className="stat-card"><div className="label">Purchases</div><div className="value">{formatCurrency(data.billingVsPurchase.purchases)}</div></div>
              <div className="stat-card"><div className="label">Difference</div><div className="value">{formatCurrency(data.billingVsPurchase.difference)}</div></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
