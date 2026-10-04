import { body } from "express-validator";

export const interviewValidators = [
  // HTML datetime-local sends "2026-10-02T14:30" (no seconds) — use loose ISO8601
  body("scheduledAt")
    .isISO8601({ strict: false })
    .withMessage("Enter a valid future interview time."),
  body("timezone")
    .trim()
    .notEmpty()
    .isLength({ max: 80 })
    .withMessage("Timezone is required."),
  body("durationMinutes")
    .isInt({ min: 15, max: 240 })
    .withMessage("Duration must be between 15 and 240 minutes."),
  body("meetingUrl")
    .optional({ values: "falsy" })
    .trim()
    .isURL({ require_protocol: true })
    .withMessage("Enter a valid meeting URL."),
  body("location")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 200 }),
  body("candidateMessage")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 2000 }),
];

export const interviewUpdateValidators = [
  body("status")
    .isIn(["SCHEDULED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .withMessage("Select a valid interview status."),
  body("scheduledAt")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("Enter a valid interview time."),
  body("cancellationReason")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 }),
];
