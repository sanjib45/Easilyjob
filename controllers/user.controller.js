import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { issueAuthSession, clearAuthCookies, revokeRefreshToken, cookieNames } from "../services/token.service.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";

import { getPublicJobFacets } from "../repositories/job.repository.js";

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

export const renderQuickApply = asyncHandler(async (req, res) => {
  const facets = await getPublicJobFacets();
  res.render("users/quick-apply", {
    title: "Quick Job Apply · AI Assistant",
    facets,
  });
});

export const handleQuickApplyRegister = asyncHandler(async (req, res) => {
  const { name, email, password, skills, preferredLocation, preferredDomain } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: "Please provide your name, email, and password." });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters long." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return res.status(409).json({ success: false, error: "An account with that email already exists. Please log in." });
  }

  const verifyToken = crypto.randomBytes(32).toString("hex");
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "APPLICANT",
      emailVerified: false,
      verifyToken: hashVerificationToken(verifyToken),
      verifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user, verifyToken, requestAppUrl(req));
  await issueAuthSession(res, user, clientMeta(req));

  const candidateSkills = Array.isArray(skills)
    ? skills
    : typeof skills === "string"
    ? skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const openJobs = await prisma.job.findMany({
    where: {
      status: "OPEN",
      applyBy: { gte: new Date() },
    },
    take: 6,
    orderBy: { createdAt: "desc" },
  });

  const matches = openJobs.map((job) => {
    let jobSkills = [];
    try {
      jobSkills = JSON.parse(job.skills || "[]");
    } catch {
      jobSkills = typeof job.skills === "string" ? job.skills.split(",").map((s) => s.trim()) : [];
    }

    const matchedSkillCount = candidateSkills.filter((sk) =>
      jobSkills.some((jsk) => jsk.toLowerCase().includes(sk.toLowerCase()))
    ).length;

    const matchScore = candidateSkills.length > 0
      ? Math.min(98, Math.max(70, Math.round((matchedSkillCount / candidateSkills.length) * 100) || 75))
      : 85;

    return {
      id: job.id,
      designation: job.designation,
      companyName: job.companyName,
      location: job.location,
      salary: job.salary,
      skills: jobSkills.slice(0, 3),
      matchScore,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return res.status(201).json({
    success: true,
    message: `Account created successfully! Welcome, ${user.name}.`,
    user: { id: user.id, name: user.name, email: user.email },
    matches,
  });
});

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

export const renderForgotPassword = (req, res) => res.render("users/forgot-password", { title: "Forgot Password" });

export const handleForgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashVerificationToken(resetToken),
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    });
    await sendPasswordResetEmail(user, resetToken, requestAppUrl(req));
  }
  
  req.flash("success", "If an account with that email exists, a password reset link has been sent.");
  res.redirect("/forgot-password");
});

export const renderResetPassword = asyncHandler(async (req, res) => {
  const token = String(req.query.token || "");
  const user = await prisma.user.findFirst({
    where: { resetToken: hashVerificationToken(token), resetTokenExpires: { gt: new Date() } }
  });
  
  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot-password");
  }
  
  res.render("users/reset-password", { title: "Reset Password", token });
});

export const handleResetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { resetToken: hashVerificationToken(token), resetTokenExpires: { gt: new Date() } }
  });
  
  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot-password");
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      resetToken: null,
      resetTokenExpires: null
    }
  });
  
  req.flash("success", "Your password has been updated. Please log in.");
  res.redirect("/login");
});
