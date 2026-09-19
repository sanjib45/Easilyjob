import { Router } from "express";
import { createRecruiterApplicantInterview, renderRecruiterApplicant, renderRecruiterApplications, renderRecruiterDashboard, renderRecruiterInterviews, saveRecruiterInterviewEvaluation, updateRecruiterApplicant, updateRecruiterInterviewAction } from "../controllers/recruiter.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { isRecruiter } from "../middleware/isRecruiter.js";
import { requireEmailVerified } from "../middleware/auth.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { evaluationValidators, interviewUpdateValidators, interviewValidators, recruiterReviewValidators } from "../validators/index.js";

const router = Router();

router.get("/", isAuthenticated, isRecruiter, renderRecruiterDashboard);
router.get("/applicants", isAuthenticated, isRecruiter, requireEmailVerified, renderRecruiterApplications);
router.get("/interviews", isAuthenticated, isRecruiter, requireEmailVerified, renderRecruiterInterviews);
router.get("/applicants/:applicationId", isAuthenticated, isRecruiter, requireEmailVerified, renderRecruiterApplicant);
router.post("/applicants/:applicationId", isAuthenticated, isRecruiter, requireEmailVerified, verifyCsrfToken, recruiterReviewValidators, validate((req) => `/recruiter/applicants/${req.params.applicationId}`), updateRecruiterApplicant);
router.post("/applicants/:applicationId/interviews", isAuthenticated, isRecruiter, requireEmailVerified, verifyCsrfToken, interviewValidators, validate((req) => `/recruiter/applicants/${req.params.applicationId}`), createRecruiterApplicantInterview);
router.post("/interviews/:interviewId", isAuthenticated, isRecruiter, requireEmailVerified, verifyCsrfToken, interviewUpdateValidators, validate("/recruiter/interviews"), updateRecruiterInterviewAction);
router.post("/interviews/:interviewId/evaluation", isAuthenticated, isRecruiter, requireEmailVerified, verifyCsrfToken, evaluationValidators, validate("/recruiter/interviews"), saveRecruiterInterviewEvaluation);

export default router;
