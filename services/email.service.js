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

