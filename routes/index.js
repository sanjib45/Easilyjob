/**
 * Central route index — the only route file app.js mounts.
 *
 * Health routes are mounted separately in app.js (before body parsing)
 * so probes skip auth/CSRF overhead.
 */
import { Router } from "express";
import authRoutes from "./auth.routes.js";
import jobRoutes from "./job.routes.js";
import recruiterRoutes from "./recruiter/index.js";
import chatRoutes from "./chat.routes.js";
import applicantRoutes from "./applicant.routes.js";

const router = Router();

router.use("/", authRoutes);
router.use("/jobs", jobRoutes);
router.use("/recruiter", recruiterRoutes);
router.use("/messages", chatRoutes);
router.use("/applicant", applicantRoutes);

export default router;
