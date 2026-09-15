# THET Fund Todo List (MVP)

A frontend-only office task manager. No backend, no database — all tasks are
stored in the browser via `localStorage`, per the project's SRS.

## What's included in this MVP

- Dashboard with live stats (total / to do / in progress / completed), an
  "Needs attention" list of overdue and due-today tasks, and recently
  updated tasks.
- Full task CRUD: create, edit, delete, duplicate, mark complete.
- Priority (low/medium/high/urgent), status (to do/in progress/completed/on
  hold), category (built-in list + custom categories), and due dates.
- Search, filter (status/priority/category), and sort (newest, oldest, due
  date, priority, alphabetical).
- Import/export as JSON, plus export as CSV, and a "delete everything"
  option with a confirmation step.
- Light / dark / system theme, saved to `localStorage`.
- Responsive layout: sidebar nav on desktop, bottom nav + floating "+" on
  mobile.

Not yet built (flagged as follow-ups in the SRS): calendar view and
subtasks. The `Task` type already has a `subtasks` field so this can be
added later without a data migration.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Building for production

```bash
npm run build
npm run preview   # optional: preview the production build locally
```

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, "Add New Project" → import the repository.
3. Framework preset: **Vite**. Build command `npm run build`, output
   directory `dist` (Vercel usually detects these automatically).
4. Deploy. Every push to the connected branch will trigger a new deployment.

## Important limitation

Tasks are stored **per browser, per device** using `localStorage`. Two staff
members opening the app on separate computers will each see only their own
tasks — there is no shared/central data store. This is expected for a
frontend-only tool; adding a shared view for the whole office would require
a backend and database, which is intentionally out of scope for this MVP.

Because there's no backend, don't put confidential, financial, HR, or grant
data into this tool — see the Settings page for export/backup options.
