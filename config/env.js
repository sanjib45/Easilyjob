import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

const configuredAppUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
if (isProd && !configuredAppUrl) {
  throw new Error("APP_URL must be set to the public HTTPS application URL in production.");
}

const requireSecret = (name) => {
  const value = process.env[name];
  if (value && value.length >= 32 && !value.startsWith("replace-with")) return value;
  if (isProd) throw new Error(`${name} must be set to a strong secret in production.`);
  const generated = crypto.randomBytes(48).toString("hex");
  console.warn(`⚠️  ${name} missing/weak. Using a random secret for this process only.`);
  return generated;
};

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 3000,
  appUrl: configuredAppUrl || `http://localhost:${process.env.PORT || 3000}`,
  databaseUrl: process.env.DATABASE_URL || "",
  jwt: {
    accessSecret: requireSecret("JWT_ACCESS_SECRET"),
    refreshSecret: requireSecret("JWT_REFRESH_SECRET"),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshDays: Number(process.env.JWT_REFRESH_DAYS) || 7,
  },
  cookieSecret: requireSecret("COOKIE_SECRET"),
  trustProxy: process.env.TRUST_PROXY === "true" ? 1 : false,
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "100kb",
  forceSecureCookies: process.env.FORCE_SECURE_COOKIES === "true",
  email: {
    service: process.env.EMAIL_SERVICE || "gmail",
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
    from: process.env.EMAIL_FROM || "Job Portal <no-reply@example.com>",
    get enabled() {
      return Boolean(this.user && this.pass);
    },
  },
  upload: {
    maxSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB) || 5,
  },
  authRateLimit: {
    windowMinutes: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES) || 15,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) || 20,
  },
};
