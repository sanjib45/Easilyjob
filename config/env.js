import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

let sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  if (isProd) {
    throw new Error(
      "SESSION_SECRET is required in production. Set it in your environment or .env file."
    );
  }
  // Dev-only fallback so the app still boots locally without a .env file.
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "⚠️  SESSION_SECRET not set. Using a random secret for this run only " +
      "(sessions will not survive a restart). Set SESSION_SECRET in .env before deploying."
  );
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 3000,
  sessionSecret,
  forceSecureCookies: process.env.FORCE_SECURE_COOKIES === "true",
  email: {
    service: process.env.EMAIL_SERVICE || "",
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
