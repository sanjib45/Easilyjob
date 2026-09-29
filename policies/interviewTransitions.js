import { AppError } from "../utils/AppError.js";

/**
 * Valid state transitions for interview rounds.
 * Terminal states (COMPLETED, CANCELLED) cannot transition further.
 */
export const INTERVIEW_TRANSITIONS = {
  SCHEDULED: ["RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  RESCHEDULED: ["RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
  NO_SHOW: ["RESCHEDULED"],
};

/**
 * Asserts that an interview transition from `fromStatus` to `toStatus` is valid.
 * Throws AppError(400) if the transition is illegal.
 *
 * @param {string} from - Current interview status
 * @param {string} to - Desired interview status
 * @returns {boolean} - true if transition is valid
 */
export const assertInterviewTransition = (from, to) => {
  const current = String(from || "").toUpperCase();
  const next = String(to || "").toUpperCase();

  if (!current || !next) {
    throw new AppError("Interview statuses must be specified.", 400);
  }

  // Same-status updates (e.g. updating notes or date without changing status) are valid no-ops
  if (current === next) {
    return true;
  }

  const allowed = INTERVIEW_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    const formattedFrom = current.replaceAll("_", " ");
    const formattedTo = next.replaceAll("_", " ");
    throw new AppError(
      `Cannot transition interview status from ${formattedFrom} to ${formattedTo}.`,
      400
    );
  }

  return true;
};
