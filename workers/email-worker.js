import { findPendingOutbox } from "../repositories/email.repository.js";
import { deliverQueuedEmail } from "../services/email-outbox.service.js";

let workerInterval = null;

/**
 * Runs a single tick of the email outbox retry worker.
 * Queries pending queued/failed emails with attempts < maxAttempts and nextAttemptAt <= now.
 */
export const processOutboxTick = async () => {
  try {
    const pending = await findPendingOutbox({ maxAttempts: 5, limit: 20 });
    for (const entry of pending) {
      try {
        await deliverQueuedEmail(entry.idempotencyKey);
      } catch (err) {
        console.error(`[Outbox Worker] Delivery error for key ${entry.idempotencyKey}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Outbox Worker] Tick error:", err.message);
  }
};

/**
 * Starts the background outbox retry worker.
 * Defaults to running every 60 seconds.
 */
export const startOutboxWorker = (intervalMs = 60 * 1000) => {
  if (workerInterval) return workerInterval;
  processOutboxTick();
  workerInterval = setInterval(processOutboxTick, intervalMs);
  return workerInterval;
};

/**
 * Stops the background outbox worker (used for clean shutdown/tests).
 */
export const stopOutboxWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
};
