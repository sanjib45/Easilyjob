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
