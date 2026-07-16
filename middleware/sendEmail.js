import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

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

/**
 * Sends a confirmation email. Silently no-ops (with a console notice) when
 * EMAIL_USER/EMAIL_PASS aren't configured, so local dev never breaks.
 */
export const sendConfirmationEmail = async (toEmail, jobTitle) => {
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    console.log(
      `[email disabled] Would have sent application confirmation to ${toEmail} for "${jobTitle}".`
    );
    return;
  }

  try {
    await activeTransporter.sendMail({
      from: env.email.from,
      to: toEmail,
      subject: "Job Application Received",
      text: `Thank you for applying to "${jobTitle}". We'll get back to you soon.`,
    });
  } catch (error) {
    // Email failures should never break the request flow (application was already saved).
    console.error("Failed to send confirmation email:", error.message);
  }
};
