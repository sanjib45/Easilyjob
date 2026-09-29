import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { createEmailLog } from "../repositories/email.repository.js";

let transporter = null;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getTransporter = () => {
  if (!env.email.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: env.email.service || "gmail",
      auth: {
        user: env.email.user,
        pass: env.email.pass,
      },
    });
  }
  return transporter;
};

const templates = {
  EMAIL_VERIFY: ({ name, verifyUrl }) => ({
    subject: "Verify your Easily Jobs email",
    text: `Hi ${name},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— Easily Jobs`,
    html: `<p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>Please verify your email to activate your Easily Jobs account.</p>
      <p><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:10px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;">Verify email</a></p>
      <p style="color:#64748b;font-size:13px;">Or paste this URL: ${escapeHtml(verifyUrl)}</p>
      <p style="color:#64748b;font-size:13px;">This link expires in 24 hours.</p>`,
  }),
  PASSWORD_RESET: ({ name, resetUrl }) => ({
    subject: "Reset your Easily Jobs password",
    text: `Hi ${name},\n\nYou requested a password reset. Please click the link below to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— Easily Jobs`,
    html: `<p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>You requested a password reset. Please click the button below to set a new password:</p>
      <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:10px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;">Reset Password</a></p>
      <p style="color:#64748b;font-size:13px;">Or paste this URL: ${escapeHtml(resetUrl)}</p>
      <p style="color:#64748b;font-size:13px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>`,
  }),
  APPLICATION_RECEIVED: ({ name, jobTitle, companyName }) => ({
    subject: `Application received — ${jobTitle}`,
    text: `Hi ${name},\n\nWe received your application for "${jobTitle}" at ${companyName}. The recruiter will review it soon.\n\n— Easily Jobs`,
    html: `<p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>We received your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p>The recruiter will review it soon. Good luck!</p>
      <p style="color:#64748b;">— Easily Jobs</p>`,
  }),
  APPLICATION_NOTIFY_RECRUITER: ({ recruiterName, applicantName, jobTitle }) => ({
    subject: `New applicant for ${jobTitle}`,
    text: `Hi ${recruiterName},\n\n${applicantName} applied to "${jobTitle}".\n\nLog in to your dashboard to review the application.\n\n— Easily Jobs`,
    html: `<p>Hi <strong>${escapeHtml(recruiterName)}</strong>,</p>
      <p><strong>${escapeHtml(applicantName)}</strong> just applied to <strong>${escapeHtml(jobTitle)}</strong>.</p>
      <p><a href="${env.appUrl}/recruiter">Open your dashboard</a></p>`,
  }),
  APPLICATION_SHORTLISTED: ({ applicantName, jobTitle, companyName, nextStep }) => ({
    subject: `You have been shortlisted — ${jobTitle}`,
    text: `Hi ${applicantName},\n\nYou have been shortlisted for "${jobTitle}" at ${companyName}.\n\n${nextStep}\n\n— Easily Jobs`,
    html: `<p>Hi <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p>You have been shortlisted for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p>${escapeHtml(nextStep)}</p>
      <p style="color:#64748b;">— Easily Jobs</p>`,
  }),
  INTERVIEW_SCHEDULED: ({ applicantName, jobTitle, companyName, scheduledAt, timezone, durationMinutes, meetingUrl, location, candidateMessage, roundNumber, portalUrl }) => ({
    subject: `Interview Scheduled — ${jobTitle} at ${companyName}`,
    text: `Hi ${applicantName},\n\nYour interview for "${jobTitle}" at ${companyName} has been scheduled.\n\nDate & Time: ${scheduledAt}\nTimezone: ${timezone}\nDuration: ${durationMinutes} minutes\n${meetingUrl ? `Meeting Link: ${meetingUrl}` : location ? `Location: ${location}` : ''}\n${candidateMessage ? `\nMessage from Recruiter:\n${candidateMessage}` : ''}\n\nLog in to your Easily Jobs portal to track your application status.\n\n— ${companyName} Hiring Team`,
    html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: linear-gradient(135deg, #0e74d6 0%, #0d9488 100%); border-radius: 16px 16px 0 0; padding: 32px 32px 24px; text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📅</div>
        <h1 style="color: #fff; margin: 0 0 4px; font-size: 1.5rem; font-weight: 800;">Interview Scheduled</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 0.95rem;">${escapeHtml(jobTitle)} &middot; ${escapeHtml(companyName)}</p>
      </div>
      <div style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 1rem; margin: 0 0 24px;">Hi <strong>${escapeHtml(applicantName)}</strong>,</p>
        <p style="color: #475569; margin: 0 0 24px;">Great news! Your interview for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong> has been confirmed. Here are the details:</p>

        ${roundNumber ? `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 1.2rem;">🔁</span> <strong style="color: #1d4ed8;">Round ${escapeHtml(String(roundNumber))}</strong></div>` : ''}

        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; width: 40%;">Date &amp; Time</td><td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${escapeHtml(scheduledAt)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Timezone</td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(timezone)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Duration</td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(String(durationMinutes))} minutes</td></tr>
            ${location ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Location</td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(location)}</td></tr>` : ''}
          </table>
        </div>

        ${meetingUrl ? `<div style="text-align: center; margin-bottom: 24px;"><a href="${escapeHtml(meetingUrl)}" style="display: inline-block; background: linear-gradient(135deg, #0e74d6, #0d9488); color: #fff; font-weight: 800; font-size: 1rem; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(13,148,136,0.35);">🎥 Join Video Meeting</a></div>` : ''}

        ${candidateMessage ? `<div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px;"><p style="margin: 0 0 4px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #0d9488;">Message from Recruiter</p><p style="margin: 0; color: #1e293b; font-size: 0.95rem; white-space: pre-wrap;">${escapeHtml(candidateMessage)}</p></div>` : ''}

        ${portalUrl ? `<div style="text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0;"><a href="${escapeHtml(portalUrl)}" style="color: #0e74d6; font-weight: 600; font-size: 0.9rem; text-decoration: none;">📊 Track Application Status →</a></div>` : ''}

        <p style="color: #94a3b8; font-size: 0.82rem; text-align: center; margin: 20px 0 0;">Best of luck! — <strong>${escapeHtml(companyName)}</strong> Hiring Team via Easily Jobs</p>
      </div>
    </div>`,
  }),
  INTERVIEW_RESULT: ({ applicantName, jobTitle, companyName, outcome, summary }) => ({
    subject: `Interview Result — ${jobTitle} at ${companyName}`,
    text: `Hi ${applicantName},\n\nYour interview result for "${jobTitle}" at ${companyName} is: ${outcome}.\n\nFeedback Summary:\n${summary}\n\n— ${companyName} Hiring Team`,
    html: `<p>Hi <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p>Thank you for taking the time to interview for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p><strong>Status / Outcome:</strong> <span style="display:inline-block;padding:4px 10px;background:#f0fdfa;color:#0d9488;border-radius:4px;font-weight:700;">${escapeHtml(outcome)}</span></p>
      <div style="background:#f8fafc;border-left:4px solid #0d9488;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;color:#334155;white-space:pre-wrap;">${escapeHtml(summary)}</p>
      </div>
      <p style="color:#64748b;">Best regards,<br/><strong>${escapeHtml(companyName)}</strong> Hiring Team</p>`,
  }),
};

/**
 * Sends an email and writes an EmailLog row.
 * Never throws to the caller for transport failures (logged as failed).
 */
export const sendEmail = async ({ to, type, data }) => {
  const tpl = templates[type];
  if (!tpl) {
    throw new Error(`Unknown email type: ${type}`);
  }
  const { subject, text, html } = tpl(data);
  const active = getTransporter();

  if (!active) {
    console.log(`[email skipped] ${type} → ${to} | ${subject}`);
    await createEmailLog({ toEmail: to, subject, type, status: "skipped" });
    return { status: "skipped" };
  }

  try {
    await active.sendMail({
      from: env.email.from,
      to,
      subject,
      text,
      html,
    });
    await createEmailLog({ toEmail: to, subject, type, status: "sent" });
    return { status: "sent" };
  } catch (error) {
    console.error("Email send failed:", error.message);
    await createEmailLog({
      toEmail: to,
      subject,
      type,
      status: "failed",
      error: error.message,
    });
    return { status: "failed", error: error.message };
  }
};

export const sendVerificationEmail = async (user, verifyToken, appUrl = env.appUrl) => {
  const verifyUrl = `${appUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(verifyToken)}`;
  const result = await sendEmail({
    to: user.email,
    type: "EMAIL_VERIFY",
    data: { name: user.name, verifyUrl },
  });

  if (result.status !== "sent" && !env.isProd) {
    console.warn(`[email ${result.status}] Verification URL: ${verifyUrl}`);
  }
  return result;
};

export const sendApplicationEmails = async ({ applicant, job, recruiter }) => {
  await sendEmail({
    to: applicant.email,
    type: "APPLICATION_RECEIVED",
    data: {
      name: applicant.name,
      jobTitle: job.designation,
      companyName: job.companyName,
    },
  });

    if (recruiter?.email) {
    await sendEmail({
      to: recruiter.email,
      type: "APPLICATION_NOTIFY_RECRUITER",
      data: {
        recruiterName: recruiter.name,
        applicantName: applicant.name,
        jobTitle: job.designation,
      },
    });
  }
};

export const sendPasswordResetEmail = async (user, resetToken, appUrl = env.appUrl) => {
  const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const result = await sendEmail({
    to: user.email,
    type: "PASSWORD_RESET",
    data: { name: user.name, resetUrl },
  });

  if (result.status !== "sent" && !env.isProd) {
    console.warn(`[email ${result.status}] Password Reset URL: ${resetUrl}`);
  }
  return result;
};

/**
 * Sends the INTERVIEW_SCHEDULED rich HTML email to a candidate.
 * Formats the scheduledAt Date into a human-readable string before sending.
 */
export const sendInterviewScheduledEmail = async ({ applicant, job, interview, roundNumber, appUrl = env.appUrl }) => {
  const formattedDate = interview.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "To be confirmed";

  return sendEmail({
    to: applicant.email,
    type: "INTERVIEW_SCHEDULED",
    data: {
      applicantName: applicant.name,
      jobTitle: job.designation,
      companyName: job.companyName,
      scheduledAt: formattedDate,
      timezone: interview.timezone || "IST",
      durationMinutes: interview.durationMinutes,
      meetingUrl: interview.meetingUrl || null,
      location: interview.location || null,
      candidateMessage: interview.candidateMessage || null,
      roundNumber: roundNumber || null,
      portalUrl: `${(appUrl || "").replace(/\/$/, "")}/applicant/applications`,
    },
  });
};

