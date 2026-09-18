/** Requires a logged-in user; otherwise redirects to login with a flash message. */
import {
  cookieNames,
  verifyAccessToken,
  rotateRefreshToken,
  signAccessToken,
  setAuthCookies,
  toAuthUser,
} from "../services/token.service.js";
import { prisma } from "../config/prisma.js";

const clientMeta = (req) => ({
  userAgent: req.get("user-agent") || null,
  ip: req.ip || null,
});

const loadCurrentUser = (userId) =>
  prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, name: true, email: true, role: true, emailVerified: true },
  });

export const authenticate = async (req, res, next) => {
  try {
    const access = req.cookies[cookieNames.ACCESS_COOKIE];
    const payload = access ? verifyAccessToken(access) : null;
    if (payload?.sub) {
      req.user = toAuthUser(await loadCurrentUser(payload.sub));
      return next();
    }

    const refreshRaw = req.cookies[cookieNames.REFRESH_COOKIE];
    if (!refreshRaw) {
      req.user = null;
      return next();
    }

    const rotated = await rotateRefreshToken(refreshRaw, clientMeta(req));
    if (!rotated) {
      req.user = null;
      return next();
    }

    setAuthCookies(res, signAccessToken(rotated.user), rotated.refresh.raw, rotated.refresh.expiresAt);
    req.user = toAuthUser(rotated.user);
    return next();
  } catch (err) {
    return next(err);
  }
};

export const isAuthenticated = (req, res, next) => {
  if (req.user) return next();
  req.flash("error", "Please log in to continue.");
  return res.redirect("/login");
};

export const isGuest = (req, res, next) => {
  if (req.user) return res.redirect("/jobs");
  return next();
};

export const requireEmailVerified = (req, res, next) => {
  if (req.user?.emailVerified) return next();
  req.flash("error", "Please verify your email before continuing. Check your inbox.");
  return res.redirect(String(req.user?.role || "").toUpperCase() === "RECRUITER" ? "/recruiter" : "/jobs");
};

export const requireJobOwner = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      return res.status(404).render("error", {
        title: "Not found",
        statusCode: 404,
        message: "Job not found.",
        stack: null,
      });
    }
    if (!req.user || job.recruiterId !== req.user.id) {
      return res.status(403).render("unauthorized", { title: "Access denied" });
    }
    req.job = job;
    return next();
  } catch (err) {
    return next(err);
  }
};
