/**
 * Recruiter applicant routes.
 * Mounted at /recruiter/applicants — auth guards already applied.
 */
import { Router } from "express";
import { verifyCsrfToken } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  recruiterReviewValidators,
  interviewValidators,
} from "../../validators/index.js";
import {
  renderRecruiterApplications,
  renderRecruiterApplicant,
  updateRecruiterApplicant,
  createRecruiterApplicantInterview,
} from "../../controllers/recruiter.controller.js";

const router = Router();

// GET /recruiter/applicants
router.get("/", renderRecruiterApplications);

// GET /recruiter/applicants/:applicationId
router.get("/:applicationId", renderRecruiterApplicant);

// POST /recruiter/applicants/:applicationId — update status/note
router.post(
  "/:applicationId",
  verifyCsrfToken,
  recruiterReviewValidators,
  validate((req) => `/recruiter/applicants/${req.params.applicationId}`),
  updateRecruiterApplicant
);

// POST /recruiter/applicants/:applicationId/interviews — schedule interview
router.post(
  "/:applicationId/interviews",
  verifyCsrfToken,
  interviewValidators,
  validate((req) => `/recruiter/applicants/${req.params.applicationId}`),
  createRecruiterApplicantInterview
);

export default router;
