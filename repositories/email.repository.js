import { prisma } from "../config/prisma.js";

/**
 * Email repository for outbox queue and audit logs.
 */

export const upsertOutbox = async ({ idempotencyKey, toEmail, type, payload }, tx = null) => {
  const client = tx || prisma;
  return client.emailOutbox.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      toEmail,
      type,
      payload: typeof payload === "string" ? payload : JSON.stringify(payload),
    },
  });
};

export const findOutbox = async (idempotencyKey, tx = null) => {
  const client = tx || prisma;
  return client.emailOutbox.findUnique({
    where: { idempotencyKey },
  });
};

export const updateOutbox = async (idempotencyKey, data, tx = null) => {
  const client = tx || prisma;
  return client.emailOutbox.update({
    where: { idempotencyKey },
    data,
  });
};

export const findPendingOutbox = async ({ maxAttempts = 5, limit = 20 } = {}) => {
  return prisma.emailOutbox.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: maxAttempts },
    },
    take: limit,
    orderBy: { nextAttemptAt: "asc" },
  });
};

export const createEmailLog = async ({ toEmail, subject, type, status, error = null }) => {
  return prisma.emailLog.create({
    data: {
      toEmail,
      subject,
      type,
      status,
      error: error ? String(error).slice(0, 500) : null,
    },
  });
};
