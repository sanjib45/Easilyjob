import { body } from "express-validator";

export const shareResultValidators = [
  body("outcome")
    .isIn(["HIRED", "REJECTED", "ON_HOLD"])
    .withMessage("Select a valid outcome: HIRED, REJECTED, or ON_HOLD."),
  body("summary")
    .trim()
    .notEmpty()
    .withMessage("A feedback summary is required.")
    .isLength({ max: 3000 })
    .withMessage("Summary must be 3,000 characters or fewer."),
];
