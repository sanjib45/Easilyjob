import { body } from "express-validator";

export const registerValidators = [
  body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 100 }),
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long.")
    .isLength({ max: 72 })
    .withMessage("Password must be 72 characters or fewer.")
    .matches(/[A-Za-z]/)
    .withMessage("Password must include a letter.")
    .matches(/[0-9]/)
    .withMessage("Password must include a number."),
  body("role")
    .isIn(["APPLICANT", "RECRUITER", "applicant", "recruiter"])
    .withMessage("Select a valid account type."),
];

export const loginValidators = [
  body("email").trim().isEmail().withMessage("Enter a valid email address."),
  body("password").notEmpty().withMessage("Password is required."),
];

export const jobValidators = [
  body("jobcategory").trim().notEmpty().withMessage("Job category is required.").isLength({ max: 120 }),
  body("jobdesignation").trim().notEmpty().withMessage("Job designation is required.").isLength({ max: 160 }),
  body("joblocation").trim().notEmpty().withMessage("Job location is required.").isLength({ max: 120 }),
  body("companyname").trim().notEmpty().withMessage("Company name is required.").isLength({ max: 160 }),
  body("salary").trim().notEmpty().withMessage("Salary is required.").isLength({ max: 80 }),
  body("openings").isInt({ min: 1, max: 1000 }).withMessage("Openings must be a positive whole number."),
  body("applyby")
    .isISO8601()
    .withMessage("Enter a valid apply-by date.")
    .custom((value) => {
      if (new Date(value) < new Date(new Date().toDateString())) {
        throw new Error("Apply-by date cannot be in the past.");
      }
      return true;
    }),
  body("skillrequired").trim().notEmpty().withMessage("List at least one required skill."),
];

export const applyValidators = [
  body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 100 }),
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("contact")
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage("Enter a valid contact number."),
];

export const recruiterReviewValidators = [
  body("status")
    .isIn(["NEW", "REVIEWING", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "HIRED", "REJECTED"])
    .withMessage("Select a valid application status."),
  body("recruiterNote")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Recruiter notes must be 2,000 characters or fewer."),
];

export const interviewValidators = [
  body("scheduledAt").isISO8601().withMessage("Enter a valid future interview time."),
  body("timezone").trim().notEmpty().isLength({ max: 80 }).withMessage("Timezone is required."),
  body("durationMinutes").isInt({ min: 15, max: 240 }).withMessage("Duration must be between 15 and 240 minutes."),
  body("meetingUrl").optional({ values: "falsy" }).trim().isURL({ require_protocol: true }).withMessage("Enter a valid meeting URL."),
  body("location").optional({ values: "falsy" }).trim().isLength({ max: 200 }),
  body("candidateMessage").optional({ values: "falsy" }).trim().isLength({ max: 2000 }),
];

export const interviewUpdateValidators = [
  body("status").isIn(["SCHEDULED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).withMessage("Select a valid interview status."),
  body("scheduledAt").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid interview time."),
  body("cancellationReason").optional({ values: "falsy" }).trim().isLength({ max: 500 }),
];

export const evaluationValidators = [
  body("technicalScore").isInt({ min: 0, max: 100 }).withMessage("Technical score must be between 0 and 100."),
  body("communicationScore").isInt({ min: 0, max: 100 }).withMessage("Communication score must be between 0 and 100."),
  body("overallScore").isInt({ min: 0, max: 100 }).withMessage("Overall score must be between 0 and 100."),
  body("recommendation").isIn(["STRONG_YES", "YES", "MAYBE", "NO"]).withMessage("Select a valid recommendation."),
  body("strengths").optional({ values: "falsy" }).trim().isLength({ max: 2000 }),
  body("concerns").optional({ values: "falsy" }).trim().isLength({ max: 2000 }),
  body("privateFeedback").optional({ values: "falsy" }).trim().isLength({ max: 4000 }),
];
