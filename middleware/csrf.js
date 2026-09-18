import crypto from "crypto";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

const CSRF_COOKIE = "csrf_token";
const cookieOpts = () => ({ httpOnly: false, sameSite: "lax", secure: env.isProd || env.forceSecureCookies, path: "/" });

export const attachCsrfToken = (req, res, next) => {
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    res.cookie(CSRF_COOKIE, token, cookieOpts());
  }
  res.locals.csrfToken = token;
  next();
};

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
export const verifyCsrfToken = (req, res, next) => {
  if (SAFE.has(req.method)) return next();
  const cookieToken = req.cookies[CSRF_COOKIE];
  const bodyToken = req.body?._csrf;
  if (cookieToken && bodyToken) {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(bodyToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  }
  return next(new AppError("Your form session expired or is invalid. Please try again.", 403));
};
