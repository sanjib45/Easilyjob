import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const cookieBase = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProd || env.forceSecureCookies,
  path: "/",
});

export const cookieNames = { ACCESS_COOKIE, REFRESH_COOKIE };

export const toAuthUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  };
};

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      name: user.name,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.jwt.accessSecret);
  } catch {
    return null;
  }
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const createRefreshToken = async (userId, meta = {}) => {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + env.jwt.refreshDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent || null,
      ip: meta.ip || null,
    },
  });

  return { raw, expiresAt };
};

export const rotateRefreshToken = async (rawToken, meta = {}) => {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    if (existing?.revokedAt) await revokeAllUserRefreshTokens(existing.userId);
    return null;
  }

  const revoked = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count !== 1) return null;

  const next = await createRefreshToken(existing.userId, meta);
  return { user: existing.user, refresh: next };
};

export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const revokeAllUserRefreshTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const setAuthCookies = (res, accessToken, refreshRaw, refreshExpiresAt) => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshRaw, {
    ...cookieBase(),
    expires: refreshExpiresAt,
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, cookieBase());
  res.clearCookie(REFRESH_COOKIE, cookieBase());
};

export const issueAuthSession = async (res, user, meta = {}) => {
  const accessToken = signAccessToken(user);
  const refresh = await createRefreshToken(user.id, meta);
  setAuthCookies(res, accessToken, refresh.raw, refresh.expiresAt);
  return toAuthUser(user);
};
