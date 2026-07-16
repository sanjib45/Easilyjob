import { validationResult } from "express-validator";

/**
 * Runs after express-validator checks. On failure, flashes the error
 * messages + submitted form data and redirects back to the form.
 *
 * @param {string | ((req: import('express').Request) => string)} redirectTo
 */
export const validate = (redirectTo) => (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  req.flash("error", errors.array().map((e) => e.msg));

  const target = typeof redirectTo === "function" ? redirectTo(req) : redirectTo;
  return res.redirect(target || req.originalUrl);
};
