import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

/** Ensures every session has a CSRF token and exposes it to views as csrfToken. */
export const attachCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Rejects state-changing requests that don't carry a matching CSRF token. */
export const verifyCsrfToken = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const tokenFromRequest = req.body?._csrf;
  if (
    tokenFromRequest &&
    req.session.csrfToken &&
    tokenFromRequest === req.session.csrfToken
  ) {
    return next();
  }

  return next(
    new AppError("Your form session expired or is invalid. Please try again.", 403)
  );
};
