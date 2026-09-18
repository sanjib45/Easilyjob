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
