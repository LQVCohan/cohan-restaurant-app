import crypto from "crypto";
import jwt from "jsonwebtoken";
import process from "process";
import { RefreshToken, User } from "../../models/index.js";
import { sanitizeUserForClient } from "./sanitizeUserForClient.js";
import { parseDurationMs } from "../utils/duration.js";

export { parseDurationMs };

export const REFRESH_TOKEN_INVALID_MESSAGE = "Authentication failed";

const REFRESH_COOKIE_SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);
const DEFAULT_REFRESH_REUSE_GRACE_MS = 5000;
const MAX_REFRESH_REUSE_GRACE_MS = 30000;

export function getRefreshTokenTtlMs({ persistent = true } = {}) {
  return parseDurationMs(
    persistent
      ? process.env.REFRESH_TOKEN_EXPIRES_IN
      : process.env.SESSION_REFRESH_TOKEN_EXPIRES_IN,
    persistent ? "30d" : "12h",
  );
}

export function getRefreshCookieMaxAgeSeconds(options = {}) {
  return Math.floor(getRefreshTokenTtlMs(options) / 1000);
}

export function getRefreshTokenReuseGraceMs() {
  const configured = Number(
    process.env.REFRESH_TOKEN_REUSE_GRACE_MS ?? DEFAULT_REFRESH_REUSE_GRACE_MS,
  );
  if (!Number.isFinite(configured) || configured < 0) {
    return DEFAULT_REFRESH_REUSE_GRACE_MS;
  }
  return Math.min(Math.floor(configured), MAX_REFRESH_REUSE_GRACE_MS);
}

export function isRefreshTokenWithinReuseGrace(existing, nowMs = Date.now()) {
  const revokedAtMs = existing?.revokedAt
    ? new Date(existing.revokedAt).getTime()
    : Number.NaN;
  if (!Number.isFinite(revokedAtMs)) return false;

  const ageMs = nowMs - revokedAtMs;
  return ageMs >= 0 && ageMs <= getRefreshTokenReuseGraceMs();
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

export function signAccessToken(user) {
  return jwt.sign(
    { id: String(user._id), email: user.email, role: String(user.roleName || "").toLowerCase() },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m",
      issuer: process.env.JWT_ISSUER || "cohan-system",
    },
  );
}

export function isRefreshTokenRotationEnabled() {
  if (process.env.NODE_ENV === "production") return true;
  return String(process.env.AUTH_REFRESH_TOKEN_ROTATION_ENABLED ?? "true").toLowerCase() !== "false";
}

function getRefreshCookieSameSite() {
  const fallback = process.env.NODE_ENV === "production" ? "none" : "lax";
  const configured = String(
    process.env.REFRESH_TOKEN_COOKIE_SAMESITE || fallback,
  )
    .trim()
    .toLowerCase();
  return REFRESH_COOKIE_SAME_SITE_VALUES.has(configured) ? configured : fallback;
}

export function refreshCookieOptions({ persistent = true } = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = getRefreshCookieSameSite();
  const options = {
    path: "/api/auth",
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
  };

  if (persistent) {
    options.maxAge = getRefreshCookieMaxAgeSeconds({ persistent });
  }

  return options;
}

export function clearRefreshCookie(reply) {
  reply.clearCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token", {
    ...refreshCookieOptions(),
    maxAge: 0,
  });
}

export async function issueRefreshToken({ userId, reply, userAgent, ip, persistent = true }) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashRefreshToken(raw);
  const isPersistent = persistent !== false;
  const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs({ persistent: isPersistent }));
  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    persistent: isPersistent,
    userAgent: userAgent || null,
    ip: ip || null,
  });
  reply.setCookie(
    process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token",
    raw,
    refreshCookieOptions({ persistent: isPersistent }),
  );
  return { raw, tokenHash };
}

export async function revokeRefreshTokenFamilyFromHash(tokenHash) {
  let currentHash = tokenHash;
  const visited = new Set();
  while (currentHash && !visited.has(currentHash)) {
    visited.add(currentHash);
    const token = await RefreshToken.findOne({ tokenHash: currentHash });
    if (!token) break;
    if (!token.revokedAt) {
      token.revokedAt = new Date();
      await token.save();
    }
    currentHash = token.replacedByTokenHash || null;
  }
}

export async function handleRefreshTokenReuse(existing, logger) {
  const tokenHashPrefix = String(existing?.tokenHash || "").slice(0, 12);
  const replacedByTokenHashPrefix = String(existing?.replacedByTokenHash || "").slice(0, 12);
  logger?.warn?.(
    {
      userId: existing?.userId ? String(existing.userId) : null,
      tokenHashPrefix,
      replacedByTokenHashPrefix,
    },
    "refresh token reuse detected; revoking token family",
  );
  await revokeRefreshTokenFamilyFromHash(existing?.replacedByTokenHash || null);
}

async function buildActiveRefreshPayload(userId) {
  const user = await User.findById(userId).populate("role").lean({ virtuals: true });
  if (!user || user.status !== "active") return null;

  const roleName = (user.role?.slug || user.role?.name || "").toLowerCase();
  return {
    token: signAccessToken({ ...user, roleName }),
    user: sanitizeUserForClient({ ...user, roleName }),
  };
}

async function recoverRecentRefreshCollision(existing, logger) {
  const payload = await buildActiveRefreshPayload(existing?.userId);
  if (!payload) return null;

  logger?.debug?.(
    {
      userId: existing?.userId ? String(existing.userId) : null,
      rotationAgeMs: Math.max(0, Date.now() - new Date(existing.revokedAt).getTime()),
    },
    "concurrent refresh rotation detected; preserving the active session",
  );
  return payload;
}

export async function rotateRefreshToken({ currentRawToken, reply, userAgent, ip, logger }) {
  const currentHash = hashRefreshToken(currentRawToken);
  const existing = await RefreshToken.findOne({ tokenHash: currentHash });
  if (!existing) return null;
  if (existing.revokedAt) {
    if (isRefreshTokenWithinReuseGrace(existing)) {
      return recoverRecentRefreshCollision(existing, logger);
    }
    await handleRefreshTokenReuse(existing, logger);
    return null;
  }
  if (existing.expiresAt.getTime() <= Date.now()) return null;

  if (!isRefreshTokenRotationEnabled()) {
    return buildActiveRefreshPayload(existing.userId);
  }

  const claimedAt = new Date();
  const claimed = await RefreshToken.findOneAndUpdate(
    {
      tokenHash: currentHash,
      revokedAt: null,
      expiresAt: { $gt: claimedAt },
    },
    { $set: { revokedAt: claimedAt } },
    { new: true },
  );

  if (!claimed) {
    const latest = await RefreshToken.findOne({ tokenHash: currentHash });
    if (latest?.revokedAt && isRefreshTokenWithinReuseGrace(latest)) {
      return recoverRecentRefreshCollision(latest, logger);
    }
    if (latest?.revokedAt) {
      await handleRefreshTokenReuse(latest, logger);
    }
    return null;
  }

  const payload = await buildActiveRefreshPayload(claimed.userId);
  if (!payload) return null;

  const persistent = claimed.persistent !== false;
  const issued = await issueRefreshToken({
    userId: claimed.userId,
    reply,
    userAgent,
    ip,
    persistent,
  });
  claimed.replacedByTokenHash = issued.tokenHash;
  await claimed.save();
  return payload;
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
