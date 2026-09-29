import { Router } from "express";
import {
  renderApplicantDashboard,
  renderApplicantApplications,
  renderApplicantApplicationDetail,
  renderApplicantSavedJobs,
  handleSaveJobAction,
  handleUnsaveJobAction,
  renderApplicantProfile,
  handleUpdateApplicantProfile,
} from "../controllers/applicant.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { verifyCsrfToken } from "../middleware/csrf.js";

const router = Router();

router.use(isAuthenticated);

router.get("/", renderApplicantDashboard);
router.get("/dashboard", renderApplicantDashboard);
router.get("/applications", renderApplicantApplications);
router.get("/applications/:id", renderApplicantApplicationDetail);
router.get("/saved", renderApplicantSavedJobs);
router.post("/saved/:id", verifyCsrfToken, handleSaveJobAction);
router.post("/saved/:id/remove", verifyCsrfToken, handleUnsaveJobAction);
router.get("/profile", renderApplicantProfile);
router.post("/profile", verifyCsrfToken, handleUpdateApplicantProfile);

export default router;
