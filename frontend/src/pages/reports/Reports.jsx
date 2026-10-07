import React from 'react';
import { Link } from 'react-router-dom';

const REPORTS = [
  { to: '/admin/reports/monthly', label: 'Monthly Sales & Billing Report', icon: '📅' },
  { to: '/admin/reports/stock', label: 'Stock / Sales Analytics', icon: '📦' },
  { to: '/admin/reports/top-products', label: 'Frequently Selling Products', icon: '🏆' },
  { to: '/admin/reports/profit', label: 'Profit & Loss', icon: '💹' },
  { to: '/admin/reports/payments', label: 'Payment Method Report', icon: '💳' },
];

export default function Reports() {
  return (
    <div className="panel">
      <h3>Reports</h3>
      <div className="cards-grid">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="stat-card" style={{ display: 'block' }}>
            <div className="label">{r.icon} {r.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
