# Easily Job Portal

A server-rendered job portal built with Express + EJS. Recruiters post and manage job
listings; applicants browse, search, and apply with a resume upload. Sessions, passwords,
uploads, and validation are all handled with production-appropriate defaults.

## Features

- Session-based auth with hashed passwords (bcrypt), regenerated session IDs on login
- Two roles: **applicant** and **recruiter**, enforced by middleware + ownership checks
  (a recruiter can only edit/delete/view applicants for jobs they posted)
- Persistent JSON-file database (`data/db.json`) via `lowdb` — no external DB required
- File-backed session store (`sessions/`) so logins survive server restarts
- Resume uploads via `multer`, restricted to PDF/DOC/DOCX and a configurable size limit
- CSRF protection on all state-changing requests, security headers via `helmet`,
  gzip via `compression`, request logging via `morgan`
- Rate limiting on login/register/apply endpoints to slow down abuse
- Server-side validation via `express-validator`, with flash-message error feedback
- Centralized error handling (`404`, `403`, and generic error pages — no raw stack traces
  leaked in production)
- Optional outgoing email confirmation on job application (no-ops safely if unconfigured)

## Getting started

```bash
npm install
cp .env.example .env   # then edit .env — at minimum set SESSION_SECRET
npm run dev             # nodemon, auto-restarts on change
# or
npm start                # plain node
```

The app listens on `http://localhost:3000` by default (see `PORT` in `.env`).

## Environment variables

See `.env.example` for the full list with comments. Key ones:

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Required in production. Signs session cookies. |
| `EMAIL_USER` / `EMAIL_PASS` | Optional. If unset, application-confirmation emails are skipped (logged to console instead). |
| `MAX_UPLOAD_SIZE_MB` | Resume upload size limit (default 5MB). |
| `AUTH_RATE_LIMIT_*` | Login/register brute-force throttling window & max attempts. |

## Data & uploads

- `data/db.json` — all users and jobs. Delete it to reset to the seed data (two demo jobs,
  no users). This file is gitignored; back it up if you care about the data.
- `uploads/` — submitted resumes, served at `/uploads/<filename>`. Gitignored.
- `sessions/` — session files. Gitignored.

None of these are meant for multi-instance/horizontally-scaled deployments — for that,
swap `lowdb` for a real database and the file session store for Redis. The app is
structured (models/controllers/routes) so that swap only touches `config/database.js`,
`models/*`, and the session store line in `app.js`.

## Project structure

```
app.js                 App entry point: middleware pipeline, routing, error handling
config/
  env.js               Loads & validates environment variables
  database.js           lowdb instance + seed data
controllers/            Request handlers (business logic)
middleware/              auth, role checks, uploads, CSRF, rate limiting, error handling
models/                 Data access (users, jobs)
routes/                 Express routers, wired with validation + middleware
views/                  EJS templates (layout + partials + pages)
public/                 Static assets (CSS)
utils/                  AppError, asyncHandler
```

## Security notes

- Passwords are hashed with bcrypt (12 rounds); plaintext passwords are never stored.
- CSRF tokens are generated per-session and required on every POST.
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` automatically in production.
- File uploads are restricted by MIME type and size, saved with sanitized filenames.
- Recruiters can only manage jobs they created — verified server-side, not just hidden in the UI.
- No secrets are committed: `.env` is gitignored; `.env.example` documents required vars.

## Known limitations (by design, for a small demo-scale app)

- Single-process JSON file storage — not suitable for concurrent multi-instance deployment.
- No email verification / password reset flow.
- No admin role or moderation tools.
