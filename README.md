# THET Fund Task Tracker

THET Fund Task Tracker is a responsive, multi-user task management application. The Vite/React client now uses a Node.js/Express API backed by MySQL or MariaDB; account data is no longer stored as the system of record in browser `localStorage`.

## Features

- Dashboard counts for total, completed, active, overdue, and follow-up work, with “Needs attention” and “Open follow-ups” lists.
- Create, edit, duplicate, soft-delete, complete, and reschedule tasks.
- To do, In progress, Completed, and On hold statuses; Low, Medium, High, and Urgent priorities.
- Due dates and overdue detection, subtasks with progress, and dated follow-ups with notes and completion status.
- Built-in and custom categories, search, filtering, sorting, and a monthly drag-and-drop calendar.
- Server-generated JSON, CSV, and Word exports; validated JSON import; admin-only organization task reset.
- Per-user theme, default priority, and default category settings.
- Admin user management, category administration, audit-log access, and manager team dashboard.
- One-time preview and append-only import of tasks and preferences from the previous browser-only version. The original local copy can be cleared after a successful import.
- Responsive layouts, loading/error/empty states, and light, dark, and system themes.

## Architecture and access

```text
client/  React 18 + TypeScript + Vite
server/  Node.js + Express + TypeScript REST API
         MySQL/MariaDB via mysql2/promise connection pools
```

The API is versioned under `/api/v1`. The OpenAPI contract is in [`server/openapi.yaml`](./server/openapi.yaml).

| Role    | Access                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| Staff   | Create and manage tasks they created or that are assigned to them.                  |
| Manager | Manage and view all tasks, assign work, and view the team dashboard.                |
| Admin   | Manager capabilities plus user, category, audit-log, and bulk-reset administration. |

The server enforces role and task ownership/assignment rules on every protected endpoint. Hiding an action in the UI is not an authorization boundary.

## Local development with XAMPP

### Requirements

- Node.js 22.12 or newer (Node.js 22/24 LTS recommended) and npm.
- XAMPP with its MySQL/MariaDB service.

### 1. Start MySQL and configure demo database accounts

1. Open the XAMPP Control Panel and start **MySQL**. Apache is only needed if you want to use phpMyAdmin.
2. Open phpMyAdmin at `http://localhost/phpmyadmin` and select the **SQL** tab.
3. Run the contents of [`server/db/demo-setup.sql`](./server/db/demo-setup.sql). It creates the database and local demo accounts using the same credentials as `.env.example`.

This demo setup uses `thet_app` / `test1234` for the runtime account and `thet_migrator` / `admin123` for migrations and seeding. It creates accounts for both `localhost` and `127.0.0.1` to accommodate local MySQL host resolution. The script resets those demo account passwords if they already exist. These credentials are for local demos only; replace them with strong, distinct passwords before deployment. Do not configure the application to connect as `root`.

### 2. Configure the environment

If you do not already have a `.env`, create it from the example in PowerShell at the repository root:

```powershell
Copy-Item .env.example .env
```

Keep the local demo database settings in `.env` matched to `server/db/demo-setup.sql`. Generate two independent secrets (each at least 32 characters), for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Use a different generated value for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. The example administrator password `DemoFund!2026Admin` meets the seed password rules for local demos; replace it and `ADMIN_EMAIL` before deployment. Passwords must be 12–128 characters and contain lowercase, uppercase, a number, and a special character. Common passwords are rejected. Never commit `.env`.

For local development, keep `CLIENT_ORIGIN=http://localhost:5173` and `COOKIE_SECURE=false`. The client’s Vite development server proxies `/api` to `http://localhost:4000`; no permissive wildcard CORS setting is used.

### 3. Install, migrate, and seed

Run these commands from the repository root:

```powershell
npm install
npm run migrate
npm run seed
npm run dev
```

`npm run migrate` applies versioned SQL files from `server/db/migrations` using the migration account. The weekly plans migrations create the page's storage, load the plans shown in the sample for the current week, and add per-item status tracking. Signed-in users can view plans; admins and the account configured by `WEEKLY_PLAN_EDITOR_EMAIL` can add, edit, delete, and update item statuses (Completed, Ongoing, or Follow-up). `npm run seed` creates the first administrator and built-in categories from the `ADMIN_*` environment variables; it refuses to replace an existing admin. The API then uses only `DB_USER`/`DB_PASSWORD`.

Open the Vite URL shown in the terminal (normally `http://localhost:5173`) and sign in with the seeded admin email/password. Admins create additional accounts; public registration is intentionally disabled. The API health check is `http://localhost:4000/healthz`.

Useful root commands:

```powershell
npm run dev          # Run client and API together
npm run build        # Production build for both workspaces
npm test             # Backend security and schema tests
npm run lint         # ESLint for client and server
npm run format       # Format supported project files with Prettier
npm run format:check # Check formatting without changing files
npm run migrate      # Apply outstanding database migrations
npm run seed         # Create the initial administrator and built-in categories
```

To connect a production client hosted on a different origin, set the client build variable `VITE_API_BASE_URL` to the API’s full `/api/v1` URL. Set the server’s `CLIENT_ORIGIN` to the exact client origin. For cross-site cookie deployments, use HTTPS, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=none`; browsers may restrict third-party cookies, so a same-site API subdomain or reverse proxy is preferred. Local development needs no client environment file.

## Database and security notes

- Migrations use InnoDB and `utf8mb4`, UUID identifiers, foreign keys, indexes, enums/check constraints, and soft deletion for tasks.
- The runtime database pool uses the least-privilege DML account. Schema migration and seeding use separate credentials.
- Authentication uses Argon2id password hashes, 15-minute access JWTs, rotating seven-day refresh tokens stored only as HMAC hashes, refresh-family reuse detection, CSRF double-submit validation, and HttpOnly cookies.
- Login uses a generic credential error and locks an account after five failed attempts for 15 minutes. Login, refresh, and password-change endpoints have stricter rate limits.
- Express applies Helmet/CSP, exact-origin credentialed CORS, body and upload limits, request timeouts, HPP, compression, and structured request logging with secret redaction and request IDs.
- Inputs are validated with strict Zod schemas. SQL values are bound parameters; user-controlled sorting is restricted to a fixed allow-list.
- Audit entries are written for authentication events, user administration, deletes, task resets, password changes, and exports.
- The legacy browser import is append-only, capped at 1 MB and 500 tasks, and validated before database writes. It never runs uploaded content. Browser storage is only used for the optional migration preview/marker and is not used for new task persistence.

Backend tests use mocked database calls and do not require a running MySQL service. To verify the schema and seed against a real database, run the local XAMPP steps above. The migration files are intended for MySQL/MariaDB; verify them on the same server version used by your deployment before production rollout.

## Deployment

Vercel can host the static Vite frontend only. The Express API and MySQL/MariaDB database must run separately on a VPS, Render, Railway, or an organization-managed server. Configure `VITE_API_BASE_URL` and exact `CLIENT_ORIGIN` for the deployed origins; preferably use a same-site reverse proxy/custom domain for API requests and cookie handling.

XAMPP is for local development and testing, not production. Before production:

- Terminate HTTPS at a trusted reverse proxy/TLS endpoint and set `NODE_ENV=production` and `COOKIE_SECURE=true`.
- Generate independent strong JWT secrets; keep runtime DB credentials DML-only and never expose the database publicly.
- Use a managed or hardened MySQL/MariaDB service, restrict firewall access, and configure automated encrypted backups with restore testing.
- Configure proxy trust only for the known proxy hops, log rotation/retention, monitoring, and incident response.
- Set the production client origin and cookie policy explicitly; do not use wildcard CORS.
- Run `npm audit`, the build, lint, and tests as part of release checks; keep dependencies and the OpenAPI contract reviewed and current.

Additional hardening such as MFA, email-based password reset, and centralized backup/retention policies can be added as follow-up work.
