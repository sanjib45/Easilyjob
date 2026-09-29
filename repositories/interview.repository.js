import { prisma } from "../config/prisma.js";

/**
 * Interview repository.
 * Every query enforces tenant data isolation with recruiterId as first argument.
 */

const defaultInterviewInclude = {
  application: true,
  job: true,
  evaluation: true,
  result: true,
};

export const runInTransaction = async (callback) => {
  return prisma.$transaction(callback);
};

export const findOwnedInterview = async (recruiterId, interviewId, options = {}) => {
  const client = options.tx || prisma;
  return client.interview.findFirst({
    where: {
      id: interviewId,
      recruiterId,
    },
    include: options.include || defaultInterviewInclude,
  });
};

export const listOwnedInterviews = async (recruiterId, options = {}) => {
  const client = options.tx || prisma;
  const where = {
    recruiterId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.jobId ? { jobId: options.jobId } : {}),
  };

  const skip = options.skip !== undefined ? options.skip : undefined;
  const take = options.take !== undefined ? options.take : undefined;

  const [interviews, total] = await Promise.all([
    client.interview.findMany({
      where,
      include: defaultInterviewInclude,
      orderBy: options.orderBy || [{ scheduledAt: "asc" }, { id: "asc" }],
      skip,
      take,
    }),
    client.interview.count({ where }),
  ]);

  return { interviews, total };
};

export const countUpcomingInterviews = async (recruiterId) => {
  return prisma.interview.count({
    where: {
      recruiterId,
      scheduledAt: { gte: new Date() },
      status: { in: ["SCHEDULED", "RESCHEDULED"] },
    },
  });
};

export const createInterview = async (recruiterId, data, tx = null) => {
  const client = tx || prisma;
  return client.interview.create({
    data: {
      ...data,
      recruiterId,
    },
    include: {
      application: true,
      job: true,
    },
  });
};

export const updateInterview = async (recruiterId, interviewId, data, tx = null) => {
  const client = tx || prisma;
  const existing = await client.interview.findFirst({
    where: { id: interviewId, recruiterId },
    select: { id: true },
  });
  if (!existing) return null;

  return client.interview.update({
    where: { id: interviewId },
    data,
    include: defaultInterviewInclude,
  });
};

export const upsertEvaluation = async (recruiterId, interviewId, data, tx = null) => {
  const client = tx || prisma;
  return client.interviewEvaluation.upsert({
    where: { interviewId },
    update: {
      technicalScore: data.technicalScore,
      communicationScore: data.communicationScore,
      overallScore: data.overallScore,
      recommendation: data.recommendation,
      strengths: data.strengths,
      concerns: data.concerns,
      privateFeedback: data.privateFeedback,
    },
    create: {
      interviewId,
      applicationId: data.applicationId,
      recruiterId,
      technicalScore: data.technicalScore,
      communicationScore: data.communicationScore,
      overallScore: data.overallScore,
      recommendation: data.recommendation,
      strengths: data.strengths,
      concerns: data.concerns,
      privateFeedback: data.privateFeedback,
    },
  });
};

export const findOwnedEvaluation = async (recruiterId, interviewId) => {
  return prisma.interviewEvaluation.findFirst({
    where: {
      interviewId,
      recruiterId,
    },
  });
};

/**
 * Creates shared interview result.
 * Strictly selects the public-safe subset — NO private notes, NO scores.
 */
export const createResult = async (recruiterId, { interviewId, applicationId, summary, outcome, emailOutboxKey }, tx = null) => {
  const client = tx || prisma;
  return client.interviewResult.create({
    data: {
      interviewId,
      applicationId,
      recruiterId,
      summary,
      outcome,
      emailOutboxKey: emailOutboxKey || null,
    },
    select: {
      id: true,
      interviewId: true,
      applicationId: true,
      recruiterId: true,
      summary: true,
      outcome: true,
      sharedAt: true,
      emailOutboxKey: true,
    },
  });
};

export const findResult = async (recruiterId, interviewId) => {
  return prisma.interviewResult.findFirst({
    where: {
      interviewId,
      recruiterId,
    },
    select: {
      id: true,
      interviewId: true,
      applicationId: true,
      recruiterId: true,
      summary: true,
      outcome: true,
      sharedAt: true,
      emailOutboxKey: true,
    },
  });
};
