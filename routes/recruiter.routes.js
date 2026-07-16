import { Router } from "express";
import { renderRecruiterDashboard } from "../controllers/recruiter.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { isRecruiter } from "../middleware/isRecruiter.js";

const router = Router();

router.get("/", isAuthenticated, isRecruiter, renderRecruiterDashboard);

export default router;
