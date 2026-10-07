import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';

const COLORS = ['#DC2626', '#F59E0B', '#111827', '#16A34A', '#2563EB', '#7C3AED'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="empty-state">Loading dashboard...</div>;

  const cards = [
    { label: 'Total Products', value: data.totalProducts },
    { label: 'Total Stock Quantity', value: data.totalStockQty },
    { label: 'Total Customers', value: data.totalCustomers },
    { label: "Today's Sales", value: data.todaysSales },
    { label: "Today's Revenue", value: formatCurrency(data.todaysRevenue) },
    { label: 'Monthly Sales', value: formatCurrency(data.monthlySales) },
    { label: 'Monthly Purchases', value: formatCurrency(data.monthlyPurchases) },
    { label: 'Monthly Profit', value: formatCurrency(data.monthlyProfit), cls: 'success' },
    { label: 'Out of Stock', value: data.outOfStock, cls: data.outOfStock ? 'danger' : '' },
    { label: 'Low Stock', value: data.lowStock, cls: data.lowStock ? 'warn' : '' },
    { label: 'Warranty Expiring Soon', value: data.warrantyExpiring, cls: data.warrantyExpiring ? 'warn' : '' },
  ];

  return (
    <div>
      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/admin/sales/new')}>+ New Sale</button>
        <button className="btn btn-accent" onClick={() => navigate('/admin/products')}>+ Add Product</button>
        <button className="btn btn-outline" onClick={() => navigate('/admin/inventory')}>+ Add Stock</button>
        <button className="btn btn-outline" onClick={() => navigate('/admin/customers')}>+ Add Customer</button>
        <button className="btn btn-outline" onClick={() => navigate('/admin/reports')}>View Reports</button>
      </div>

      <div className="cards-grid">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.cls || ''}`}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Monthly Sales / Purchases / Profit</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#DC2626" strokeWidth={2} />
              <Line type="monotone" dataKey="purchases" stroke="#F59E0B" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" stroke="#16A34A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Top Selling Products</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="unitsSold" fill="#111827" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Payment Method Distribution</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data.paymentDistribution} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={100} label>
              {data.paymentDistribution.map((entry, index) => (
                <Cell key={entry.method} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
