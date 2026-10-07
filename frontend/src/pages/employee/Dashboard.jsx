import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard/employee').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <div>
      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/admin/customers')}>+ New Customer</button>
        <button className="btn btn-accent" onClick={() => navigate('/admin/sales/new')}>+ New Sale</button>
        <button className="btn btn-outline" onClick={() => navigate('/admin/invoices')}>View Invoices</button>
        <button className="btn btn-outline" onClick={() => navigate('/admin/products')}>Search Product</button>
      </div>

      <div className="cards-grid">
        <div className="stat-card"><div className="label">Today's Sales</div><div className="value">{data.todaysSales}</div></div>
        <div className="stat-card success"><div className="label">Today's Revenue</div><div className="value">{formatCurrency(data.todaysRevenue)}</div></div>
        <div className="stat-card"><div className="label">Customers Added Today</div><div className="value">{data.customersToday}</div></div>
        <div className="stat-card warn"><div className="label">Pending Payments</div><div className="value">{formatCurrency(data.pendingAmount)}</div></div>
        <div className="stat-card danger"><div className="label">Low Stock Alerts</div><div className="value">{data.lowStockAlerts}</div></div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Recent Sales</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Sale#</th><th>Customer</th><th>Total</th><th>Date</th></tr></thead>
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.saleNumber}</td>
                    <td>{s.customer?.name}</td>
                    <td>{formatCurrency(s.total)}</td>
                    <td>{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}
                {data.recentSales.length === 0 && <tr><td colSpan={4}>No sales yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3>Recent Customers</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Phone</th></tr></thead>
              <tbody>
                {data.recentCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.customerCode}</td>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                  </tr>
                ))}
                {data.recentCustomers.length === 0 && <tr><td colSpan={3}>No customers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
