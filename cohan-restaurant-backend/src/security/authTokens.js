import crypto from "crypto";
import jwt from "jsonwebtoken";
import process from "process";
import { RefreshToken, User } from "../../models/index.js";
import { sanitizeUserForClient } from "./sanitizeUserForClient.js";
import { parseDurationMs } from "../utils/duration.js";

export { parseDurationMs };

export const REFRESH_TOKEN_INVALID_MESSAGE = "Authentication failed";

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

export function refreshCookieOptions({ persistent = true } = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    path: "/api/auth",
    httpOnly: true,
    secure: isProduction,
    sameSite: String(process.env.REFRESH_TOKEN_COOKIE_SAMESITE || "lax").toLowerCase(),
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

export async function rotateRefreshToken({ currentRawToken, reply, userAgent, ip, logger }) {
  const currentHash = hashRefreshToken(currentRawToken);
  const existing = await RefreshToken.findOne({ tokenHash: currentHash });
  if (!existing) return null;
  if (existing.revokedAt) {
    await handleRefreshTokenReuse(existing, logger);
    return null;
  }
  if (existing.expiresAt.getTime() <= Date.now()) return null;

  const user = await User.findById(existing.userId).populate("role").lean({ virtuals: true });
  if (!user || user.status !== "active") return null;

  const roleName = (user.role?.slug || user.role?.name || "").toLowerCase();
  const safeUser = sanitizeUserForClient({ ...user, roleName });

  if (!isRefreshTokenRotationEnabled()) {
    logger?.debug?.(
      { userId: String(existing.userId) },
      "refresh token rotation disabled for non-production environment",
    );
    return { token: signAccessToken({ ...user, roleName }), user: safeUser };
  }

  const persistent = existing.persistent !== false;
  const issued = await issueRefreshToken({ userId: existing.userId, reply, userAgent, ip, persistent });
  existing.revokedAt = new Date();
  existing.replacedByTokenHash = issued.tokenHash;
  await existing.save();
  return { token: signAccessToken({ ...user, roleName }), user: safeUser };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
