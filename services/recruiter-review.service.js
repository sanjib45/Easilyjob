import { AppError } from "../utils/AppError.js";
import { deliverQueuedEmail } from "./email-outbox.service.js";
import {
  findOwnedApplication,
  listOwnedApplications,
  updateOwnedApplication,
  createStatusHistory,
  runInTransaction,
} from "../repositories/application.repository.js";
import { upsertOutbox } from "../repositories/email.repository.js";
import { assertApplicationTransition } from "../policies/applicationTransitions.js";

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
  const application = await findOwnedApplication(recruiterId, applicationId);
  if (!application) throw new AppError("Application not found.", 404);
  return application;
};

const sortOrders = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  applicant: [{ name: "asc" }, { id: "asc" }],
  status: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
};

export const listRecruiterApplications = async ({
  recruiterId,
  search = "",
  status = "",
  jobId = "",
  sort = "newest",
  page = 1,
  limit = 25,
}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 25));
  const normalizedSearch = String(search).trim();
  const orderBy = sortOrders[sort] || sortOrders.newest;
  const skip = (safePage - 1) * safeLimit;

  const { applications, total } = await listOwnedApplications(recruiterId, {
    search: normalizedSearch,
    status: status && REVIEW_STATUSES.has(status) ? status : "",
    jobId,
    orderBy,
    skip,
    take: safeLimit,
  });

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

export const updateRecruiterApplication = async ({
  applicationId,
  recruiterId,
  status,
  recruiterNote,
}) => {
  if (!REVIEW_STATUSES.has(status)) throw new AppError("Select a valid application status.", 400);
  if (recruiterNote && recruiterNote.length > 2000) {
    throw new AppError("Recruiter notes must be 2,000 characters or fewer.", 400);
  }

  const current = await getRecruiterApplication(applicationId, recruiterId);
  const changedStatus = current.status !== status;

  if (changedStatus) {
    assertApplicationTransition(current.status, status);
  }

  const shortlistKey = `APPLICATION_SHORTLISTED:${applicationId}`;

  await runInTransaction(async (tx) => {
    await updateOwnedApplication(
      recruiterId,
      applicationId,
      {
        status,
        recruiterNote: recruiterNote || null,
        statusUpdatedAt: changedStatus ? new Date() : current.statusUpdatedAt,
      },
      tx
    );

    if (changedStatus) {
      await createStatusHistory(
        recruiterId,
        {
          applicationId,
          fromStatus: current.status,
          toStatus: status,
        },
        tx
      );
    }

    if (changedStatus && status === "SHORTLISTED") {
      await upsertOutbox(
        {
          idempotencyKey: shortlistKey,
          toEmail: current.email,
          type: "APPLICATION_SHORTLISTED",
          payload: shortlistPayload({ application: current, job: current.job }),
        },
        tx
      );
    }
  });

  if (changedStatus && status === "SHORTLISTED") {
    await deliverQueuedEmail(shortlistKey);
  }

  return getRecruiterApplication(applicationId, recruiterId);
};
