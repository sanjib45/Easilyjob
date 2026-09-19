import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { deliverQueuedEmail } from "./email-outbox.service.js";

export const REVIEW_STATUSES = new Set([
  "NEW",
  "REVIEWING",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "HIRED",
  "REJECTED",
]);

const shortlistPayload = ({ application, job }) => ({
  applicantName: application.name,
  jobTitle: job.designation,
  companyName: job.companyName,
  nextStep: "The recruiter will contact you with interview details.",
});

export const getRecruiterApplication = async (applicationId, recruiterId) => {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { recruiterId } },
    include: {
      job: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      interviews: { include: { evaluation: true }, orderBy: { scheduledAt: "desc" } },
    },
  });

  if (!application) throw new AppError("Application not found.", 404);
  return application;
};

const sortOrders = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  applicant: [{ name: "asc" }, { id: "asc" }],
  status: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
};

export const listRecruiterApplications = async ({ recruiterId, search = "", status = "", jobId = "", sort = "newest", page = 1, limit = 25 }) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 25));
  const normalizedSearch = String(search).trim();
  const where = {
    job: {
      recruiterId,
      ...(jobId ? { id: jobId } : {}),
    },
    ...(status && REVIEW_STATUSES.has(status) ? { status } : {}),
    ...(normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch } },
            { email: { contains: normalizedSearch } },
            { job: { designation: { contains: normalizedSearch }, recruiterId } },
            { job: { companyName: { contains: normalizedSearch }, recruiterId } },
          ],
        }
      : {}),
  };
  const orderBy = sortOrders[sort] || sortOrders.newest;
  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: { job: true },
      orderBy,
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.application.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    filters: { search: normalizedSearch, status, jobId, sort: sortOrders[sort] ? sort : "newest" },
  };
};

export const updateRecruiterApplication = async ({ applicationId, recruiterId, status, recruiterNote }) => {
  if (!REVIEW_STATUSES.has(status)) throw new AppError("Select a valid application status.", 400);
  if (recruiterNote.length > 2000) throw new AppError("Recruiter notes must be 2,000 characters or fewer.", 400);

  const current = await getRecruiterApplication(applicationId, recruiterId);
  const changedStatus = current.status !== status;
  const shortlistKey = `APPLICATION_SHORTLISTED:${applicationId}`;

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status,
        recruiterNote: recruiterNote || null,
        statusUpdatedAt: changedStatus ? new Date() : current.statusUpdatedAt,
      },
    });

    if (changedStatus) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          actorId: recruiterId,
          fromStatus: current.status,
          toStatus: status,
        },
      });
    }

    if (changedStatus && status === "SHORTLISTED") {
      await tx.emailOutbox.upsert({
        where: { idempotencyKey: shortlistKey },
        update: {},
        create: {
          idempotencyKey: shortlistKey,
          toEmail: current.email,
          type: "APPLICATION_SHORTLISTED",
          payload: JSON.stringify(shortlistPayload({ application: current, job: current.job })),
        },
      });
    }
  });

  if (changedStatus && status === "SHORTLISTED") await deliverQueuedEmail(shortlistKey);
  return getRecruiterApplication(applicationId, recruiterId);
};
