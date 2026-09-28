/**
 * Recruiter route index.
 *
 * Applies authenticate → isAuthenticated → isRecruiter ONCE at the top.
 * requireEmailVerified is applied to all sub-routes except the dashboard
 * (so unverified recruiters can still see the dashboard with the
 * verification banner).
 *
 * Each feature lives in its own router file with zero auth boilerplate.
 */
import { Router } from "express";
import { isAuthenticated, requireEmailVerified } from "../../middleware/auth.js";
import { isRecruiter } from "../../middleware/isRecruiter.js";

import dashboardRoutes from "./dashboard.routes.js";
import applicantsRoutes from "./applicants.routes.js";
import interviewsRoutes from "./interviews.routes.js";

const router = Router();

// ── Auth gate (applied once for every /recruiter/* request) ──────────
router.use(isAuthenticated);
router.use(isRecruiter);

// Use recruiter sidebar layout shell for all views rendered under /recruiter
router.use((req, res, next) => {
  res.locals.layout = "layouts/recruiter";
  next();
});

// Dashboard is accessible to unverified recruiters (shows verification banner)
router.use("/", dashboardRoutes);

// Everything below requires a verified email
router.use(requireEmailVerified);
router.use("/applicants", applicantsRoutes);
router.use("/interviews", interviewsRoutes);

export default router;
