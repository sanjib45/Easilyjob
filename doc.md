# Easily Jobs — Project Documentation & Change Log

Living document. **Update this file whenever logic, architecture, schema, or security behavior changes.**

---

## Project overview

**Easily Jobs** — server-rendered job portal (Express + EJS):

| Role | Capabilities |
|------|----------------|
| **APPLICANT** | Browse/search jobs, apply with resume |
| **RECRUITER** | Post/edit/delete **own** jobs, view applicants |

**Stack:** Express 5, EJS, Prisma (SQLite dev / Postgres-ready), JWT access + refresh cookies, Nodemailer, Multer, Helmet, express-validator.

---

## How to run

```bash
cp .env.example .env
# Edit .env: set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET (32+ random chars each)
# Optional: EMAIL_USER + EMAIL_PASS for real SMTP

npm install
npm run db:migrate    # creates prisma/dev.db
npm run db:seed       # demo users + jobs
npm run dev
```

**Demo accounts (after seed):**
- `recruiter@demo.com` / `Password123!`
- `applicant@demo.com` / `Password123!`

App: `http://localhost:3000`

---

## Data model (Prisma)

```
User 1──* Job           (recruiterId, onDelete: Cascade)
Job  1──* Application   (jobId, onDelete: Cascade)
User 1──* Application   (applicantId, optional, onDelete: SetNull)
User 1──* RefreshToken   (hashed token, rotation on refresh)
EmailLog                 (audit: sent | failed | skipped)
```

| Model | Purpose |
|-------|---------|
| `User` | Auth identity, role (`APPLICANT` \| `RECRUITER`), email verification |
| `Job` | Listing owned by one recruiter |
| `Application` | One per `(jobId, email)` — unique constraint |
| `RefreshToken` | Opaque refresh token hash, expiry, revoke |
| `EmailLog` | Outbound email audit trail |

**Isolation:** Every job mutation runs `requireJobOwner` — `job.recruiterId === req.user.id`. Recruiter dashboard queries `WHERE recruiterId = current user`.

---

## Auth (JWT)

| Cookie | Content | TTL |
|--------|---------|-----|
| `access_token` | Signed JWT (id, email, role, emailVerified) | ~15 min |
| `refresh_token` | Opaque random; **SHA-256 hash** in `RefreshToken` table | 7 days |

- Login/register → issue both cookies.
- Expired access → silent refresh via refresh cookie (rotation: old token revoked).
- Logout → revoke refresh row + clear cookies.
- CSRF: double-submit (`csrf_token` cookie + `_csrf` form field).

**Email verification:** Required before recruiters can post jobs (`requireEmailVerified`). Banner + `/resend-verification` in layout.

---

## Email

| Type | Trigger |
|------|---------|
| `EMAIL_VERIFY` | Register + resend |
| `APPLICATION_RECEIVED` | Applicant applies |
| `APPLICATION_NOTIFY_RECRUITER` | Applicant applies (to job owner) |

Service: `services/email.service.js` — logs to `EmailLog`. If SMTP unset → `skipped` (dev-safe).

---

## Confirmation modals

Custom modal (`public/js/confirm-modal.js`) replaces `window.confirm` for:
- Logout
- Delete job

Use `data-confirm="message"` + `data-confirm-title` on forms.

---

## Validation

Central validators: `validators/index.js`  
Applied on all POST routes via `validate()` middleware.

Password rules: min 8 chars, letter + number.

---

## Change log

### 2026-09-19 — Recruiter application workspace and interviews

- Added recruiter-wide applicant search, status/job filters, deterministic sorting, and bounded pagination.
- Added recruiter-owned applicant detail pages with protected resume actions and status history.
- Added recruiter-owned interview scheduling, lifecycle updates, and evaluation scorecards with bounded marks.
- Added idempotent shortlist email outbox records and expanded recruiter dashboard metrics/navigation.
- Added smoke coverage for recruiter route protection, application workspace, and interview workspace.

**Verification:** `npm test` passes; Prisma schema validation and touched-module syntax checks pass.

### 2026-07-17 — Production DB, JWT auth, email, modals (IMPLEMENTED)

**Plan:** `IMPLEMENTATION_PLAN.md`

**Database**
- Replaced lowdb JSON with **Prisma + SQLite** (`prisma/dev.db`).
- Migrations: `prisma/migrations/`.
- Seed: `prisma/seed.js`.

**Auth**
- Removed `express-session` / `session-file-store` / `connect-flash`.
- Added JWT **access + refresh** cookies (`services/token.service.js`).
- `middleware/auth.js`: `authenticate`, `requireJobOwner`, `requireEmailVerified`.
- Email verification flow: `/verify-email`, `/resend-verification`.

**Email**
- `services/email.service.js` with HTML templates + `EmailLog`.

**UI**
- Confirmation modal for destructive actions.
- Email verification banner in layout.
- Roles updated to `APPLICANT` / `RECRUITER`.

**Env vars (new)**
- `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `APP_URL`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_DAYS`.

**Removed / deprecated**
- `config/database.js` (lowdb)
- `models/*.js` stubbed deprecated
- `express-session` / `session-file-store` — stop any old server on port 3000 before `npm run dev`

**Smoke test:** `npm run smoke` (uses port 3099)

### 2026-09-18 — Backend production hardening audit

**Fixed:**
- Made `app.js` import-safe and bounded URL-encoded/multipart request sizes.
- Required verified authenticated applicants for submissions and persisted account identity server-side.
- Removed public resume serving; recruiter-owned routes now stream resumes as downloads.
- Added upload cleanup for rejected requests and duplicate persistence, plus private-upload smoke coverage.
- Made refresh-token rotation single-use under concurrency and revoke sessions on token reuse.
- Added constant-time CSRF comparison, hashed verification tokens, bcrypt-compatible password limits, scalar query normalization, and HTML escaping in email templates.

**Production follow-up:**
- SQLite is still the development provider; the PostgreSQL migration and deployment contract remain outstanding.
- Shared rate limiting, object storage/malware scanning, durable email delivery, transaction-safe opening limits, health/readiness, graceful shutdown, structured observability, CSP, and deeper CI integration tests are tracked in `IMPLEMENTATION_PLAN.md`.

**Verification:** `npm run smoke` passes; VS Code diagnostics report no errors in touched backend files.

**Dependencies:** Replaced the placeholder `npm test` script with the smoke test and ran `npm audit fix`; production dependency audit reports zero vulnerabilities.

### 2026-09-18 — Verification banner state fix

Authentication now hydrates the current user from Prisma for valid access tokens instead of trusting the stale `emailVerified` value embedded in an older JWT. After a verification link succeeds, the redirected request immediately sees `emailVerified: true`, so the verification banner is removed without waiting for token expiry.

**Verification:** `npm test` passes and the touched middleware has no diagnostics.

### 2026-09-18 — Phase K core job lifecycle and capacity

- Added `Job.status`, `closedAt`, `publishedAt`, and `applicationsAccepted` to Prisma.
- Added lifecycle and cursor-supporting indexes for jobs and applications.
- Existing application counts are backfilled during migration `20260918052353_job_lifecycle_capacity_indexes`.
- Public listings now show only open, non-expired jobs by default.
- Application creation reserves an opening and creates the application in one transaction, preventing oversubscription under concurrent writes.
- Added recruiter-owned `POST /jobs/:id/close` to stop new applications.

**Verification:** Prisma migration applied to the local database; `npm test`, diagnostics, and `npm audit --omit=dev` pass.

### 2026-09-18 — MongoDB migration setup

- Prisma datasource and models are configured for MongoDB Atlas while preserving existing string IDs.
- Added `npm run db:import:mongodb` to copy records from `prisma/dev.db` into MongoDB using an idempotent SQLite-to-MongoDB importer.
- Changed `npm run db:migrate` to a MongoDB-native collection/index setup script, since MongoDB does not use SQL migration files and Prisma schema push was unreliable for this Atlas connection.
- Added `/health/live` and `/health/ready`; startup performs a real MongoDB ping before logging `MongoDB connected` or listening for traffic.
- Atlas schema push is currently blocked by MongoDB `SCRAM authentication failed`; no remote schema or data was changed.
- The configured MongoDB database user must be granted access to `jobPortal`, the current client IP must be allowed in Atlas Network Access, and the password in `DATABASE_URL` must be the MongoDB database-user password, not the Gmail password.
- The importer normalizes SQLite integer booleans to MongoDB Boolean values and supports `npm run db:import:mongodb:replace` for replacing a partial first import.

### 2026-09-18 — Recruiter verification URL and RBAC flow

- Development verification links now use the request host and port instead of an unreachable hard-coded fallback.
- Production requires `APP_URL` and uses it for public HTTPS verification links.
- Unverified recruiters remain blocked from posting, but are redirected to the recruiter dashboard rather than the applicant job board.
- The MongoDB seed command restores the verified demo recruiter used by the smoke test.

**Verification:** `npm test` passes with recruiter login and dashboard access.

---

### 2026-07-17 — UI redesign

Teal/slate design system, Inter font, SVG icons, sticky header, job cards, hero landing.

---

### 2026-07-17 — Initial hardening (pre-Prisma)

Routes/views, bcrypt, CSRF, helmet, rate limits, multer — superseded by Prisma/JWT upgrade above.

---

## When you change something — update this file

Append a dated entry with:
1. What changed  
2. Why  
3. Schema / env / migration impact  
4. How to test
