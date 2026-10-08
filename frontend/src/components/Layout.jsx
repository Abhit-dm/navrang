import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ADMIN = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/customers', label: 'Customers', icon: '👤' },
  { to: '/admin/products', label: 'Products', icon: '🛞' },
  { to: '/admin/sales', label: 'Sales', icon: '💰', end: true },
  { to: '/admin/sales/new', label: 'New Sale', icon: '🧮' },
  { to: '/admin/invoices', label: 'Invoices', icon: '📄' },
  { to: '/admin/enquiries', label: 'Contact Enquiries', icon: '✉️' },
  { to: '/admin/reports', label: 'Reports', icon: '📈' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin/vehicles', label: 'Vehicles', icon: '🚗' },
  { to: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { group: 'Purchase', icon: '🧾', children: [
    { to: '/admin/purchases', label: 'New Purchase' },
    { to: '/admin/suppliers', label: 'Suppliers' },
  ] },
  { to: '/admin/payments', label: 'Payments', icon: '💳' },
  { to: '/admin/warranties', label: 'Warranties', icon: '🛡️' },
  { to: '/admin/returns', label: 'Returns', icon: '↩️' },
  { to: '/admin/expenses', label: 'Expenses', icon: '💸' },
  { to: '/admin/employees', label: 'Employees', icon: '🧑‍💼' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: '📝' },
];

const NAV_EMPLOYEE = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/customers', label: 'Customers', icon: '👤' },
  { to: '/admin/products', label: 'Products', icon: '🛞' },
  { to: '/admin/sales', label: 'Sales', icon: '💰', end: true },
  { to: '/admin/sales/new', label: 'New Sale', icon: '🧮' },
  { to: '/admin/invoices', label: 'Invoices', icon: '📄' },
  { to: '/admin/enquiries', label: 'Contact Enquiries', icon: '✉️' },
  { to: '/admin/vehicles', label: 'Vehicles', icon: '🚗' },
  { to: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { to: '/admin/warranties', label: 'Warranties', icon: '🛡️' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const nav = isAdmin ? NAV_ADMIN : NAV_EMPLOYEE;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <div className={`overlay-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>NAVRANG TYRES</h1>
          <span>Quality Tyres. Trusted Service.</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => (item.group ? (
            <div key={item.group} className="sidebar-group">
              <div className="sidebar-group-title"><span>{item.icon}</span> {item.group}</div>
              {item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={({ isActive }) => `sidebar-link child${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          )))}
        </nav>
        <div className="sidebar-footer">
          Logged in as {user?.role}<br />
          <Link to="/" style={{ color: 'var(--accent)' }}>← View Website</Link>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
            <h2>NAVRANG TYRES Management</h2>
          </div>
          <div className="topbar-user">
            <span>{user?.name}</span>
            <span className="role-badge">{user?.role}</span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
