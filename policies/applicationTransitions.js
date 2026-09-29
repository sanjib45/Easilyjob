import { AppError } from "../utils/AppError.js";

/**
 * Valid state transitions for applications.
 * Terminal states (HIRED, REJECTED) cannot transition to any other status.
 */
const ALL_STAGES = [
  "NEW",
  "REVIEWING",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "HIRED",
  "REJECTED",
];

export const APPLICATION_TRANSITIONS = {
  NEW: ALL_STAGES,
  REVIEWING: ALL_STAGES,
  SHORTLISTED: ALL_STAGES,
  INTERVIEW_SCHEDULED: ALL_STAGES,
  INTERVIEWED: ALL_STAGES,
  HIRED: ALL_STAGES,
  REJECTED: ALL_STAGES,
};

/**
 * Asserts that a transition from `fromStatus` to `toStatus` is valid.
 * Throws AppError(400) if the transition is illegal.
 *
 * @param {string} from - Current status
 * @param {string} to - Desired new status
 * @returns {boolean} - true if transition is valid
 */
export const assertApplicationTransition = (from, to) => {
  const current = String(from || "").toUpperCase();
  const next = String(to || "").toUpperCase();

  if (!current || !next) {
    throw new AppError("Application statuses must be specified.", 400);
  }

  // Same-status transitions are valid no-ops
  if (current === next) {
    return true;
  }

  const allowed = APPLICATION_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    const formattedFrom = current.replaceAll("_", " ");
    const formattedTo = next.replaceAll("_", " ");
    throw new AppError(
      `Cannot transition application status from ${formattedFrom} to ${formattedTo}.`,
      400
    );
  }

  return true;
};
