import crypto from "crypto";
import { env } from "../config/env.js";

const FLASH_COOKIE = "flash";

const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", env.cookieSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
};

const unsign = (value) => {
  if (!value || !value.includes(".")) return null;
  const [body, sig] = value.split(".");
  const expected = crypto.createHmac("sha256", env.cookieSecret).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

/** One-shot flash messages via signed cookie (replaces connect-flash + sessions). */
export const flashMiddleware = (req, res, next) => {
  const incoming = unsign(req.cookies[FLASH_COOKIE]);
  res.clearCookie(FLASH_COOKIE, { path: "/" });

  const bag = { error: [], success: [] };
  if (incoming?.error) bag.error = [].concat(incoming.error);
  if (incoming?.success) bag.success = [].concat(incoming.success);

  req.flash = (type, message) => {
    if (!bag[type]) bag[type] = [];
    if (Array.isArray(message)) bag[type].push(...message);
    else bag[type].push(message);
  };

  const originalRedirect = res.redirect.bind(res);
  res.redirect = (...args) => {
    const hasMessages = bag.error.length || bag.success.length;
    if (hasMessages) {
      res.cookie(FLASH_COOKIE, sign({ error: bag.error, success: bag.success }), {
        httpOnly: true,
        sameSite: "lax",
        secure: env.isProd || env.forceSecureCookies,
        maxAge: 60 * 1000,
        path: "/",
      });
    }
    return originalRedirect(...args);
  };

  res.locals.messages = bag;
  next();
};
