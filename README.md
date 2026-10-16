# NAVRANG TYRES — Tyre Shop Management System

A complete full-stack Tyre Shop Management System: authentication, inventory,
billing (GST / Non-GST), invoices, payments, warranties, purchases, suppliers,
customers, vehicles, expenses, reports, and profit calculations. Built to run
entirely on localhost with a persistent SQLite database.

> No credentials are embedded in the application. Configure the administrator
> email and strong password through the backend environment before seeding.
> No real payment gateway is integrated — UPI/PhonePe/Google Pay/cards/net
> banking/wallet are recorded as payment methods only.

## 1. Technology Stack

**Frontend:** React 18, Vite, React Router, Recharts, Axios, modern responsive CSS
**Backend:** Node.js, Express.js, REST APIs, JWT auth, bcryptjs password hashing
**Database:** SQLite + Prisma ORM (migrations + seed)

## 2. Folder Structure

```
navrang-tyres/               (root: e:\navrang)
├── frontend/                 React + Vite app
│   ├── src/
│   │   ├── api/               axios client
│   │   ├── components/        Layout, ProtectedRoute
│   │   ├── context/           AuthContext (JWT)
│   │   ├── pages/              all screens (admin/employee dashboards,
│   │   │                       customers, vehicles, products, inventory,
│   │   │                       suppliers, purchases, billing, invoices,
│   │   │                       payments, warranties, expenses, employees,
│   │   │                       settings, audit logs, reports/*)
│   │   ├── styles/index.css    design system (colors, cards, tables, print)
│   │   └── utils/format.js
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/            auth, customers, vehicles, products, inventory,
│   │   │                       suppliers, purchases, sales, invoices, payments,
│   │   │                       warranties, expenses, reports, settings, audit,
│   │   │                       employees, search
│   │   ├── middleware/        auth (JWT verify + RBAC), errorHandler
│   │   ├── utils/              money (decimal-safe), codes (doc numbering),
│   │   │                       audit, stock (FIFO stock reduction)
│   │   └── index.js            Express app entry
│   ├── prisma/
│   │   ├── schema.prisma        all data models
│   │   ├── seed.js               business settings and admin provisioning
│   │   └── migrations/
│   ├── package.json
│   └── .env / .env.example
│
├── database/
│   └── navrang_tyres.db        SQLite database file (persists across restarts)
│
├── package.json                 root scripts (setup/dev)
└── README.md
```

## 3. Installation

From the project root (`e:\navrang`):

```powershell
npm install                     # installs root dev tool (concurrently)
npm run setup                   # installs deps, generates Prisma client, and
                                 # runs migrations and configured admin provisioning
```

`npm run setup` runs, in order:
```
npm install --prefix backend
npm install --prefix frontend
npx prisma generate   (in backend)
npx prisma migrate dev --name init   (in backend)
npx prisma db seed    (in backend)
```

If you prefer to run these manually:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ../frontend
npm install
```

## 4. Database

- Engine: SQLite
- File: `database/navrang_tyres.db` (relative to `backend/.env`:
  `DATABASE_URL="file:../database/navrang_tyres.db"`)
- Data **persists** across restarts (verified: products, stock, customers,
  sales, invoices, payments all survive server restart).
- Prisma Studio (visual DB browser):
  ```powershell
  cd backend
  npx prisma studio
  ```

## 5. Running the Application

From the project root:

```powershell
npm run dev
```
This starts backend (port 5000) and frontend (port 5173) together via `concurrently`.

Or run separately:
```powershell
npm run dev:backend     # http://localhost:5000
npm run dev:frontend    # http://localhost:5173
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Prisma Studio:** `npx prisma studio` (run inside `backend/`)

## 6. Administrator Provisioning

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the backend environment
before running `npm run seed` from `backend/`. The password must be at least
12 characters and include uppercase, lowercase, numeric, and symbol characters.
The seed updates the password hash for an existing administrator with that
email, or creates the account if it does not exist. Passwords are never logged;
do not commit environment files or share the password in source control. Run the
seed against the same `DATABASE_URL` used by the API. Existing records are kept;
review old sample transactions separately before production rather than deleting
sales, invoices, warranties, or their linked products automatically.

## 7. Core Features Implemented

- **Auth & RBAC:** JWT + bcrypt, ADMIN / EMPLOYEE roles enforced on the
  backend (not just hidden buttons) — attempts by employees to hit admin-only
  endpoints return `403 Forbidden`.
- **Customers & Vehicles:** auto-generated customer codes (`CUS-YYYY-000001`),
  search, full profile (vehicles, invoices, warranties, payments).
- **Products & Inventory:** tyre-specific fields (size/width/profile/rim,
  speed rating, load index, tube type, pattern), batch-based inventory,
  automatic stock status (IN STOCK / LOW STOCK / OUT OF STOCK), FIFO stock
  reduction, full stock movement history.
- **Purchases:** increases inventory automatically per purchase item.
- **Billing / Sales:** cart-style UI, product search pulled live from
  inventory (no manual typing), stock-availability validation ("Insufficient
  stock" errors), GST and Non-GST invoice modes, CGST+SGST vs IGST split based
  on business vs customer state, decimal-safe rounding (paise-based rounding
  helper, no naive floating point math).
- **Invoices:** auto-numbered (`INV-YYYY-000001`), full tax breakdown, browser
  print layout (`@media print`, A4-friendly, sidebar/nav hidden), invoice
  history with filters, admin-only cancel (no hard delete of financial data).
- **Payments:** UPI / PhonePe / Google Pay / Debit Card / Credit Card / Net
  Banking / Wallet / Cash / Cash on Delivery recorded as payment methods with
  optional reference numbers; PAID / PARTIALLY PAID / PENDING tracking with
  due-amount calculation and additional payment recording against dues.
- **Warranties:** auto-created on sale when a product has a warranty type,
  auto-calculated end date, status computed (ACTIVE / EXPIRING SOON /
  EXPIRED), claim workflow.
- **Expenses & Profit:** Gross Profit = Revenue − COGS (COGS from recorded
  purchase cost of sold inventory, not "all purchases"), Net Profit = Gross
  Profit − Expenses, plus a clearly-labeled separate "Billing vs Purchase
  Summary" cash-flow view.
- **Reports:** dashboard KPIs + charts (monthly sales/purchases/profit, top
  products, payment distribution), monthly sales/billing report, stock
  analytics, top-selling products (date range filters), profit & loss,
  payment-method report — all computed from real database data, plus CSV
  export where applicable.
- **Audit Log:** login/logout, entity create/update, stock changes, sales,
  invoices, payments, warranties, settings changes — stored with user, action,
  entity, entity ID, timestamp (never stores passwords).
- **Settings:** business profile, GSTIN/state/state code, invoice prefix,
  default GST %, low-stock threshold, warranty-expiry alert window, terms,
  footer, negative-stock toggle.
- **Responsive design:** desktop sidebar, tablet collapsible sidebar, mobile
  hamburger menu with off-canvas sidebar, stacking cards/forms, scrollable
  tables.

## 8. Security Notes

- Passwords hashed with bcrypt; never returned by any API response.
- JWT-based auth with role checks enforced server-side on every protected
  route.
- Helmet + CORS configured; environment variables via `.env` (see
  `backend/.env.example`); `.env` is git-ignored.
- Financial records (invoices, sales) are never hard-deleted — invoices are
  marked `CANCELLED` instead.

## 9. Known Limitations

- No real payment gateway integration — all payment methods are recording
  options only, as required by the spec.
- Barcode scanning via camera is not wired up (SKU/barcode search works;
  hardware scanner integration is a future enhancement).
- Single-location shop model (no multi-branch/warehouse support).
- Opening-stock figures in the monthly report are derived arithmetically
  (closing stock − purchases + sales) rather than from a persisted daily
  snapshot ledger.
