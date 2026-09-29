import { navigationConfig, resolveActiveKey } from "../config/navigation.js";

/**
 * App Shell Middleware
 * Attaches navigation registry, active tab key, user card data, and cache directives.
 */
export const attachShell = (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");

  const role = String(req.user?.role || "APPLICANT").toUpperCase();
  const navConfig = navigationConfig[role] || navigationConfig.APPLICANT;
  const activeNavKey = resolveActiveKey(role, req.path);

  res.locals.shellRole = role;
  res.locals.navConfig = navConfig;
  res.locals.activeNavKey = activeNavKey;

  // Use unified app-shell layout for logged-in users
  if (req.user) {
    res.locals.layout = "layouts/app-shell";
  }

  next();
};
