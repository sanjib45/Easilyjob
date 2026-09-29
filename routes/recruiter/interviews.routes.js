/**
 * Recruiter interview routes.
 * Mounted at /recruiter/interviews — auth guards already applied.
 */
import { Router } from "express";
import { verifyCsrfToken } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  interviewUpdateValidators,
} from "../../validators/recruiter/interview.validators.js";
import {
  evaluationValidators,
} from "../../validators/recruiter/evaluation.validators.js";
import {
  shareResultValidators,
} from "../../validators/recruiter/result.validators.js";
import {
  renderRecruiterInterviews,
  updateRecruiterInterviewAction,
  saveRecruiterInterviewEvaluation,
  renderShareInterviewResult,
  handleShareInterviewResult,
} from "../../controllers/recruiter.controller.js";

const router = Router();

// GET /recruiter/interviews — list interviews
router.get("/", renderRecruiterInterviews);

// GET /recruiter/interviews/:interviewId/share-result — render share result form
router.get("/:interviewId/share-result", renderShareInterviewResult);

// POST /recruiter/interviews/:interviewId/share-result — create result & queue email
router.post(
  "/:interviewId/share-result",
  verifyCsrfToken,
  shareResultValidators,
  validate((req) => `/recruiter/interviews/${req.params.interviewId}/share-result`),
  handleShareInterviewResult
);

// POST /recruiter/interviews/:interviewId — update status/reschedule
router.post(
  "/:interviewId",
  verifyCsrfToken,
  interviewUpdateValidators,
  validate("/recruiter/interviews"),
  updateRecruiterInterviewAction
);

// POST /recruiter/interviews/:interviewId/evaluation — upsert scorecard
router.post(
  "/:interviewId/evaluation",
  verifyCsrfToken,
  evaluationValidators,
  validate("/recruiter/interviews"),
  saveRecruiterInterviewEvaluation
);

export default router;
