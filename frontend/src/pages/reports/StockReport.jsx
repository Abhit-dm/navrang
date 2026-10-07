import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { statusBadgeClass } from '../../utils/format.js';

export default function StockReport() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/reports/stock').then((res) => setRows(res.data)); }, []);

  const exportCsv = () => {
    const header = 'Product,SKU,Purchase Qty,Sales Qty,Current Stock,Status';
    const lines = rows.map((r) => `${r.product},${r.sku},${r.totalPurchaseQty},${r.totalSalesQty},${r.currentStock},${r.status}`);
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stock-report.csv'; a.click();
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>Stock / Sales Analytics</h3>
        <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Total Purchase Qty</th><th>Total Sales Qty</th><th>Current Stock</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.product}</td><td>{r.sku}</td><td>{r.totalPurchaseQty}</td><td>{r.totalSalesQty}</td><td>{r.currentStock}</td>
                <td><span className={statusBadgeClass(r.status)}>{r.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
