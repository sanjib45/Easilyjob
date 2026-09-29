/**
 * Recruiter dashboard routes.
 * Auth guards are already applied by the parent recruiter/index.js.
 */
import { Router } from "express";
import { renderRecruiterDashboard } from "../../controllers/recruiter.controller.js";

const router = Router();

router.get("/", renderRecruiterDashboard);

export default router;
