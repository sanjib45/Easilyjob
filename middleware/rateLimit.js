import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Throttles login/register attempts to slow down brute-force/credential-stuffing. */
export const authLimiter = rateLimit({
  windowMs: env.authRateLimit.windowMinutes * 60 * 1000,
  max: env.authRateLimit.maxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many attempts. Please try again later.",
  handler: (req, res) => {
    req.flash("error", "Too many attempts. Please wait a bit before trying again.");
    res.redirect(req.originalUrl.includes("register") ? "/register" : "/login");
  },
});

/** Throttles job-application submissions to deter spam/resume-bombing. */
export const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many applications submitted. Please try again later.");
    res.redirect(`/jobs/${req.params.id}`);
  },
});
