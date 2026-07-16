import { Router } from "express";
import { body } from "express-validator";
import {
  renderAllJobs,
  renderNewJob,
  handleNewJob,
  renderJobDetails,
  renderUpdateJob,
  handleUpdateJob,
  handleDeleteJob,
  handleApplyToJob,
  renderApplicants,
} from "../controllers/job.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { isRecruiter } from "../middleware/isRecruiter.js";
import { upload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { applyLimiter } from "../middleware/rateLimit.js";
import { verifyCsrfToken } from "../middleware/csrf.js";

const router = Router();

const jobValidators = [
  body("jobcategory").trim().notEmpty().withMessage("Job category is required."),
  body("jobdesignation").trim().notEmpty().withMessage("Job designation is required."),
  body("joblocation").trim().notEmpty().withMessage("Job location is required."),
  body("companyname").trim().notEmpty().withMessage("Company name is required."),
  body("salary").trim().notEmpty().withMessage("Salary is required."),
  body("openings").isInt({ min: 1 }).withMessage("Openings must be a positive whole number."),
  body("applyby").isISO8601().withMessage("Enter a valid apply-by date."),
  body("skillrequired").trim().notEmpty().withMessage("List at least one required skill."),
];

const applyValidators = [
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("email").trim().isEmail().withMessage("Enter a valid email address."),
  body("contact")
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage("Enter a valid contact number."),
];

// Order matters: static segments like "/new" must be declared before "/:id".
router.get("/", renderAllJobs);
router.get("/new", isAuthenticated, isRecruiter, renderNewJob);
router.post(
  "/new",
  isAuthenticated,
  isRecruiter,
  verifyCsrfToken,
  jobValidators,
  validate("/jobs/new"),
  handleNewJob
);

router.get("/:id", renderJobDetails);

router.get("/:id/edit", isAuthenticated, isRecruiter, renderUpdateJob);
router.post(
  "/:id/edit",
  isAuthenticated,
  isRecruiter,
  verifyCsrfToken,
  jobValidators,
  validate((req) => `/jobs/${req.params.id}/edit`),
  handleUpdateJob
);

router.post(
  "/:id/delete",
  isAuthenticated,
  isRecruiter,
  verifyCsrfToken,
  handleDeleteJob
);

// Note: verifyCsrfToken runs AFTER upload.single(), because this form is
// multipart/form-data — only multer parses non-file fields (like _csrf)
// out of that body; express.urlencoded() never sees them.
router.post(
  "/:id/apply",
  applyLimiter,
  upload.single("resume"),
  verifyCsrfToken,
  applyValidators,
  validate((req) => `/jobs/${req.params.id}`),
  handleApplyToJob
);

router.get("/:id/applicants", isAuthenticated, isRecruiter, renderApplicants);

export default router;
