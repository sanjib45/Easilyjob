import { AppError } from "../utils/AppError.js";
import {
  findOwnedInterview,
  listOwnedInterviews,
  createInterview,
  updateInterview,
  upsertEvaluation,
  createResult,
  runInTransaction,
} from "../repositories/interview.repository.js";
import {
  findOwnedApplication,
  updateOwnedApplication,
  createStatusHistory,
} from "../repositories/application.repository.js";
import { upsertOutbox } from "../repositories/email.repository.js";
import { deliverQueuedEmail } from "./email-outbox.service.js";
import { assertInterviewTransition } from "../policies/interviewTransitions.js";
import { sendInterviewScheduledEmail } from "./email.service.js";
import { getOrCreateChatForApplication, postChatMessage } from "./chat.service.js";
import { env } from "../config/env.js";

export const INTERVIEW_STATUSES = new Set([
  "SCHEDULED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const RECOMMENDATIONS = new Set(["STRONG_YES", "YES", "MAYBE", "NO"]);

const assertScore = (value, label) => {
  const score = Number.parseInt(value, 10);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new AppError(`${label} must be between 0 and 100.`, 400);
  }
  return score;
};

export const listRecruiterInterviews = async (recruiterId) => {
  const result = await listOwnedInterviews(recruiterId);
  return result.interviews;
};

export const createRecruiterInterview = async ({
  recruiterId,
  applicationId,
  scheduledAt,
  timezone,
  durationMinutes,
  meetingUrl,
  location,
  candidateMessage,
  roundName,
}) => {
  const application = await findOwnedApplication(recruiterId, applicationId);
  if (!application) throw new AppError("Application not found.", 404);

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    throw new AppError("Interview time must be a valid future date.", 400);
  }
  const duration = Number.parseInt(durationMinutes, 10);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    throw new AppError("Interview duration must be between 15 and 240 minutes.", 400);
  }

  const createdInterview = await runInTransaction(async (tx) => {
    const interview = await createInterview(
      recruiterId,
      {
        applicationId,
        jobId: application.jobId,
        scheduledAt: date,
        timezone: String(timezone).trim().slice(0, 80),
        durationMinutes: duration,
        meetingUrl: String(meetingUrl || "").trim() || null,
        location: String(location || "").trim() || null,
        candidateMessage: String(candidateMessage || "").trim() || null,
        roundName: String(roundName || "").trim() || "Interview Round",
      },
      tx
    );

    if (application.status !== "INTERVIEW_SCHEDULED") {
      await updateOwnedApplication(
        recruiterId,
        applicationId,
        { status: "INTERVIEW_SCHEDULED", statusUpdatedAt: new Date() },
        tx
      );
      await createStatusHistory(
        recruiterId,
        {
          applicationId,
          fromStatus: application.status,
          toStatus: "INTERVIEW_SCHEDULED",
        },
        tx
      );
    }
    return interview;
  });

  // ── Post-transaction side-effects (email + auto-chat) ──────────────────
  try {
    // Count existing interviews to derive round number
    const existingList = await listOwnedInterviews(recruiterId);
    const appInterviews = (existingList.interviews || []).filter(
      (iv) => iv.applicationId === applicationId
    );
    const roundNumber = appInterviews.length;

    // 1. Send INTERVIEW_SCHEDULED email to candidate
    await sendInterviewScheduledEmail({
      applicant: { name: application.name, email: application.email },
      job: application.job,
      interview: createdInterview,
      roundNumber,
      appUrl: env.appUrl,
    });

    // 2. Auto-create or retrieve the Direct Chat conversation
    const conversation = await getOrCreateChatForApplication({
      applicationId,
      recruiterId,
      applicantId: application.applicantId,
    });

    // 3. Post automated system bot message into the chat
    const formattedDate = createdInterview.scheduledAt
      ? new Date(createdInterview.scheduledAt).toLocaleString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBD";
    const botMessage = [
      `📅 Interview Scheduled — ${createdInterview.roundName || `Round ${roundNumber}`} for ${application.job.designation}`,
      `🗓 ${formattedDate} (${createdInterview.timezone || "IST"})`,
      `⏱ Duration: ${createdInterview.durationMinutes} minutes`,
      createdInterview.meetingUrl ? `🔗 Meeting: ${createdInterview.meetingUrl}` : null,
      createdInterview.candidateMessage ? `\n💬 Note: ${createdInterview.candidateMessage}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await postChatMessage({
      conversationId: conversation.id,
      senderId: recruiterId,
      content: botMessage,
    });
  } catch (err) {
    console.error("[interview.service] post-schedule side-effect error:", err.message);
  }

  return createdInterview;
};


export const updateRecruiterInterview = async ({
  recruiterId,
  interviewId,
  status,
  scheduledAt,
  cancellationReason,
}) => {
  if (!INTERVIEW_STATUSES.has(status)) {
    throw new AppError("Select a valid interview status.", 400);
  }
  const existing = await findOwnedInterview(recruiterId, interviewId);
  if (!existing) throw new AppError("Interview not found.", 404);

  if (existing.status !== status) {
    assertInterviewTransition(existing.status, status);
  }

  const data = {
    status,
    cancellationReason: String(cancellationReason || "").trim() || null,
  };
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new AppError("Interview time must be a valid future date.", 400);
    }
    data.scheduledAt = date;
  }

  return runInTransaction(async (tx) => {
    const interview = await updateInterview(recruiterId, interviewId, data, tx);
    if (status === "COMPLETED" && existing.application.status !== "INTERVIEWED") {
      await updateOwnedApplication(
        recruiterId,
        existing.applicationId,
        { status: "INTERVIEWED", statusUpdatedAt: new Date() },
        tx
      );
      await createStatusHistory(
        recruiterId,
        {
          applicationId: existing.applicationId,
          fromStatus: existing.application.status,
          toStatus: "INTERVIEWED",
        },
        tx
      );
    }
    return interview;
  });
};

export const saveRecruiterEvaluation = async ({
  recruiterId,
  interviewId,
  technicalScore,
  communicationScore,
  overallScore,
  recommendation,
  strengths,
  concerns,
  privateFeedback,
}) => {
  const interview = await findOwnedInterview(recruiterId, interviewId);
  if (!interview) throw new AppError("Interview not found.", 404);
  if (!RECOMMENDATIONS.has(recommendation)) {
    throw new AppError("Select a valid recommendation.", 400);
  }

  return upsertEvaluation(recruiterId, interviewId, {
    applicationId: interview.applicationId,
    technicalScore: assertScore(technicalScore, "Technical score"),
    communicationScore: assertScore(communicationScore, "Communication score"),
    overallScore: assertScore(overallScore, "Overall score"),
    recommendation,
    strengths: String(strengths || "").trim() || null,
    concerns: String(concerns || "").trim() || null,
    privateFeedback: String(privateFeedback || "").trim() || null,
  });
};

export const OUTCOMES = new Set(["HIRED", "REJECTED", "ON_HOLD"]);

export const shareInterviewResult = async ({ recruiterId, interviewId, outcome, summary }) => {
  if (!OUTCOMES.has(outcome)) {
    throw new AppError("Select a valid outcome: HIRED, REJECTED, or ON_HOLD.", 400);
  }
  const cleanSummary = String(summary || "").trim();
  if (!cleanSummary) {
    throw new AppError("A feedback summary is required.", 400);
  }
  if (cleanSummary.length > 3000) {
    throw new AppError("Summary must be 3,000 characters or fewer.", 400);
  }

  const interview = await findOwnedInterview(recruiterId, interviewId);
  if (!interview) throw new AppError("Interview not found.", 404);

  if (interview.status !== "COMPLETED") {
    throw new AppError("Interview must be completed before sharing results.", 400);
  }

  // Idempotent: if already shared, return existing result without duplicate email
  if (interview.result) {
    return interview.result;
  }

  const outboxKey = `INTERVIEW_RESULT:${interviewId}`;

  const result = await runInTransaction(async (tx) => {
    const res = await createResult(
      recruiterId,
      {
        interviewId,
        applicationId: interview.applicationId,
        outcome,
        summary: cleanSummary,
        emailOutboxKey: outboxKey,
      },
      tx
    );

    await upsertOutbox(
      {
        idempotencyKey: outboxKey,
        toEmail: interview.application.email,
        type: "INTERVIEW_RESULT",
        payload: {
          applicantName: interview.application.name,
          jobTitle: interview.job.designation,
          companyName: interview.job.companyName,
          outcome,
          summary: cleanSummary,
        },
      },
      tx
    );

    // 2. Auto-update Application status to HIRED or REJECTED
    if (outcome === "HIRED" || outcome === "REJECTED") {
      const fromStatus = interview.application.status;
      if (fromStatus !== outcome) {
        await updateOwnedApplication(
          recruiterId,
          interview.applicationId,
          {
            status: outcome,
            statusUpdatedAt: new Date(),
          },
          tx
        );
        await createStatusHistory(
          recruiterId,
          {
            applicationId: interview.applicationId,
            fromStatus,
            toStatus: outcome,
            reason: `Interview decision shared: ${outcome}`,
          },
          tx
        );
      }
    }

    return res;
  });

  await deliverQueuedEmail(outboxKey);

  // 3. Post system decision update to direct chat
  try {
    const conversation = await getOrCreateChatForApplication({
      applicationId: interview.applicationId,
      recruiterId,
      applicantId: interview.application.applicantId,
    });

    let botMessage = "";
    if (outcome === "HIRED") {
      botMessage = `🎉 CONGRATULATIONS! You have been selected for the position of ${interview.job.designation} at ${interview.job.companyName}!\n\nFeedback Summary:\n"${cleanSummary}"\n\nPlease check your email for the formal offer details and next steps.`;
    } else if (outcome === "REJECTED") {
      botMessage = `📋 Interview Decision for ${interview.job.designation}:\n\nFeedback Summary:\n"${cleanSummary}"\n\nThank you for interviewing with ${interview.job.companyName}. We wish you the best in your job search!`;
    } else {
      botMessage = `⏳ Interview Status Update for ${interview.job.designation}:\n\nYour application status is currently ON HOLD.\n\nFeedback Summary:\n"${cleanSummary}"`;
    }

    await postChatMessage({
      conversationId: conversation.id,
      senderId: recruiterId,
      content: botMessage,
    });
  } catch (chatErr) {
    console.error("[interview.service] chat notification on result share error:", chatErr.message);
  }

  return result;
};
