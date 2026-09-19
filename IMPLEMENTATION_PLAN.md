# Implementation Plan — Production Auth, Database & Email

> Status: **Phases A–F implemented** (see `doc.md` changelog)

> Production remediation update: the audit fixes below are implemented. The remaining phases are deployment and reliability work required before calling the service production-ready.

## 0. Backend audit and remediation status — 2026-09-18

### Implemented in this pass

- Importing `app.js` no longer binds a network port; the server starts only when run directly.
- Request bodies and multipart fields are bounded; rejected multipart uploads are cleaned up.
- Resume files are private and downloadable only through a recruiter-owned job route.
- Applications require an authenticated, verified applicant and persist the authenticated identity rather than trusting browser-supplied name/email.
- Refresh rotation has an atomic single-use check; reuse of a revoked token revokes the user's remaining refresh sessions.
- CSRF comparison uses constant-time equality.
- Verification tokens are hashed before persistence; new passwords are limited to bcrypt's effective 72-byte input.
- Email HTML escapes user-controlled values; scalar query parameters are normalized.
- Smoke coverage verifies the upload directory is not publicly served.
- Replaced the placeholder `npm test` command with the backend smoke test and remediated the reported npm advisories; `npm audit --omit=dev` is clean.

### Remaining production blockers

1. **Database deployment contract:** `prisma/schema.prisma` still declares SQLite, so setting a PostgreSQL URL is not a supported production migration. Create a PostgreSQL schema/migration baseline, rehearse data migration, and make production startup fail fast unless the approved provider is configured.
2. **Distributed operation:** the in-memory rate-limit store is unsuitable for multiple instances. Move rate limits and refresh-session coordination to Redis or another shared store, then configure proxy hop trust explicitly.
3. **File lifecycle:** local disk uploads do not survive instance replacement and have no malware scan, retention policy, or object-storage backup. Move resumes to private object storage and issue short-lived authorized downloads.
4. **Email reliability:** synchronous request-time delivery can slow or partially fail application submission. Add an outbox/queue, retry policy, idempotency key, and delivery monitoring; keep application creation independent from SMTP availability.
5. **Application capacity:** enforce `Job.openings` in a transaction with a database-safe concurrency strategy, and add an index/reporting query for active applications.
6. **Lifecycle and observability:** add `/health/live` and `/health/ready`, graceful shutdown for HTTP and Prisma, structured request/error logs with request IDs, metrics, and alerting. Do not log credentials, resume contents, or unnecessary personal data.
7. **Verification migration:** existing plaintext verification tokens need a one-time migration or invalidation before enabling the hashed-token flow in an existing database. Change verification from a state-changing GET to a confirmation page plus CSRF-protected POST to avoid link-scanner activation.
8. **Security headers and abuse controls:** replace `contentSecurityPolicy: false` with a tested CSP, add per-account login throttling and account recovery controls, and periodically prune expired/revoked refresh tokens and old email logs.
9. **Test depth and delivery gates:** add integration tests for authorization isolation, CSRF failures, refresh replay, duplicate/racing applications, upload cleanup, email failure, and production config validation. Run migration, test, audit, and smoke gates in CI.

## 0.2 Recruiter master plan

### Current recruiter capabilities

- Verified recruiters can create, edit, close, and delete their own job postings.
- The dashboard shows owned jobs and applicant counts.
- Recruiters can open an applicant list and download resumes through an owner-checked route.
- Application review supports `NEW`, `REVIEWING`, `SHORTLISTED`, `REJECTED`, and `HIRED` states plus a private recruiter note.

### Missing recruiter capabilities and delivery order

#### R1 — Applicant workflow completion

Add candidate detail views, status filtering, notes history, contact actions, and status-change email notifications. Add bulk status updates only after single-record transitions have integration coverage. Every action must remain scoped by both `jobId` and the authenticated recruiter-owned job.

#### R2 — Job lifecycle and listing quality

Support drafts, publish, reopen, expiry, and archive states instead of creating every job as immediately open. Add server-side expiry processing, clear state transitions, preview validation, and recruiter filters for open, closed, draft, and expired jobs.

#### R3 — Recruiter workspace

Add recruiter profile/company details, dashboard search and pagination, applicant counts by status, remaining openings, recent applications, and CSV export. Keep exports owner-scoped, bounded, and free of resume binaries or unnecessary personal data.

#### R4 — Hiring operations

Add interview scheduling with timezone-aware timestamps, recruiter reminders, optional applicant messages, and an audit trail. Introduce an outbox/queue before sending status or interview emails so a mail-provider failure cannot corrupt hiring state.

#### R5 — Analytics and production hardening

Add privacy-conscious job views, conversion summaries, and time-bucketed recruiter analytics. Move resumes to private object storage with malware scanning, retention, and signed downloads; then add authorization, CSRF, concurrency, upload cleanup, email-failure, and export integration tests.

### Recruiter acceptance criteria

- A recruiter cannot read or mutate jobs, applications, notes, exports, or resumes belonging to another recruiter.
- A recruiter can move an application through the supported pipeline, filter the pipeline, and see the persisted state after refresh.
- Public listings never expose drafts, closed jobs, expired jobs, recruiter notes, or resume paths.
- Job openings cannot be oversubscribed under concurrent applications.
- Status changes, interview events, and exports are auditable and covered by automated tests.
- The dashboard remains usable with empty, large, expired, and mixed-status datasets.

## 0.3 Recruiter portal workflow

### Access and role boundary

The existing `isRecruiter` middleware is the correct security boundary. Keep applicant accounts available for applying to jobs, but allow only authenticated users whose persisted role is `RECRUITER` to access recruiter routes, recruiter navigation, applicant records, interview data, scores, notes, exports, and recruiter emails. Do not rely on hidden links or browser-submitted role values.

If the product requirement literally means that applicant accounts must not log in anywhere, disable applicant login only after confirming that applicant applications will be created by another workflow. Otherwise, “recruiter-only login” should mean recruiter-only access to the recruiter portal.

### Recruiter navigation

After login, a recruiter should see a recruiter-specific horizontal navigation bar:

1. **Dashboard** — job totals, open roles, applications, interviews today, and recent activity.
2. **My Jobs** — owned postings, draft/open/closed/expired filters, create, edit, publish, close, and archive.
3. **Applicants** — all applicants for owned jobs, searchable and filterable by job and pipeline status.
4. **Interviews** — upcoming, completed, cancelled, and overdue interviews.
5. **Reviews** — interview scorecards, feedback, recommendations, and email history.
6. **Company Profile** — recruiter identity, company information, contact details, and notification preferences.
7. **Log out** — CSRF-protected POST action.

Applicant links must not appear in the recruiter shell. Every navigation destination must still enforce authentication, recruiter role, email verification where required, and resource ownership on the server.

### Applicant and interview workflow

The recruiter workflow should be:

`NEW -> REVIEWING -> SHORTLISTED -> INTERVIEW_SCHEDULED -> INTERVIEWED -> HIRED | REJECTED`

Recruiters can open an applicant record, view the authorized resume, review all submitted application details, update the pipeline status, add private notes, schedule or reschedule an interview, cancel an interview, and complete an evaluation. Applicants must never see recruiter notes, internal scores, or another applicant’s information.

### Applicant review requirements

The recruiter applicant detail page must show:

- Applicant name, email address, contact number, application date, job title, and current application status.
- The submitted resume through the recruiter-owned download endpoint. The raw upload directory and stored file path must never be exposed in the HTML.
- A recruiter-only notes field and status history.
- Actions for `REVIEWING`, `SHORTLISTED`, `REJECTED`, `INTERVIEW_SCHEDULED`, `INTERVIEWED`, and `HIRED`.
- Interview schedule, attendance/result, marks, recommendation, and approved communication history when those records exist.

The detail query must load an application only when its `jobId` belongs to the authenticated recruiter. Checking only the application ID is insufficient because IDs can be modified in a URL or form.

### Automatic shortlist email

When a recruiter changes an application to `SHORTLISTED`, the application update and notification request must be handled as one reliable workflow:

1. Validate that the recruiter owns the application’s job and that the transition is allowed.
2. Persist the new status and status-history record.
3. Create an idempotent email-outbox record for the applicant.
4. Deliver the shortlist email asynchronously with retry and failure logging.
5. Show the recruiter the saved status immediately, even if the email provider is unavailable.

The shortlist email must include the applicant’s name, job title, company name, confirmation that they were shortlisted, and the next step. It must not include recruiter-only notes, internal marks, private evaluation comments, or another applicant’s data. Repeating the same status update must not send duplicate shortlist emails. A later interview invitation must use a separate approved template and delivery record.

Required email types:

- `APPLICATION_SHORTLISTED`
- `INTERVIEW_INVITATION`
- `INTERVIEW_RESCHEDULED`
- `INTERVIEW_CANCELLED`
- `APPLICATION_REJECTED` (optional product decision, but the template should be prepared)

Email templates must escape user-controlled values, use the applicant’s persisted email address rather than a browser-submitted address, and record `queued`, `sent`, `failed`, or `skipped` delivery state.

### Required data model

- Extend `Application` with status, recruiter note, and status timestamps. Keep the current unique job/application constraint.
- Add `Interview`: application, recruiter, scheduled time, duration, timezone, meeting link or location, status, candidate message, cancellation reason, and audit timestamps.
- Add `InterviewEvaluation`: interview, recruiter, numeric score fields, recommendation, strengths, concerns, and private feedback. Enforce score bounds at both validation and persistence boundaries.
- Add `ApplicationStatusHistory`: application, old status, new status, actor, reason, and timestamp.
- Add `EmailOutbox` or extend the email outbox design with recipient, template type, payload, status, attempts, and idempotency key. `EmailLog` alone is not enough for reliable retries.
- Keep resume metadata private and serve files only through an authenticated, recruiter-owned download handler. The applicant detail page may expose a download action, never the filesystem path.

### Recruiter routes

- `GET /recruiter` — dashboard.
- `GET /recruiter/jobs` — owned job management.
- `GET /recruiter/applicants` — owned applicant search and filtering.
- `GET /jobs/:id/applicants/:applicationId` — candidate detail, owner-scoped.
- `POST /jobs/:id/applicants/:applicationId/status` — pipeline transition.
- `GET /jobs/:id/applicants/:applicationId/resume` — protected resume download.
- `GET /jobs/:id/applicants/:applicationId/interviews` — interview history.
- `POST /jobs/:id/applicants/:applicationId/interviews` — schedule interview.
- `PATCH /recruiter/interviews/:id` — reschedule, cancel, or complete an interview.
- `POST /recruiter/interviews/:id/evaluation` — save scorecard and feedback.
- `POST /recruiter/applications/:id/send-review` — send an approved candidate-facing email.
- `GET /recruiter/exports/applicants.csv` — bounded, owner-scoped export.

All mutations require CSRF protection, validation, rate limits where email is sent, and an explicit ownership query. Candidate-facing emails must use approved templates, escape all user-controlled HTML, and be queued rather than sent inside the request transaction.

### Delivery phases

#### RP1 — Recruiter shell and dashboard

Create the recruiter layout/navigation, dashboard metrics, owned-job filtering, and recruiter-only integration tests.

#### RP2 — Applicant pipeline

Complete candidate detail pages, full submitted applicant details, status transitions, status history, notes, shortlist email queuing, filtering, protected resume access, duplicate-email prevention, and unauthorized-access tests.

#### RP3 — Interview scheduling

Add interview persistence, timezone-safe forms, schedule/reschedule/cancel flows, calendar-ready meeting links, reminders, and candidate notification emails.

#### RP4 — Evaluation and review email

Add scorecards, bounded marks, recommendation, private feedback, recruiter review history, shortlist/interview/rejection email templates, outbox retries, idempotency, and email delivery audit records.

#### RP5 — Operations and quality gate

Add exports, company profile, activity audit, dashboard analytics, pagination, rate limits, concurrency tests, accessibility checks, and end-to-end recruiter workflow tests.

### End-to-end acceptance scenario

An authenticated recruiter can log in, sees only recruiter navigation, opens the dashboard, selects an owned job, reviews an applicant, downloads the protected resume, shortlists the applicant, schedules an interview with timezone and meeting details, records marks and feedback, sends an approved interview-review email, and sees the complete history after refresh. A second recruiter cannot access any of those records by changing an ID in the URL or form.

The shortlist portion of the scenario must also verify that the applicant receives exactly one `APPLICATION_SHORTLISTED` email, that the email contains no private recruiter data, and that the recruiter’s status remains saved when email delivery is delayed or fails.

## 0.4 Placement Cell adaptation implementation plan

This phase adapts the useful Placement Cell workflows to Easily Jobs without copying its global data access or browser-only authorization model.

### Recruiter workspace

- Add a recruiter-specific layout with Dashboard, My Jobs, Applicants, Interviews, Reviews, Company Profile, and Logout navigation.
- Keep recruiter routes under separate route modules and controllers; keep domain behavior in services rather than route handlers.
- Dashboard metrics must be computed from recruiter-owned records only: total jobs, open jobs, total applications, shortlisted applicants, scheduled interviews, completed interviews, and hires.
- Add recent applications and upcoming interviews ordered by stable timestamps.

### Application workspace

- Add a recruiter-wide application list across owned jobs with job, status, date, and applicant search filters.
- Support deterministic sorting by newest, oldest, applicant name, job title, and status.
- Support pagination with bounded page size so one recruiter cannot cause an unbounded query.
- Keep the job-specific application page and the recruiter-wide application page backed by the same service and authorization predicate.
- Applicant detail pages show submitted profile data and a protected resume action, never raw storage paths.

### Interview and evaluation workspace

- Add interview records linked to an owned application and recruiter-owned job.
- Support schedule, reschedule, cancel, complete, attendance result, meeting link/location, and timezone.
- Add evaluation scorecards with bounded marks, recommendation, strengths, concerns, and private recruiter feedback.
- Every transition and evaluation write must create an audit record and may notify the applicant through the email outbox.

### Data isolation contract

- Every recruiter query must include `job.recruiterId = req.user.id` or an equivalent service-level ownership predicate.
- Never authorize an application, interview, evaluation, export, or resume using its child ID alone.
- Add cross-recruiter tests that attempt access by changing job, application, interview, and evaluation IDs.
- Applicant-facing routes must exclude recruiter notes, internal scores, status history actors, and private email content.

### Implementation order

1. Finish the recruiter application workspace: filters, sorting, pagination, detail, status history, and shortlist outbox.
2. Add interview schema, service, routes, forms, lifecycle, and notifications.
3. Add evaluation schema, score validation, recruiter review pages, and audit history.
4. Add recruiter layout/sidebar and dashboard metrics backed by the same services.
5. Add integration tests for isolation, CSRF, sorting, pagination, status transitions, duplicate notifications, interview lifecycle, and evaluation bounds.

### Definition of done

- Two recruiters see only their own jobs, applications, interviews, evaluations, notes, resumes, and exports.
- Application lists sort and filter deterministically and remain bounded.
- Shortlisting creates exactly one applicant notification request.
- Interview and evaluation records cannot be accessed through another recruiter’s IDs.
- Dashboard totals match recruiter-owned database records.
- The recruiter workflow passes an authenticated end-to-end test from job selection through shortlist, interview, evaluation, and final decision.

## 0.1 Ordered master plan

### Phase G — Production data and storage

1. Select PostgreSQL as the production provider and create a reviewed Prisma migration baseline.
2. Build a staging data migration from SQLite, including verification-token invalidation/hash conversion.
3. Provision private object storage for resumes; migrate existing files and replace path storage with object keys.
4. Add retention, malware scanning, content-type verification, and short-lived download authorization.

### Phase H — Reliability and concurrency

1. Add a transaction-safe openings limit and idempotent application submission.
2. Introduce an outbox worker for email sends with bounded retries and dead-letter visibility.
3. Move rate limits and refresh-session coordination to shared infrastructure.
4. Add cleanup jobs for expired refresh tokens, stale uploads, and old email logs.

### Phase I — Runtime operations

1. Add health/readiness endpoints, graceful shutdown, request IDs, structured logs, and metrics.
2. Define proxy, TLS, secret rotation, backup/restore, migration, and rollback procedures.
3. Add CI gates for dependency audit, schema migration, integration tests, smoke tests, and startup configuration validation.

### Phase J — Security and verification

1. Deploy a tested CSP and review all inline scripts/styles it affects.
2. Convert email verification to GET-preview/POST-confirm and add account recovery with abuse limits.
3. Test refresh-token replay, authorization isolation, upload abuse, duplicate submissions, and failure recovery under concurrency.
4. Perform a staging security review and a production readiness sign-off against the blockers above.

### Phase K — Job Portal Feature Completeness

This phase expands the job domain while preserving server-rendered Express/EJS flows and httpOnly-cookie JWT authentication. Unless stated otherwise, all mutating endpoints remain CSRF-protected and all recruiter resources remain ownership-scoped.

#### K1. Full-text search and filtering

- **Approach:** Start with PostgreSQL-native search: add a generated/search-maintained `tsvector` column over designation, company name, category, location, and normalized skills, backed by a GIN index. Use `websearch_to_tsquery` for user input, plus exact/range predicates for location, category, and salary. Store normalized salary bounds rather than parsing the display string at query time.
- **Tradeoff:** PostgreSQL search is transactional, inexpensive, and appropriate for the current portal scale. A dedicated service such as OpenSearch becomes worthwhile only for typo tolerance, synonym/ranking requirements, or substantially larger datasets, at the cost of another cluster, indexing pipeline, and consistency model.
- **Schema:** Add `salaryMin Int?`, `salaryMax Int?`, `searchDocument Unsupported("tsvector")?` or a SQL-managed generated column, and indexes on `category`, `location`, `applyBy`, and the search document. Keep `salary` as the display value during migration, then backfill bounds.
- **Endpoints:** Extend `GET /jobs` with `q`, `location`, `category`, `salaryMin`, `salaryMax`, `status`, and cursor parameters. Keep `GET /jobs/:id` for detail pages.
- **Infrastructure:** PostgreSQL full-text search only in the first implementation; no separate search service.

#### K2. Redis caching

- **Strategy:** Cache public job-list query results and individual public job details with versioned keys, short TTLs, and bounded response sizes. Never cache personalized recruiter/applicant responses or anything containing CSRF tokens, user identity, or private applications.
- **Invalidation:** On create/update/delete/close, delete the job detail key, invalidate affected list keys by namespace/version bump, and publish an invalidation event for multi-instance workers. Expiry remains the fallback for missed events.
- **Schema:** No required Prisma change; optionally add `cacheVersion Int @default(0)` to `Job` if per-record versioned keys are preferred.
- **Endpoints:** Existing `GET /jobs` and `GET /jobs/:id` become cache-aware. Mutation endpoints continue to be `POST /jobs/new`, `POST /jobs/:id/edit`, `POST /jobs/:id/delete`, and the lifecycle close operation.
- **Infrastructure:** Redis, shared between application instances and rate-limit/cache consumers.

#### K3. Cursor pagination and indexes

- **Strategy:** Replace offset pagination with opaque cursors containing the stable `(createdAt, id)` ordering tuple. Use Prisma `cursor`, `take`, and deterministic secondary ordering; cap page size and return `nextCursor`.
- **Schema:** Add indexes: `Job(recruiterId, createdAt, id)`, `Job(applyBy, createdAt, id)`, `Job(category, createdAt, id)`, `Job(location, createdAt, id)`, `Application(jobId, createdAt, id)`, `Application(applicantId, createdAt, id)`, and `Application(email, jobId)` if reporting queries require it. Existing single-column indexes can be retained only when query plans justify them.
- **Endpoints:** `GET /jobs?cursor=&limit=`, `GET /jobs/:id/applicants?cursor=&limit=`, and a future authenticated `GET /applications/mine?cursor=&limit=`. Return stable metadata rather than exposing database IDs as cursor tokens.
- **Infrastructure:** No new service; cursor signing can reuse `COOKIE_SECRET` or a dedicated cursor secret.

#### K4. Job lifecycle states and expiry

- **Strategy:** Add explicit `DRAFT`, `OPEN`, `CLOSED`, and `EXPIRED` states. New recruiter jobs default to `DRAFT` or `OPEN` according to the product workflow; only `OPEN` jobs accepting applications are public apply targets. A scheduled worker transitions open jobs whose `applyBy` has passed to `EXPIRED`.
- **Schema:** Add `Job.status String` or a Prisma enum `JobStatus`, `closedAt DateTime?`, and `publishedAt DateTime?`. Index `(status, applyBy, createdAt)` and `(recruiterId, status, createdAt)`.
- **Endpoints:** Add recruiter-only `POST /jobs/:id/publish`, `POST /jobs/:id/close`, and optionally `POST /jobs/:id/reopen` with validated state transitions. Public `GET /jobs` shows only published open jobs by default; `POST /jobs/:id/apply` rejects non-`OPEN` jobs and expired deadlines.
- **Infrastructure:** Cron, a queue scheduler, or a managed scheduled job invoking an idempotent expiry worker. The apply-time check remains authoritative if the scheduler is delayed.

#### K5. Transaction-safe openings

- **Strategy:** In one database transaction, lock or atomically update the job only when `status = OPEN`, `applyBy >= now()`, and `applicationsAccepted < openings`. Then create the application and increment the accepted count in the same transaction. A unique constraint remains the duplicate protection.
- **Schema:** Add `applicationsAccepted Int @default(0)` to `Job`, index it only if reporting needs it, and retain `openings`. For PostgreSQL use an atomic conditional `UPDATE ... WHERE applicationsAccepted < openings RETURNING id`; avoid read-then-write logic.
- **Endpoints:** `POST /jobs/:id/apply` returns a clear `409`/flash error when all openings are filled. Recruiter detail responses expose accepted/remaining counts.
- **Infrastructure:** No new service; requires PostgreSQL transaction semantics in production and concurrency integration tests.

#### K6. Saved jobs and job alerts

- **Strategy:** Authenticated applicants can save/unsave jobs. Applicants opt into alert preferences containing normalized categories, locations, keywords, and frequency. A digest worker finds new matching open jobs since the last run and sends one deduplicated email per user.
- **Schema:** Add `SavedJob(id, userId, jobId, createdAt)` with `@@unique([userId, jobId])`; add `JobAlert(id, userId, keywords, categories, locations, frequency, enabled, lastSentAt, createdAt, updatedAt)`; add `JobAlertDelivery` or an outbox reference for idempotent sends.
- **Endpoints:** `POST /jobs/:id/save`, `POST /jobs/:id/unsave`, `GET /saved-jobs`, `GET/POST/PATCH /job-alerts`, and `DELETE /job-alerts/:id`. All require authenticated applicants and CSRF on mutations.
- **Infrastructure:** Existing email outbox plus a daily/hourly scheduler. Redis is optional for deduplication if the outbox database provides unique delivery keys.

#### K7. Apply throttling and guest spam prevention

- **Strategy:** Keep login throttling separate. Apply limits should combine IP, authenticated account, and job dimensions, with stricter burst and daily quotas. Prefer authenticated applications; if guest applications remain supported, require a signed one-time nonce, email verification link, CAPTCHA/risk scoring, and disposable-email controls before creating the application.
- **Schema:** Add `ApplicationSubmissionAttempt` or a Redis-backed counter only if auditability is required; add `verifiedAt DateTime?` and `submissionNonceHash String?` for guest workflows. Do not store raw CAPTCHA or nonce secrets.
- **Endpoints:** Apply remains `POST /jobs/:id/apply`; add `POST /applications/:id/verify` only if guest applications are retained. Return generic responses that do not reveal account/job enumeration details.
- **Infrastructure:** Redis for distributed counters; CAPTCHA/risk provider for guest submissions; background cleanup for attempts and expired nonces.

#### K8. Recruiter analytics

- **Strategy:** Record privacy-conscious job views with deduplication by short-lived visitor/session hash and aggregate counts asynchronously. Applicant counts come from the application relation or a maintained counter; never expose applicant PII in analytics endpoints.
- **Schema:** Add `JobView(id, jobId, visitorHash, viewedAt)` with indexes on `(jobId, viewedAt)` and an optional uniqueness/deduplication key. Add `Job.viewCount Int @default(0)` only if maintaining a counter transactionally; otherwise aggregate from `JobView`. Add `Job.applicationCount Int @default(0)` if avoiding repeated count queries.
- **Endpoints:** Add recruiter-owned `GET /jobs/:id/analytics` returning total views, applications, and time-bucketed summaries. Public job detail increments an asynchronous view event.
- **Infrastructure:** Redis stream/queue or the Phase H outbox worker for aggregation; retention policy for raw view events.

#### K9. Reusable resume model

- **Strategy:** Separate a user's resume asset from an application. Applicants upload/select a reusable resume; each application references the selected immutable version. Existing application file paths are migrated to resume records before object storage migration.
- **Schema:** Add `Resume(id, userId, objectKey, originalName, contentType, sizeBytes, checksum, scanStatus, createdAt, deletedAt)` and change `Application` to `resumeId String` with a relation. Keep a snapshot of the object key/version if resumes can be replaced or deleted later. Add indexes on `Resume(userId, createdAt)` and `Application(resumeId)`.
- **Endpoints:** Add authenticated applicant `GET/POST /resumes`, `DELETE /resumes/:id`, and `POST /jobs/:id/apply` accepting `resumeId` or a new upload. Recruiter resume downloads remain owner-authorized and use short-lived object-storage URLs.
- **Infrastructure:** Uses Phase G private object storage, malware scanning, lifecycle retention, and signed download URLs.

#### K10. SEO for public job pages

- **Strategy:** Render title, description, Open Graph, and canonical tags from the server-side job detail view. Exclude drafts, closed/private jobs, and query-string variants from indexing. Escape all metadata values.
- **Schema:** No required change; `slug String? @unique` is recommended for stable human-readable URLs, with the existing ID retained for lookup compatibility. Add `canonicalUpdatedAt` only if external sitemap tooling needs it.
- **Endpoints:** Keep `GET /jobs/:id`; optionally add `GET /jobs/:slug`. Add `GET /sitemap.xml` for open jobs and `GET /robots.txt`. Return `404`/`410` consistently for unavailable postings.
- **Infrastructure:** No new service; sitemap generation can be cached in Redis and regenerated on lifecycle changes.

#### K11. Load-testing gate

- **Strategy:** Add k6 or autocannon scenarios for public search/detail traffic and authenticated apply traffic, including cache-cold and cache-warm runs. Use seeded staging data and synthetic resumes; never send real email or persist real applicant PII.
- **Schema:** No required Prisma change. Add fixtures for jobs across categories/statuses and concurrent applications against a low-opening job.
- **Endpoints:** Exercise `GET /jobs`, `GET /jobs/:id`, authenticated `POST /jobs/:id/apply`, and recruiter `GET /jobs/:id/applicants` with representative cursor pages.
- **Infrastructure:** CI load stage or scheduled staging workflow, PostgreSQL, Redis, object-storage test double, and a metrics sink. Set thresholds for p95 latency, error rate, oversubscription count, and database connection saturation.
- **Phase I change:** Add `npm run load:test` or equivalent to the CI checklist after integration tests, with a smaller smoke profile on pull requests and a full profile on scheduled/release runs.

#### Phase K acceptance criteria

- Search/filter results are ranked and paginated deterministically, with query latency measured on production-like data.
- Public listing/detail caches never expose personalized or private data and invalidate after lifecycle mutations.
- Applications cannot exceed openings under concurrent load, and closed/expired jobs reject applications.
- Saved jobs, alerts, reusable resumes, analytics, SEO routes, and cursor endpoints have authorization and integration coverage.
- Apply abuse controls work per IP and account across multiple instances.
- CI load gates report p95 latency, error rate, and zero oversubscribed jobs.

### Definition of production-ready

- PostgreSQL, private object storage, shared rate limits, and durable email processing are deployed and tested in staging.
- Readiness fails when dependencies are unavailable; shutdown drains requests and disconnects Prisma cleanly.
- Authorization, CSRF, upload, refresh replay, duplicate submission, and concurrency tests pass in CI.
- Backups, restore drills, secret rotation, monitoring, and rollback procedures are documented and exercised.

---

## 1. Goals

| Goal | Outcome |
|------|---------|
| Real relational database | Replace lowdb with Prisma + SQLite (dev) / Postgres-ready via `DATABASE_URL` |
| Multi-user data isolation | Strict FK ownership: recruiters only touch *their* jobs; applicants only see *their* applications |
| Access + Refresh tokens | Short-lived JWT access + rotating refresh tokens (hashed in DB, httpOnly cookies) |
| Email that actually works | Templates, retries logging, registration verify + application confirm |
| Confirmation modals | Custom modal (not `window.confirm`) on delete, logout, and other destructive actions |
| Perfect validation | Shared validators on every mutating route; consistent flash/error UX |
| Living docs | `doc.md` changelog updated on every logic/architecture change |

---

## 2. Architecture decisions (locked)

### 2.1 Database — Prisma

- **Why Prisma:** typed schema, migrations, correct relations, easy Postgres swap later.
- **Default adapter:** SQLite file `prisma/dev.db` (no external server for local).
- **Production:** set `DATABASE_URL=postgresql://...` — same schema, no code rewrite.

### 2.2 Auth — JWT access + refresh (cookie-based)

SSR EJS cannot use `localStorage` safely. Tokens live in **httpOnly cookies**:

| Token | Cookie name | Lifetime | Storage |
|-------|-------------|----------|---------|
| Access | `access_token` | 15 minutes | JWT signed with `JWT_ACCESS_SECRET` |
| Refresh | `refresh_token` | 7 days | Opaque random token; **only SHA-256 hash** stored in DB |

**Flow:**
1. Login/register → issue access + refresh; store refresh hash in `RefreshToken`.
2. Each request → middleware reads access cookie; if valid, attach `req.user`.
3. If access expired → try refresh cookie → rotate refresh (old revoked) → set new cookies → continue.
4. Logout → revoke refresh row + clear both cookies.

**Session store removed** (`express-session` / file store). Flash messages move to a short-lived signed cookie or one-shot DB-free approach (`connect-flash` replaced with cookie-flash).

CSRF remains for cookie-auth state-changing requests.

### 2.3 Data isolation rules

```
User 1──* Job          (recruiterId)
Job  1──* Application  (jobId)
User 1──* Application  (applicantId, nullable for guest apply)
User 1──* RefreshToken
```

Enforced in **middleware + queries**, never trust client IDs:

- `requireJobOwner` — `job.recruiterId === req.user.id`
- List recruiter dashboard: `WHERE recruiterId = req.user.id`
- Applicant “my applications”: `WHERE applicantId = req.user.id`
- Delete/update job: owner check **and** cascade applications correctly

### 2.4 Email

- Central `services/email.service.js` with HTML templates under `emails/`.
- Types: `EMAIL_VERIFY`, `APPLICATION_RECEIVED`, `APPLICATION_NOTIFY_RECRUITER` (optional).
- If SMTP not configured → log + record `EmailLog` status `skipped` (dev-safe).
- Registration requires email verification before full access (recruiters/applicants both).

### 2.5 Confirmation UI

- Shared modal partial + `public/js/confirm-modal.js`.
- Wired to: delete job, logout, revoke-all-sessions (if exposed).
- Forms submit only after modal confirm; CSRF preserved.

### 2.6 Validation

- Central `validators/*.js` (express-validator chains).
- Server-side only; never rely on HTML `required` alone.
- Unique constraints in DB for email / (jobId+email) applications.

---

## 3. Prisma schema (target)

```
User
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String
  role          Role     // APPLICANT | RECRUITER
  emailVerified Boolean  @default(false)
  verifyToken   String?  @unique
  verifyExpires DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  jobs          Job[]
  applications  Application[]
  refreshTokens RefreshToken[]

Job
  id            String   @id @default(cuid())
  category      String
  designation   String
  location      String
  companyName   String
  salary        String
  openings      Int
  skills        String   // JSON array string
  applyBy       DateTime
  recruiterId   String
  recruiter     User     @relation(...)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  applications  Application[]

Application
  id            String   @id @default(cuid())
  jobId         String
  applicantId   String?  // null = guest apply
  name          String
  email         String
  contact       String
  resumePath    String
  createdAt     DateTime @default(now())
  job           Job      @relation(...)
  applicant     User?    @relation(...)
  @@unique([jobId, email])

RefreshToken
  id            String   @id @default(cuid())
  userId        String
  tokenHash     String   @unique
  expiresAt     DateTime
  revokedAt     DateTime?
  createdAt     DateTime @default(now())
  userAgent     String?
  ip            String?
  user          User     @relation(...)

EmailLog
  id            String   @id @default(cuid())
  toEmail       String
  subject       String
  type          String
  status        String   // sent | failed | skipped
  error         String?
  createdAt     DateTime @default(now())

enum Role { APPLICANT RECRUITER }
```

---

## 4. Implementation phases

### Phase A — Docs & foundations
1. This plan file  
2. `doc.md` changelog scaffold  
3. Install Prisma, jsonwebtoken, cookie helpers; update `.env.example`

### Phase B — Database
1. `prisma/schema.prisma` + migrate  
2. Seed two demo jobs + optional demo users  
3. Prisma client singleton `config/prisma.js`

### Phase C — Auth (JWT)
1. `services/token.service.js` — sign/verify access, create/rotate/revoke refresh  
2. `middleware/auth.js` — attach user from access; silent refresh  
3. Rewrite register/login/logout/verify-email controllers  
4. Remove express-session / session-file-store

### Phase D — Domain rewrite
1. Job + Application CRUD via Prisma with ownership filters  
2. Routes/validators updated  
3. Views: field name alignment (`companyName`, etc.)

### Phase E — Email
1. Templates + email service + EmailLog  
2. Verify-email link flow  
3. Application confirmation to applicant (+ optional recruiter notify)

### Phase F — Confirmation modals + polish
1. Modal JS/CSS + wire destructive actions  
2. Flash via signed cookie  
3. Smoke tests + update `doc.md`

---

## 5. Security checklist

- [ ] Passwords bcrypt ≥ 12 rounds  
- [ ] Refresh tokens hashed at rest; rotation on use  
- [ ] Access JWT short TTL  
- [ ] Cookies: httpOnly, sameSite=lax, secure in production  
- [ ] CSRF on all POSTs  
- [ ] Ownership checks on every job mutation  
- [ ] Unique application per (job, email)  
- [ ] Upload MIME + size limits unchanged  
- [ ] Rate limits on auth + apply  
- [ ] No secrets in repo; `.env` gitignored  

---

## 6. Out of scope (explicit)

- OAuth / social login  
- Real-time notifications  
- Admin role / moderation panel  
- Horizontal multi-instance Redis (file/SQLite is single-node; Postgres + shared secret is enough for tokens)

---

## 7. Success criteria

1. Two recruiters cannot see/edit each other’s jobs.  
2. Expired access token silently refreshes via refresh cookie.  
3. Logout invalidates refresh server-side.  
4. Unverified users cannot post jobs (recruiters) / are prompted to verify.  
5. Application sends email when SMTP configured; otherwise logged as skipped.  
6. Delete job / logout use custom confirmation modal.  
7. `doc.md` records this upgrade.
