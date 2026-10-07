import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PublicLayout from './components/public/PublicLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';

import Home from './pages/public/Home.jsx';
import About from './pages/public/About.jsx';
import PublicProducts from './pages/public/PublicProducts.jsx';
import ProductDetail from './pages/public/ProductDetail.jsx';
import Contact from './pages/public/Contact.jsx';

import Login from './pages/Login.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import EmployeeDashboard from './pages/employee/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Products from './pages/Products.jsx';
import Inventory from './pages/Inventory.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Purchases from './pages/Purchases.jsx';
import Sales from './pages/Sales.jsx';
import SaleView from './pages/SaleView.jsx';
import Billing from './pages/Billing.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Payments from './pages/Payments.jsx';
import Warranties from './pages/Warranties.jsx';
import WarrantyDetail from './pages/WarrantyDetail.jsx';
import Expenses from './pages/Expenses.jsx';
import Employees from './pages/Employees.jsx';
import Enquiries from './pages/Enquiries.jsx';
import Settings from './pages/Settings.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Reports from './pages/reports/Reports.jsx';
import Monthly from './pages/reports/Monthly.jsx';
import StockReport from './pages/reports/StockReport.jsx';
import TopProducts from './pages/reports/TopProducts.jsx';
import Profit from './pages/reports/Profit.jsx';
import PaymentsReport from './pages/reports/PaymentsReport.jsx';

function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
}

function LegacyInvoiceRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/invoices/${id}`} replace />;
}

const adminOnly = (el) => <ProtectedRoute adminOnly>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="products" element={<PublicProducts />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="contact" element={<Contact />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="suppliers" element={adminOnly(<Suppliers />)} />
        <Route path="purchases" element={adminOnly(<Purchases />)} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/new" element={<Billing />} />
        <Route path="sales/:id" element={<SaleView />} />
        <Route path="billing" element={<Navigate to="/admin/sales/new" replace />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="payments" element={<Payments />} />
        <Route path="warranties" element={<Warranties />} />
        <Route path="warranties/:id" element={<WarrantyDetail />} />
        <Route path="expenses" element={adminOnly(<Expenses />)} />
        <Route path="employees" element={adminOnly(<Employees />)} />
        <Route path="enquiries" element={<Enquiries />} />
        <Route path="settings" element={adminOnly(<Settings />)} />
        <Route path="audit-logs" element={adminOnly(<AuditLogs />)} />
        <Route path="reports" element={adminOnly(<Reports />)} />
        <Route path="reports/monthly" element={adminOnly(<Monthly />)} />
        <Route path="reports/stock" element={adminOnly(<StockReport />)} />
        <Route path="reports/top-products" element={adminOnly(<TopProducts />)} />
        <Route path="reports/profit" element={adminOnly(<Profit />)} />
        <Route path="reports/payments" element={adminOnly(<PaymentsReport />)} />
      </Route>

      {/* Old admin URLs from before the /admin prefix existed */}
      <Route path="/employee/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/billing" element={<Navigate to="/admin/sales/new" replace />} />
      <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
      <Route path="/invoices/:id" element={<LegacyInvoiceRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
