import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { issueAuthSession, clearAuthCookies, revokeRefreshToken, cookieNames } from "../services/token.service.js";
import { sendVerificationEmail } from "../services/email.service.js";

const hashVerificationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const normalizeRole = (role) => (String(role || "").toUpperCase() === "RECRUITER" ? "RECRUITER" : "APPLICANT");
const clientMeta = (req) => ({ userAgent: req.get("user-agent") || null, ip: req.ip || null });
const requestAppUrl = (req) => {
  if (process.env.NODE_ENV === "production") return undefined;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : undefined;
};
const verificationMessage = (status, success) => status === "sent" ? success : status === "skipped"
  ? "Verification email delivery is not configured. Set EMAIL_USER and EMAIL_PASS, then resend the link."
  : "Verification email delivery failed. Check EMAIL_USER and EMAIL_PASS, then resend the link.";

export const renderLogin = (req, res) => res.render("users/login", { title: "Log in" });
export const renderRegister = (req, res) => res.render("users/register", { title: "Create account" });

export const handleRegister = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const normalizedEmail = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    req.flash("error", "An account with that email already exists.");
    return res.redirect("/register");
  }
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const user = await prisma.user.create({
    data: {
      name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12),
      role: normalizeRole(role), emailVerified: false, verifyToken: hashVerificationToken(verifyToken),
      verifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const result = await sendVerificationEmail(user, verifyToken, requestAppUrl(req));
  await issueAuthSession(res, user, clientMeta(req));
  req.flash(result.status === "sent" ? "success" : "error", verificationMessage(result.status, `Welcome, ${user.name}! Please check your email to verify your account.`));
  res.redirect(user.role === "RECRUITER" ? "/recruiter" : "/jobs");
});

export const handleLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    req.flash("error", "Invalid email or password.");
    return res.redirect("/login");
  }
  await issueAuthSession(res, user, clientMeta(req));
  req.flash("success", `Welcome back, ${user.name}!`);
  res.redirect(user.role === "RECRUITER" ? "/recruiter" : "/jobs");
});

export const handleLogout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(req.cookies[cookieNames.REFRESH_COOKIE]);
  clearAuthCookies(res);
  req.flash("success", "You have been logged out.");
  res.redirect("/");
});

export const handleVerifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.query.token || "");
  const user = await prisma.user.findFirst({ where: { OR: [{ verifyToken: hashVerificationToken(token) }, { verifyToken: token }], verifyExpires: { gt: new Date() } } });
  if (!user) {
    req.flash("error", "Verification link is invalid or has expired.");
    return res.redirect("/login");
  }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verifyToken: null, verifyExpires: null } });
  await issueAuthSession(res, { ...user, emailVerified: true }, clientMeta(req));
  req.flash("success", "Email verified successfully. You're all set!");
  res.redirect(user.role === "RECRUITER" ? "/recruiter" : "/jobs");
});

export const handleResendVerification = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.redirect("/login");
  if (user.emailVerified) {
    req.flash("success", "Your email is already verified.");
    return res.redirect("/jobs");
  }
  const verifyToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken: hashVerificationToken(verifyToken), verifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  const result = await sendVerificationEmail(user, verifyToken, requestAppUrl(req));
  req.flash(result.status === "sent" ? "success" : "error", verificationMessage(result.status, "Verification email sent. Check your inbox."));
  res.redirect("/jobs");
});
