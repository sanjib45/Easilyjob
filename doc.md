# Easily Jobs — Project Documentation & Change Log

Living document. **Update this file whenever logic, architecture, schema, or security behavior changes.**

## Change Log

### 2026-09-19 — Phase 1: Shared Shell Integration & Navigation System
- Created unified master layout [`views/layouts/app-shell.ejs`](file:///c:/Users/santr/OneDrive/Desktop/jobProtalEasily/views/layouts/app-shell.ejs) and partials (`sidebar`, `topbar`, `theme-toggle`, `user-card`, `page-header`, `stat-card`, `empty-state`, `pagination`).
- Created unified stylesheet [`public/css/shell.css`](file:///c:/Users/santr/OneDrive/Desktop/jobProtalEasily/public/css/shell.css) providing CSS variable tokens, responsive drawer rules (`@media (max-width: 1024px)`), desktop toggle hiding (`@media (min-width: 1025px)`), and search input icon padding (`padding-left: 42px`).
- Created role navigation registry [`config/navigation.js`](file:///c:/Users/santr/OneDrive/Desktop/jobProtalEasily/config/navigation.js) with longest-prefix active route matching and badge count capping (`99+`).
- Created [`middleware/shell.js`](file:///c:/Users/santr/OneDrive/Desktop/jobProtalEasily/middleware/shell.js) setting `Cache-Control: private, no-store`.

### 2026-09-19 — Phase 1: Universal Confirmation Modal Implementation
- Extended declarative confirmation modal API (`data-confirm`, `data-confirm-title`, `data-confirm-message`, `data-confirm-action`, `data-confirm-variant="danger|primary"`).
- Applied danger variant to job deletion, logout, and status revocations.
- Applied primary variant to job posting, job editing, candidate status updates, interview scheduling, scorecard saving, and result sharing.
- Added full ARIA accessibility (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`), focus trap, ESC/backdrop cancel, scroll locking, HTML sanitization, double-submit protection, and `pageshow`/bfcache state restoration.
- Created candidate applicant routes (`/applicant/applications` and `/applicant/profile`) resolving 404 links.

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

### 2026-09-19 — Recruiter Portal P1 (Router Restructure) & P2 (Repository Layer & Multi-file Schema)

1. **What changed:**
   - **Route Restructure:** `app.js` now mounts only `routes/index.js`. `routes/recruiter/index.js` applies `authenticate -> requireRole(RECRUITER) -> requireVerified` once and delegates to modular sub-routers (`dashboard.routes.js`, `applicants.routes.js`, `interviews.routes.js`, `jobs.routes.js`).
   - **Bug Fix:** Fixed role casing mismatch in `header.ejs` (`user.role === 'RECRUITER'`).
   - **Prisma Schema Split:** Converted monolithic `schema.prisma` into multi-file domain schemas under `prisma/schema/` (`base.prisma`, `user.prisma`, `job.prisma`, `application.prisma`, `interview.prisma`, `email.prisma`) using `prismaSchemaFolder`.
   - **Model Additions:** Added `InterviewResult` model with strict public-safe projection fields.
   - **Repository Layer:** Created `repositories/application.repository.js`, `repositories/interview.repository.js`, `repositories/job.repository.js`, `repositories/email.repository.js`. Every recruiter repository function takes `recruiterId` as its first parameter to enforce tenant data isolation.
   - **Layering Enforcement:** Refactored `controllers/recruiter.controller.js`, `controllers/job.controller.js`, `services/recruiter-review.service.js`, `services/interview.service.js`, and `services/email-outbox.service.js` so controllers and services never import or query Prisma directly. Extracted `services/dashboard.service.js`.
   - **Smoke Test Fix:** Fixed unthrottled concurrent event listener execution in `scripts/smoke-test.mjs`.

2. **Why:**
   - Enforces strict clean architecture (`router -> validator -> controller -> service -> repository`), prevents tenant data leakage, and ensures scalability.

3. **Schema / env / migration impact:**
   - Schema split under `prisma/schema/`. Run `npm run db:migrate` (or `npx prisma generate`) to sync indexes and client.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Recruiter Portal P3 (Recruiter Layout & Left Sidebar Shell)

1. **What changed:**
   - **Dedicated Recruiter Layout:** Created `views/layouts/recruiter.ejs` with a responsive two-column left-sidebar shell, mobile drawer, and top bar. Public routes retain standard top-navbar layout in `views/layout.ejs`.
   - **Recruiter Sidebar Partial:** Created `views/recruiter/partials/sidebar.ejs` with verified profile info, active route indicators (`/recruiter`, `/jobs/new`, `/recruiter/applicants`, `/recruiter/interviews`), public job board link, and secure logout action.
   - **Design System Stylesheet:** Created `public/css/recruiter.css` implementing responsive layout, mobile drawer animations, audit timeline nodes, form score grids, and shared result banners.
   - **Enhanced Recruiter Views:**
     - `views/recruiter/recruiter-dashboard.ejs`: Stat cards with visual hierarchy, job status indicators (Active/Closed/Expired), candidate counts, quick actions.
     - `views/recruiter/applicants.ejs`: Filter controls (search, job, status, sort, reset), styled candidate list with status badges, pagination.
     - `views/recruiter/applicant-detail.ejs`: Detail grid, resume download, private recruiter notes, interview scheduling, evaluation form with newly added `strengths` and `concerns` fields, share-result card, and status history timeline.
     - `views/recruiter/interviews.ejs`: Scheduled rounds table, evaluation score badges, share-result links.
     - `views/recruiter/interviews/share-result.ejs`: Candidate-safe outcome/summary review and submission form.

2. **Why:**
   - Satisfies Rule 8 requirement for a recruiter layout with responsive left sidebar and mobile drawer without impacting public job seekers.

3. **Schema / env / migration impact:**
   - No schema changes.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Recruiter Portal P4 (Status Transition Policies)

1. **What changed:**
   - **Application Transition Policy:** Created `policies/applicationTransitions.js` with `APPLICATION_TRANSITIONS` graph and `assertApplicationTransition(from, to)`. Blocks illegal jumps (e.g. `HIRED -> NEW` or `REJECTED -> SHORTLISTED`) with a 400 `AppError`. Terminal states (`HIRED`, `REJECTED`) are locked. Same-status submissions are handled as idempotent no-ops (no duplicate history rows or duplicate emails).
   - **Interview Transition Policy:** Created `policies/interviewTransitions.js` with `INTERVIEW_TRANSITIONS` graph and `assertInterviewTransition(from, to)`. Prevents reopening `COMPLETED` or `CANCELLED` interviews.
   - **Service Integration:** Integrated `assertApplicationTransition` into `services/recruiter-review.service.js` and `assertInterviewTransition` into `services/interview.service.js`.

2. **Why:**
   - Satisfies Rule 7 requiring all status transitions to run through `policies/` to ensure data integrity and prevent illegal lifecycle jumps.

3. **Schema / env / migration impact:**
   - No schema changes.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Recruiter Portal P5 (Interviews, Private Evaluations & Share Result Email)

1. **What changed:**
   - **Modular Recruiter Validators:** Created `validators/recruiter/interview.validators.js`, `validators/recruiter/evaluation.validators.js`, and `validators/recruiter/result.validators.js`.
   - **Public-Safe Email Template:** Added `INTERVIEW_RESULT` template to `services/email.service.js`. Strictly projects `{ outcome, summary, applicantName, jobTitle, companyName }` without internal scores or private notes (Rule 5 compliance).
   - **Share Result Logic:** Added `shareInterviewResult` to `services/interview.service.js`. Validates `COMPLETED` status, creates `InterviewResult` DB record, queues `INTERVIEW_RESULT` outbox row, and delivers email idempotently (`INTERVIEW_RESULT:${interviewId}`).
   - **Share Result Routes & View:** Created `GET` and `POST` routes `/recruiter/interviews/:interviewId/share-result` in `routes/recruiter/interviews.routes.js`, rendered via `views/recruiter/interviews/share-result.ejs`.

2. **Why:**
   - Enables recruiters to conduct interview rounds, write private scorecard evaluations, and share candidate-safe outcomes via outbox email while enforcing data privacy boundaries.

3. **Schema / env / migration impact:**
   - Uses `InterviewResult` model created in P2.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Recruiter Portal P6 (In-Process Job Cache & Outbox Retry Worker)

1. **What changed:**
   - **In-Process TTL Cache:** Created `utils/cache.js` exporting `jobCache` (60s default TTL) and `invalidateJobCache()`. Public job board listings (`renderAllJobs` in `controllers/job.controller.js`) check `jobCache` before hitting MongoDB.
   - **Write-Through Invalidation:** Job creation (`handleNewJob`), updates (`handleUpdateJob`), deletions (`handleDeleteJob`), and status changes (`handleCloseJob`) trigger `invalidateJobCache()` to maintain cache freshness. Never caches recruiter routes or applicant data.
   - **Background Outbox Retry Worker:** Created `workers/email-worker.js` exporting `startOutboxWorker()`, `processOutboxTick()`, and `stopOutboxWorker()`.
   - **Lifecycle Integration:** `app.js` initializes `startOutboxWorker()` on startup and gracefully stops the worker on `SIGINT`/`SIGTERM`. Polls pending/failed outbox rows with `attempts < 5` and `nextAttemptAt <= now()`.

2. **Why:**
   - Satisfies Rule 9 requiring cached public job listings and Rule 6 requiring background outbox retries for resilient email delivery.

3. **Schema / env / migration impact:**
   - No schema changes.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Recruiter Portal P7 (Extended Smoke & Multi-Tenant Data Isolation Tests)

1. **What changed:**
   - **Unauthenticated Route Sweeps:** Automated checks in `scripts/smoke-test.mjs` verifying `/recruiter`, `/recruiter/applicants`, and `/recruiter/interviews` return 302 redirects when unauthenticated.
   - **Cross-Tenant Data Isolation Verification:** Automated registering a distinct Recruiter B and attempting cross-tenant access to Recruiter A's candidates/interviews. Verified Recruiter B gets a strict HTTP 404 (zero data leaks across recruiters).
   - **Share Result Lifecycle Guard:** Verified attempting to access `/recruiter/interviews/:id/share-result` before interview status is `COMPLETED` returns an HTTP 400 Bad Request error.
   - **Bounds & Input Hardening:** Verified `?page=9999` returns 200 with an empty array (no 500 crashes) and malicious sort strings (`?sort=DROP TABLE`) fall back safely to `newest`.

2. **Why:**
   - Satisfies Rule 10 requiring comprehensive smoke and multi-tenant isolation tests.

3. **Schema / env / migration impact:**
   - No schema changes.

4. **How to test:**
   - Run `npm test`.

---

### 2026-09-19 — Bug Fix: Optional Timestamps across Models & Legacy MongoDB Patch

1. **What changed:**
   - **Schema Hardening:** Updated `createdAt` and `updatedAt` to optional `DateTime?` across all Prisma domain schemas (`job.prisma`, `user.prisma`, `application.prisma`, `interview.prisma`, `email.prisma`). Regenerated Prisma Client (`npx prisma generate`).
   - **Database Patching:** Added an automatic update migration in [scripts/setup-mongodb.mjs](file:///c:/Users/santr/OneDrive/Desktop/jobProtalEasily/scripts/setup-mongodb.mjs) (`npm run db:migrate`) to set `updatedAt: new Date()` and `createdAt: new Date()` for any legacy documents in MongoDB where timestamp fields were `null` or missing.

2. **Why:**
   - Legacy documents created in MongoDB prior to timestamp fields being enforced had `null` stored in MongoDB. When Prisma loaded records, it threw a 500 error (`Error converting field "updatedAt" of expected non-nullable type "DateTime", found incompatible value of "null"`). Optional timestamp typing in Prisma schema combined with the MongoDB document patch resolves this error for all current and future queries.

3. **Schema / env / migration impact:**
   - Updated `prisma/schema/*.prisma`. Ran `npm run db:migrate` and `npx prisma generate`.

4. **How to test:**
   - Run `npm test` or start app (`npm start`) and open `/jobs`.

---

## When you change something — update this file

Append a dated entry with:
1. What changed  
2. Why  
3. Schema / env / migration impact  
4. How to test
