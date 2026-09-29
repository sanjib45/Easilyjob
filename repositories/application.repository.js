import { prisma } from "../config/prisma.js";

/**
 * Application repository.
 * Every recruiter query takes recruiterId as the first argument
 * and enforces tenant data isolation by filtering on job.recruiterId.
 */

const defaultInclude = {
  job: true,
  applicant: {
    select: {
      id: true,
      name: true,
      headline: true,
      bio: true,
      skills: true,
      experienceYears: true,
      location: true,
      education: true,
      currentCompany: true,
      expectedSalary: true,
      phone: true,
      resumeUrl: true,
      profileCompletedPct: true,
    },
  },
  statusHistory: { orderBy: { createdAt: "desc" } },
  interviews: {
    include: { evaluation: true, result: true },
    orderBy: { scheduledAt: "desc" },
  },
};

export const runInTransaction = async (callback) => {
  return prisma.$transaction(callback);
};

export const findOwnedApplication = async (recruiterId, applicationId, options = {}) => {
  const client = options.tx || prisma;
  return client.application.findFirst({
    where: {
      id: applicationId,
      job: { recruiterId },
    },
    include: options.include || defaultInclude,
  });
};

export const listOwnedApplications = async (
  recruiterId,
  { search = "", status = "", jobId = "", orderBy, skip = 0, take = 25 }
) => {
  const where = {
    job: {
      recruiterId,
      ...(jobId ? { id: jobId } : {}),
    },
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { job: { designation: { contains: search }, recruiterId } },
            { job: { companyName: { contains: search }, recruiterId } },
          ],
        }
      : {}),
  };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        job: true,
        applicant: {
          select: {
            id: true,
            name: true,
            headline: true,
            skills: true,
            experienceYears: true,
            location: true,
            education: true,
            profileCompletedPct: true,
          },
        },
      },
      orderBy: orderBy || [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, total };
};

export const updateOwnedApplication = async (recruiterId, applicationId, data, tx = null) => {
  const client = tx || prisma;
  // Enforce ownership check before update
  const exists = await client.application.findFirst({
    where: { id: applicationId, job: { recruiterId } },
    select: { id: true },
  });
  if (!exists) return null;

  return client.application.update({
    where: { id: applicationId },
    data,
  });
};

export const createStatusHistory = async (recruiterId, { applicationId, fromStatus, toStatus, reason }, tx = null) => {
  const client = tx || prisma;
  return client.applicationStatusHistory.create({
    data: {
      applicationId,
      actorId: recruiterId,
      fromStatus: fromStatus || null,
      toStatus,
      reason: reason || null,
    },
  });
};

export const findOwnedApplicationWithResume = async (recruiterId, applicationId, jobId) => {
  return prisma.application.findFirst({
    where: {
      id: applicationId,
      jobId,
      job: { recruiterId },
    },
  });
};

export const submitApplication = async ({ job, user, contact, resumePath }) => {
  return prisma.$transaction(async (tx) => {
    const reserved = await tx.job.updateMany({
      where: {
        id: job.id,
        status: "OPEN",
        applyBy: { gte: new Date() },
        applicationsAccepted: { lt: job.openings },
      },
      data: { applicationsAccepted: { increment: 1 } },
    });
    if (reserved.count !== 1) {
      throw new Error("OVERFLOW_OR_CLOSED");
    }
    const application = await tx.application.create({
      data: {
        jobId: job.id,
        applicantId: user.id,
        name: user.name,
        email: user.email,
        contact: contact.trim(),
        resumePath,
      },
    });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        actorId: user.id,
        toStatus: "NEW",
        reason: "Application submitted.",
      },
    });

    if (job.recruiterId && user.id) {
      await tx.conversation.create({
        data: {
          applicationId: application.id,
          recruiterId: job.recruiterId,
          applicantId: user.id,
          lastMessage: `Application submitted for ${job.designation}`,
          lastMessageAt: new Date(),
        },
      });
    }

    return application;
  });
};

export const listApplicantApplications = async (applicantId) => {
  return prisma.application.findMany({
    where: { applicantId },
    include: {
      job: { select: { id: true, designation: true, companyName: true, location: true, salary: true } },
      conversation: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};
