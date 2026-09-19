import { prisma } from "../config/prisma.js";
import { sendEmail } from "./email.service.js";

const retryAt = (attempts) => new Date(Date.now() + Math.min(60, 2 ** attempts) * 60 * 1000);

export const queueEmail = async ({ idempotencyKey, toEmail, type, data }) => {
  return prisma.emailOutbox.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      toEmail,
      type,
      payload: JSON.stringify(data),
    },
  });
};

export const deliverQueuedEmail = async (idempotencyKey) => {
  const entry = await prisma.emailOutbox.findUnique({ where: { idempotencyKey } });
  if (!entry || entry.status === "SENT" || entry.status === "SKIPPED") return entry;

  const result = await sendEmail({
    to: entry.toEmail,
    type: entry.type,
    data: JSON.parse(entry.payload),
  });
  const attempts = entry.attempts + 1;
  const status = result.status === "sent" ? "SENT" : result.status === "skipped" ? "SKIPPED" : "FAILED";

  return prisma.emailOutbox.update({
    where: { idempotencyKey },
    data: {
      status,
      attempts,
      sentAt: status === "SENT" || status === "SKIPPED" ? new Date() : null,
      lastError: status === "FAILED" ? String(result.error || "Email delivery failed").slice(0, 500) : null,
      nextAttemptAt: status === "FAILED" ? retryAt(attempts) : new Date(),
    },
  });
};
