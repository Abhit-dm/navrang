# Security Audit Report

## Executive Summary

**Overall security rating: High risk (not production-ready).**

The application has a sound authentication middleware and uses parameterized Prisma queries, but the authorization model is incomplete. Multiple sensitive write operations are available to every authenticated employee, and there is no login throttling, token revocation, or secure password policy. The frontend role checks are not a security boundary.

The audit was performed without modifying application source code, databases, or configuration. Existing uncommitted application changes were preserved.

## Scope and Method

- Reviewed the complete backend route tree, authentication middleware, Prisma schema and migration, frontend routing and rendering, API client, configuration, dependency manifests, and seeded data.
- Reviewed source for SQL injection, command injection, SSRF, path traversal, unsafe deserialization, XSS, CSRF, token handling, authorization, input validation, and business integrity.
- Ran `prisma validate`, JavaScript syntax checks, the Vite production build, backend health check, and non-destructive authenticated API checks.
- Ran backend and frontend dependency audits.
- Did not execute destructive transactions, alter records, reset passwords, or use production credentials.
- No automated security or integration test suite is configured.

## Findings

### 1. Critical: Employee role can perform privileged financial and inventory operations

**Evidence**

- `backend/src/routes/customers.js:10` applies only authentication to customer reads and writes.
- `backend/src/routes/vehicles.js:7` applies only authentication to vehicle reads and writes.
- `backend/src/routes/sales.js:12` applies only authentication; `POST /` at line 142 and `PUT /:id` at line 401 are available to all employees.
- `backend/src/routes/payments.js:9-26` allows any authenticated user to record payments and update invoice balances.
- `backend/src/routes/invoices.js:11-95` allows any authenticated user to list and view invoices and generate PDFs.
- `backend/src/routes/reports.js:6-325` allows any authenticated user to access all financial and operational reports.
- `backend/src/routes/enquiries.js:7-47` allows employees to update customer contact records and only admins to delete them.

**Impact**

An employee can create or modify sales, alter invoice dates and payment methods, create payments, reduce inventory, and access customer and financial data. This is a direct privilege escalation from a low-privilege employee role to business-critical operations.

**Remediation**

- Apply `authorize('ADMIN')` to customer and vehicle writes, payment creation, sales creation and editing, invoice cancellation, and sensitive report endpoints where appropriate.
- Define a distinct `SALE_OPERATOR` or `FINANCE` role if employees need partial access.
- Use object-level authorization for every record, not only role checks.
- Add endpoint tests that prove an employee receives `403` for every privileged action.

### 2. Critical: Payment and invoice integrity is not protected by the role boundary

**Evidence**

- `backend/src/routes/payments.js:26-75` accepts any authenticated user and creates a payment against an invoice.
- `backend/src/routes/sales.js:401-433` permits all authenticated users to modify sale and invoice dates and payment method.
- `backend/src/routes/sales.js:142-399` allows any authenticated employee to create a sale, reduce stock, create an invoice, and create a payment in one transaction.

**Impact**

A low-privilege user can manipulate billing dates, payment status, payment method, and outstanding balances. The code also allows an employee to select a payment amount up to the invoice due amount, but does not require an approval or payment verification workflow.

**Remediation**

- Restrict payment recording to authorized finance/admin roles.
- Require a separate payment verification state and immutable payment audit trail.
- Validate invoice ownership and business context before changing balances.
- Add reconciliation checks against payment provider or cashier records.

### 3. High: Login and password handling are insufficient

**Evidence**

- `backend/src/routes/auth.js:10-29` has no rate limit, lockout, or failed-attempt tracking.
- `backend/src/routes/employees.js:19-40` requires only a minimum password length of six characters.
- `backend/prisma/seed.js:34-58` creates predictable demo accounts with passwords `Admin@123` and `Employee@123`.
- `backend/.env.example:1-5` provides a placeholder JWT secret and an insecure default configuration.

**Impact**

Brute-force attacks are possible, and password spraying is not detected. Seeded credentials can become live credentials if the database is deployed without replacement. Weak passwords significantly reduce account protection.

**Remediation**

- Add rate limiting and progressive delays to login.
- Add failed-login tracking and temporary account lockout or verification requirements.
- Enforce a strong password policy, including length and complexity; require password changes on first use.
- Remove seed credentials from production deployment paths and use a one-time secure bootstrap process.
- Require JWT_SECRET to be a strong, randomly generated value and fail startup if absent or weak.

### 4. High: JWTs are not revocable and logout is only a log event

**Evidence**

- `backend/src/routes/auth.js:33-36` logs logout but does not invalidate the token.
- `backend/src/middleware/auth.js:4-24` verifies only signature and expiration and does not consult a revocation list.
- `frontend/src/context/AuthContext.jsx:19-21` stores the token in localStorage.
- `frontend/src/api/client.js:5-9` automatically attaches the token to every request.

**Impact**

A stolen token remains valid until its expiration. A user who logs out continues to be authenticated with the same token. Any successful XSS can read the token from localStorage and replay it.

**Remediation**

- Add server-side token versioning or a revocation table and check it during authentication.
- Issue short-lived access tokens with rotating refresh tokens stored in secure HttpOnly cookies where feasible.
- If localStorage must be used temporarily, add token binding, a short lifetime, and a strict CSP.
- Revoke all active tokens when an account is disabled, password reset, or role changed.

### 5. High: Public settings can become unsafe URL schemes or untrusted script sources

**Evidence**

- `backend/src/routes/public.js:6-11` exposes selected business settings to anonymous users.
- `backend/src/routes/public.js:46-49` returns those fields without URL validation.
- `frontend/src/components/public/PublicLayout.jsx:38-79` renders settings values in `href`, `target="_blank"`, and an iframe source.
- `frontend/src/pages/public/Contact.jsx:51-53` renders contact links from settings.

**Impact**

An admin can configure a dangerous URL such as `javascript:` or a malicious external destination. A compromised admin account or unsafe settings interface can create phishing links, script-capable links, or unsafe iframe content. React normally escapes text, but URL schemes and iframe sources remain security-sensitive.

**Remediation**

- Validate all public URLs with an allowlist for `https:` and permitted hosts.
- Validate image URLs and map URLs separately.
- Add `rel="noopener noreferrer"` to all external links; the current code uses this in the public layout but should be enforced centrally.
- Add a restrictive CSP and `frame-src` allowlist.

### 6. High: Client-side authorization is not sufficient

**Evidence**

- `frontend/src/components/ProtectedRoute.jsx` and `frontend/src/App.jsx` restrict only the UI.
- The backend routes independently enforce authentication and, in some cases, admin authorization.
- Several writable routes lack admin authorization entirely.

**Impact**

A user can bypass the frontend and call API endpoints directly. UI restrictions may create inconsistent expectations and leave sensitive operations exposed.

**Remediation**

- Treat the backend as the only authorization authority.
- Add route-level role and object-level checks for every write.
- Build tests that exercise the API independently of the browser.
- Avoid exposing endpoint names or server details in client-side route decisions.

### 7. High: No input size, type, or structural limits on many write endpoints

**Evidence**

- `backend/src/index.js:9-11` uses `express.json()` with the default limit and no content-type or body schema validation.
- `backend/src/routes/vehicles.js:33-53` accepts unbounded strings and values and calls `Number()` without validating the resulting value.
- `backend/src/routes/customers.js:76-128` accepts arbitrary business fields without length limits.
- `backend/src/routes/sales.js:142-238` validates several numeric fields but does not constrain text length or total item count.
- `backend/src/routes/payments.js:26-48` does not bound `referenceNumber` or payment metadata.

**Impact**

Oversized bodies can consume memory or database resources. Malformed values can trigger database errors, inconsistent records, or excessive work. The current `express.json()` default is approximately 100 KB, but this is a weak application-level boundary.

**Remediation**

- Add a shared validation layer with maximum lengths, allowed enums, numeric ranges, and maximum array sizes.
- Reject unknown properties where appropriate.
- Use a request body limit tailored to each endpoint.
- Return consistent validation errors without exposing Prisma details.

### 8. High: No database-level constraints for role and business-state integrity

**Evidence**

- `backend/prisma/schema.prisma` uses String fields for role, status, disposition, and other controlled values.
- `backend/prisma/schema.prisma:10-18` permits any string in the user role field.
- `backend/prisma/schema.prisma:183-198` permits arbitrary status values on sales and invoices.
- `backend/prisma/schema.prisma:119-137` permits arbitrary inventory dispositions.

**Impact**

The database can contain invalid roles or states, and application validation may be bypassed by direct database or future API writes. This weakens invariants and complicates audit and authorization logic.

**Remediation**

- Use checked application validation and database constraints where supported.
- Add a database-level check constraint or policy for user roles and state transitions.
- Keep an authoritative state machine for sales, invoices, warranty claims, replacements, and returns.

### 9. Medium: Seeded privileged credentials and sensitive demo data can be deployed accidentally

**Evidence**

- `backend/prisma/seed.js:34-58` creates known administrator and employee credentials.
- The seed process is exposed through the package script and uses the same database that the application uses.
- Seed data includes personal contact details, GSTINs, financial records, and business settings.

**Impact**

A developer who runs the seed against a shared or production database creates a publicly known administrative account. This is especially dangerous when credentials are reused or the seed is run by mistake.

**Remediation**

- Remove deterministic credentials from the seed process.
- Require a secure bootstrap command that creates the first administrator with an interactive password.
- Add a clear production guard that refuses to seed against a non-local database.
- Ensure demo data is never displayed in production.

### 10. Medium: Authentication and public routes lack abuse controls

**Evidence**

- `backend/src/routes/auth.js:10-29` lacks rate limiting.
- `backend/src/routes/public.js:100-130` has an in-memory rate limiter, but it is process-local and does not persist across restarts or multiple instances.
- `backend/src/routes/public.js:100-130` does not prevent duplicate submissions from a different source address.

**Impact**

Credential stuffing and enquiry flooding are possible. A multi-instance deployment can bypass the enquiry limiter, and memory is lost on process restart.

**Remediation**

- Add centralized rate limiting with Redis or a database-backed counter for production.
- Add CAPTCHA or verification for contact forms if abuse becomes significant.
- Add email or phone verification for public enquiries where appropriate.

### 11. Medium: Direct object access and inventory of user data are not always scoped

**Evidence**

- `backend/src/routes/customers.js:53-72` returns all customer records, vehicles, invoices, payments, and warranties to any authenticated user.
- `backend/src/routes/invoices.js:23-95` returns all invoices and customer data to any authenticated user.
- `backend/src/routes/payments.js:11-23` returns all payment records to any authenticated user.
- `backend/src/routes/reports.js:14-332` exposes broad business data to any authenticated user.

**Impact**

Employees should not automatically receive all customer and financial data. Even if they are trusted employees, the application's data model permits unnecessary access and increases the blast radius of account compromise.

**Remediation**

- Scope customer, invoice, payment, and report queries by authenticated employee ownership or assigned role.
- Return only fields required for the current operation.
- Apply row-level access tests for customer and invoice identifiers.

### 12. Medium: Dependency vulnerabilities

**Evidence**

- Backend audit: three high-severity findings in `braces`, `chokidar`, and `nodemon` development tooling.
- Frontend audit: two high and three moderate findings involving `esbuild`, `vite`, `react-router`, `react-router-dom`, and `source-map-js`.
- The current manifests use older package ranges and do not contain an automated dependency-update policy.

**Impact**

The vulnerable packages are primarily development tooling or routing dependencies. Production exposure depends on whether development tooling is deployed or reachable, but vulnerable routing packages can affect client-side routing behavior and may introduce denial of service or unsafe URL handling.

**Remediation**

- Upgrade to supported versions of Vite, React Router, and Prisma.
- Run `npm audit fix` and inspect every major-version upgrade.
- Separate development dependencies from production dependencies and audit production and development artifacts independently.
- Add a CI dependency-audit step and lock file checks.

### 13. Medium: Error handling can disclose internal details

**Evidence**

- `backend/src/middleware/errorHandler.js` was reviewed, but the exception serializer must be checked against production deployment behavior.
- The current server uses development `morgan` logging in all environments via `backend/src/index.js:11`.

**Impact**

Stack traces, query details, database paths, or internal validation messages may be exposed if the error handler is not production-safe. Development logs can contain customer names, contact details, or credentials in request data.

**Remediation**

- Return generic errors in production while retaining detailed records in a protected log system.
- Redact authorization headers, passwords, tokens, and sensitive request bodies from logs.
- Use environment-aware logging and disable development logging in production.

### 14. Low: Public URL and image content is not validated

**Evidence**

- `backend/src/routes/public.js:24-43` returns product image URLs and profile fields directly.
- `frontend/src/components/public/ProductCard.jsx:12` renders the image URL in an `img` element.
- Public settings fields are returned without URL validation.

**Impact**

An attacker with product or settings write access can store malformed or tracking URLs. This can create unwanted network requests, privacy leakage, or browser-specific unsafe schemes.

**Remediation**

- Validate image and URL fields against a strict scheme and host allowlist.
- Add referrer policy and content-security restrictions.
- Use a signed or controlled object-storage URL for product images.

## Authorization Matrix

| Area | Intended access | Current server behavior | Risk |
| --- | --- | --- | --- |
| Login and profile | Public / authenticated | Public login; authenticated profile | No rate limiting; token remains valid after logout |
| Product catalog | Public | Public read-only | Safe only if public fields remain selected |
| Customer data | Authenticated / admin | Any authenticated user can list, view, and modify | Excessive access and write privilege |
| Vehicle data | Authenticated / admin | Any authenticated user can create and modify | Excessive access and write privilege |
| Sales | Authenticated / admin | Any authenticated user can create, view, and modify | High integrity risk |
| Payments | Authenticated / admin | Any authenticated user can create payments | High integrity risk |
| Invoices | Authenticated / admin | Any authenticated user can read and generate PDF | Excessive access |
| Reports | Authenticated / admin | Any authenticated user can read all reports | Excessive access |
| Inventory | Authenticated / admin | Reads are broad; stock add/adjust are admin-only | Stock reads may be excessive |
| Suppliers and purchases | Authenticated / admin | Reads are broad; writes are admin-only | Supplier data access may be excessive |
| Expenses | Admin | Admin-only | Correctly protected |
| Employees | Admin | Admin-only listing and management | Correctly protected |
| Settings | Admin | Admin-only update | Correctly protected |
| Audit logs | Admin | Admin-only | Correctly protected |
| Warranty claims and returns | Admin | Admin-only operational actions | Correctly protected |
| Contact enquiries | Public submission / admin viewing | Public submission; authenticated users can view and update | Employee update access should be reviewed |

## Testing Results

- `prisma validate`: Passed.
- Backend JavaScript syntax checks: Passed.
- Frontend production build: Passed.
- Backend health endpoint: Returned `status: ok`.
- Incorrect seeded administrator credentials: Returned `Invalid credentials`.
- Correct seeded administrator credentials: Successfully authenticated and returned warranty records.
- VS Code diagnostics: No reported errors.
- No application files were modified during the audit.
- Dependency audits: Eight findings were reported: three high backend development-tool findings and five frontend findings consisting of two high and three moderate findings.
- Automated unit, integration, API security, and business-rule tests: Not configured.

## Security Controls Already Present

- JWT signature and expiration verification.
- Password hashing with bcrypt cost 10.
- Route-level authentication middleware.
- Admin role checks for sensitive routes.
- Prisma parameterization for database queries.
- Helmet, CORS, JSON parsing, and centralized error handling.
- Public product filtering and limited enquiry fields.
- Input validation in several customer, sale, payment, and warranty handlers.
- Audit logging for selected authentication, financial, and operational actions.
- No direct `dangerouslySetInnerHTML`, `eval`, or dynamic script construction was found in the frontend.

## Recommended Remediation Order

1. **Block employee access to privileged operations.** Add admin checks to customer/vehicle writes, sales, payments, and sensitive report paths.
2. **Add login abuse controls.** Rate limit login, enforce password policy, and remove seeded default credentials.
3. **Implement token revocation and secure storage.** Use short-lived tokens and secure HttpOnly cookies where possible.
4. **Introduce explicit business state machines and validation.** Validate roles, invoice states, payment states, and stock operations.
5. **Upgrade vulnerable dependencies and add CI audits.**
6. **Add automated tests.** Cover authentication, authorization, IDOR, input validation, business rules, and report access.
7. **Harden public URLs and logging.** Validate external links and redact sensitive request fields.
8. **Review production deployment configuration.** Require a strong JWT secret, production-specific CORS, secure database permissions, and environment-aware logging.

## Suggested Acceptance Criteria

- A normal employee cannot call any admin-only endpoint.
- A normal employee cannot read or modify customer, invoice, payment, or financial data outside an approved scope.
- A logged-out user cannot reuse a previously issued token.
- Login failures trigger throttling and account lockout or verification.
- All production deployments reject placeholder secrets and seeded credentials.
- Every write endpoint returns `403` or `404` when the caller lacks the required object-level permission.
- Dependency audit reports no unreviewed critical or high findings.
- Automated authorization tests pass for every route.
- Production logs do not contain bearer tokens, passwords, or sensitive customer fields.
