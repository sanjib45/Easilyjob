# Easily Jobs — Recruiter Portal Handoff & Architecture Document

## Overview

The Recruiter Portal in **Easily Jobs** provides a complete recruiter workspace featuring strict multi-tenant data isolation, clean layered architecture, a responsive left-sidebar shell, status transition enforcement, interview round management, private scorecard evaluations, and idempotent candidate-safe result sharing via an email outbox queue worker.

---

## 1. Architectural Layers & File Structure

The project enforces a strict, non-negotiable 5-layer hierarchy:
`Router → Validator → Controller → Service → Repository`

```
app.js
 └── routes/index.js                      ← Single mount point for all application routes
       ├── routes/auth.routes.js          ← Authentication & registration
       ├── routes/job.routes.js           ← Public job listings & applicant application submission
       ├── routes/health.routes.js        ← Lightweight health & readiness probes
       └── routes/recruiter/index.js      ← Applies authenticate → isRecruiter → requireVerified ONCE
             ├── dashboard.routes.js      ← GET /recruiter
             ├── applicants.routes.js     ← GET & POST /recruiter/applicants/*
             └── interviews.routes.js     ← GET & POST /recruiter/interviews/*

repositories/                             ← ONLY Repositories call Prisma
  ├── application.repository.js           ← Application & status history queries
  ├── interview.repository.js             ← Interview, scorecard & result queries
  ├── job.repository.js                   ← Job listing queries
  └── email.repository.js                 ← Outbox queue & audit log queries

policies/                                 ← Finite State Machine lifecycle policies
  ├── applicationTransitions.js           ← Valid application status graph
  └── interviewTransitions.js             ← Valid interview status graph

views/
  ├── layouts/
  │     ├── layout.ejs                    ← Standard top-nav layout for public/applicant pages
  │     └── recruiter.ejs                 ← Responsive left-sidebar layout for recruiter pages
  └── recruiter/
        ├── partials/sidebar.ejs          ← Sidebar navigation drawer
        ├── recruiter-dashboard.ejs       ← Dashboard with stat cards & active jobs
        ├── applicants.ejs                ← Filterable candidates list with pagination
        ├── applicant-detail.ejs          ← Detail review, notes, scheduling & timeline
        ├── interviews.ejs                ← Scheduled interview rounds table
        └── interviews/share-result.ejs   ← Candidate result sharing form
```

---

## 2. Key Technical Enforcements & Non-Negotiable Rules

1. **Strict Data Isolation (Tenant Boundary):**
   - Every function in `repositories/application.repository.js`, `repositories/interview.repository.js`, and `repositories/job.repository.js` takes `recruiterId` as its **first parameter**.
   - Queries enforce `where: { job: { recruiterId } }` or `where: { recruiterId }`. Never fetches by child ID alone.

2. **Candidate Privacy Protection (Public Subset):**
   - Candidate result sharing uses the `InterviewResult` model.
   - The `INTERVIEW_RESULT` email template and `createResult` repository projection strictly project only `{ outcome, summary, applicantName, jobTitle, companyName }`.
   - Internal technical/communication/overall scores, recommendations, strengths, concerns, and private feedback are **strictly confidential** and never exposed to candidates.

3. **Status Transition Policies:**
   - Applications follow a strict state graph: `NEW` → `REVIEWING` → `SHORTLISTED` → `INTERVIEW_SCHEDULED` → `INTERVIEWED` → `HIRED`/`REJECTED`.
   - Illegal status jumps (e.g., `HIRED` → `NEW` or `REJECTED` → `SHORTLISTED`) throw an HTTP 400 `AppError`.
   - Terminal states (`HIRED`, `REJECTED`) are locked against further status changes.
   - Same-status submissions are handled as idempotent no-ops (no duplicate history rows or duplicate emails).

4. **Email Outbox Queue & Worker:**
   - Emails are written transactionally to `EmailOutbox` during DB operations.
   - Delivery is triggered post-commit via `deliverQueuedEmail(idempotencyKey)`.
   - The background worker in `workers/email-worker.js` periodically retries `QUEUED`/`FAILED` outbox rows with exponential backoff up to 5 attempts.

5. **In-Process Job Cache:**
   - Public job listings are cached in `utils/cache.js` (`jobCache`) with a 60-second TTL.
   - Job creation, updates, deletions, and closures trigger `invalidateJobCache()` (write-through invalidation).
   - Recruiter routes and applicant data are **never** cached.

---

## 3. Database Schema (Prisma Multi-File Structure)

Prisma models are organized by domain under `prisma/schema/`:
- `base.prisma`: Datasource & client configuration with `prismaSchemaFolder`.
- `user.prisma`: `User`, `RefreshToken`
- `job.prisma`: `Job`
- `application.prisma`: `Application`, `ApplicationStatusHistory`
- `interview.prisma`: `Interview`, `InterviewEvaluation`, `InterviewResult`
- `email.prisma`: `EmailOutbox`, `EmailLog`

---

## 4. Verification & Testing Commands

To run the automated smoke test suite (covering unauthenticated sweeps, cross-tenant data isolation, bounds checking, and state guards):

```bash
npm test
```

To sync MongoDB Atlas collections and indexes:

```bash
npm run db:migrate
```

To regenerate the Prisma Client:

```bash
npx prisma generate
```
