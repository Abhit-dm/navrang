import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';

export default function Monthly() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);

  const load = () => {
    api.get('/reports/monthly', { params: { month, year } }).then((res) => setData(res.data));
    api.get('/reports/monthly-billing', { params: { month, year } }).then((res) => setBilling(res.data));
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = Object.entries(data).map(([k, v]) => `${k},${v}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `monthly-report-${year}-${month}.csv`; a.click();
  };

  return (
    <div>
      <div className="panel">
        <h3>Monthly Sales Report</h3>
        <div className="search-bar">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('en', { month: 'long' })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
          <button className="btn btn-outline" onClick={load}>Load</button>
          <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-outline no-print" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {data && (
        <div className="panel">
          <h4>{new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}</h4>
          <div className="cards-grid">
            <div className="stat-card"><div className="label">Opening Stock</div><div className="value">{data.openingStock}</div></div>
            <div className="stat-card"><div className="label">Purchases (Qty)</div><div className="value">{data.purchases}</div></div>
            <div className="stat-card"><div className="label">Sales Quantity</div><div className="value">{data.salesQuantity}</div></div>
            <div className="stat-card"><div className="label">Closing Stock</div><div className="value">{data.closingStock}</div></div>
            <div className="stat-card success"><div className="label">Sales Revenue</div><div className="value">{formatCurrency(data.salesRevenue)}</div></div>
            <div className="stat-card"><div className="label">Purchase Cost</div><div className="value">{formatCurrency(data.purchaseCost)}</div></div>
            <div className="stat-card success"><div className="label">Gross Profit</div><div className="value">{formatCurrency(data.grossProfit)}</div></div>
            <div className="stat-card"><div className="label">GST Collected</div><div className="value">{formatCurrency(data.gstCollected)}</div></div>
            <div className="stat-card"><div className="label">Discounts</div><div className="value">{formatCurrency(data.discounts)}</div></div>
            <div className="stat-card"><div className="label">Payments Received</div><div className="value">{formatCurrency(data.paid)}</div></div>
            <div className="stat-card warn"><div className="label">Outstanding</div><div className="value">{formatCurrency(data.outstanding)}</div></div>
          </div>
        </div>
      )}

      {billing && (
        <div className="panel">
          <h4>Monthly Stock Billing Report</h4>
          <div className="cards-grid">
            <div className="stat-card"><div className="label">Total Invoices</div><div className="value">{billing.totalInvoices}</div></div>
            <div className="stat-card"><div className="label">GST Invoices</div><div className="value">{billing.gstInvoices}</div></div>
            <div className="stat-card"><div className="label">Non-GST Invoices</div><div className="value">{billing.nonGstInvoices}</div></div>
            <div className="stat-card success"><div className="label">Total Sales</div><div className="value">{formatCurrency(billing.totalSales)}</div></div>
            <div className="stat-card"><div className="label">Total GST</div><div className="value">{formatCurrency(billing.totalGst)}</div></div>
            <div className="stat-card"><div className="label">Total Discounts</div><div className="value">{formatCurrency(billing.totalDiscounts)}</div></div>
            <div className="stat-card"><div className="label">Total Paid</div><div className="value">{formatCurrency(billing.totalPaid)}</div></div>
            <div className="stat-card warn"><div className="label">Total Due</div><div className="value">{formatCurrency(billing.totalDue)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
