import { body } from "express-validator";

export const evaluationValidators = [
  body("technicalScore")
    .isInt({ min: 0, max: 100 })
    .withMessage("Technical score must be between 0 and 100."),
  body("communicationScore")
    .isInt({ min: 0, max: 100 })
    .withMessage("Communication score must be between 0 and 100."),
  body("overallScore")
    .isInt({ min: 0, max: 100 })
    .withMessage("Overall score must be between 0 and 100."),
  body("recommendation")
    .isIn(["STRONG_YES", "YES", "MAYBE", "NO"])
    .withMessage("Select a valid recommendation."),
  body("strengths")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 3000 })
    .withMessage("Strengths must be 3,000 characters or fewer."),
  body("concerns")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 3000 })
    .withMessage("Concerns must be 3,000 characters or fewer."),
  body("privateFeedback")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 4000 })
    .withMessage("Private feedback must be 4,000 characters or fewer."),
];
