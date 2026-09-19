import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export const INTERVIEW_STATUSES = new Set(["SCHEDULED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
export const RECOMMENDATIONS = new Set(["STRONG_YES", "YES", "MAYBE", "NO"]);

const assertScore = (value, label) => {
  const score = Number.parseInt(value, 10);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new AppError(`${label} must be between 0 and 100.`, 400);
  return score;
};

const getOwnedApplication = (applicationId, recruiterId) => prisma.application.findFirst({
  where: { id: applicationId, job: { recruiterId } },
  include: { job: true },
});

export const listRecruiterInterviews = async (recruiterId) => prisma.interview.findMany({
  where: { recruiterId },
  include: { application: true, job: true, evaluation: true },
  orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
});

export const createRecruiterInterview = async ({ recruiterId, applicationId, scheduledAt, timezone, durationMinutes, meetingUrl, location, candidateMessage }) => {
  const application = await getOwnedApplication(applicationId, recruiterId);
  if (!application) throw new AppError("Application not found.", 404);

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime()) || date <= new Date()) throw new AppError("Interview time must be a valid future date.", 400);
  const duration = Number.parseInt(durationMinutes, 10);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) throw new AppError("Interview duration must be between 15 and 240 minutes.", 400);

  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.create({
      data: {
        applicationId,
        jobId: application.jobId,
        recruiterId,
        scheduledAt: date,
        timezone: String(timezone).trim().slice(0, 80),
        durationMinutes: duration,
        meetingUrl: String(meetingUrl || "").trim() || null,
        location: String(location || "").trim() || null,
        candidateMessage: String(candidateMessage || "").trim() || null,
      },
      include: { application: true, job: true },
    });

    if (application.status !== "INTERVIEW_SCHEDULED") {
      await tx.application.update({ where: { id: applicationId }, data: { status: "INTERVIEW_SCHEDULED", statusUpdatedAt: new Date() } });
      await tx.applicationStatusHistory.create({
        data: { applicationId, actorId: recruiterId, fromStatus: application.status, toStatus: "INTERVIEW_SCHEDULED" },
      });
    }
    return interview;
  });
};

export const updateRecruiterInterview = async ({ recruiterId, interviewId, status, scheduledAt, cancellationReason }) => {
  if (!INTERVIEW_STATUSES.has(status)) throw new AppError("Select a valid interview status.", 400);
  const existing = await prisma.interview.findFirst({ where: { id: interviewId, recruiterId }, include: { application: true, job: true } });
  if (!existing) throw new AppError("Interview not found.", 404);

  const data = { status, cancellationReason: String(cancellationReason || "").trim() || null };
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date <= new Date()) throw new AppError("Interview time must be a valid future date.", 400);
    data.scheduledAt = date;
  }

  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.update({ where: { id: interviewId }, data, include: { application: true, job: true, evaluation: true } });
    if (status === "COMPLETED" && existing.application.status !== "INTERVIEWED") {
      await tx.application.update({ where: { id: existing.applicationId }, data: { status: "INTERVIEWED", statusUpdatedAt: new Date() } });
      await tx.applicationStatusHistory.create({ data: { applicationId: existing.applicationId, actorId: recruiterId, fromStatus: existing.application.status, toStatus: "INTERVIEWED" } });
    }
    return interview;
  });
};

export const saveRecruiterEvaluation = async ({ recruiterId, interviewId, technicalScore, communicationScore, overallScore, recommendation, strengths, concerns, privateFeedback }) => {
  const interview = await prisma.interview.findFirst({ where: { id: interviewId, recruiterId } });
  if (!interview) throw new AppError("Interview not found.", 404);
  if (!RECOMMENDATIONS.has(recommendation)) throw new AppError("Select a valid recommendation.", 400);

  return prisma.interviewEvaluation.upsert({
    where: { interviewId },
    update: {
      technicalScore: assertScore(technicalScore, "Technical score"),
      communicationScore: assertScore(communicationScore, "Communication score"),
      overallScore: assertScore(overallScore, "Overall score"),
      recommendation,
      strengths: String(strengths || "").trim() || null,
      concerns: String(concerns || "").trim() || null,
      privateFeedback: String(privateFeedback || "").trim() || null,
    },
    create: {
      interviewId,
      applicationId: interview.applicationId,
      recruiterId,
      technicalScore: assertScore(technicalScore, "Technical score"),
      communicationScore: assertScore(communicationScore, "Communication score"),
      overallScore: assertScore(overallScore, "Overall score"),
      recommendation,
      strengths: String(strengths || "").trim() || null,
      concerns: String(concerns || "").trim() || null,
      privateFeedback: String(privateFeedback || "").trim() || null,
    },
  });
};
