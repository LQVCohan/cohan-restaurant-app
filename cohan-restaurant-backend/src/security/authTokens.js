import crypto from "crypto";
import jwt from "jsonwebtoken";
import process from "process";
import { RefreshToken, User } from "../../models/index.js";

export const REFRESH_TOKEN_INVALID_MESSAGE = "Authentication failed";

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/i;
const DURATION_FACTORS_MS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };

export function parseDurationMs(value, fallback = null) {
  const raw = String(value ?? fallback ?? "").trim();
  const match = raw.match(DURATION_PATTERN);
  if (!match) throw new Error(`Invalid duration: ${raw || "<empty>"}`);
  const amount = Number(match[1]);
  const unit = String(match[2]).toLowerCase();
  const ttlMs = amount * DURATION_FACTORS_MS[unit];
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error(`Invalid duration: ${raw || "<empty>"}`);
  }
  return ttlMs;
}

export function getRefreshTokenTtlMs() {
  return parseDurationMs(process.env.REFRESH_TOKEN_EXPIRES_IN, "7d");
}

export function getRefreshCookieMaxAgeSeconds() {
  return Math.floor(getRefreshTokenTtlMs() / 1000);
}

export function signAccessToken(user) {
  return jwt.sign(
    { id: String(user._id), email: user.email, role: String(user.roleName || "").toLowerCase() },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m",
      issuer: process.env.JWT_ISSUER || "foodhub-system",
    },
  );
}

export function refreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    path: "/api/auth",
    httpOnly: true,
    secure: isProduction,
    sameSite: String(process.env.REFRESH_TOKEN_COOKIE_SAMESITE || "lax").toLowerCase(),
    maxAge: getRefreshCookieMaxAgeSeconds(),
  };
}

export function clearRefreshCookie(reply) {
  reply.clearCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token", {
    ...refreshCookieOptions(),
    maxAge: 0,
  });
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

export async function issueRefreshToken({ userId, reply, userAgent, ip }) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs());
  await RefreshToken.create({ userId, tokenHash, expiresAt, userAgent: userAgent || null, ip: ip || null });
  reply.setCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token", raw, refreshCookieOptions());
  return { raw, tokenHash };
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
  const issued = await issueRefreshToken({ userId: existing.userId, reply, userAgent, ip });
  existing.revokedAt = new Date();
  existing.replacedByTokenHash = issued.tokenHash;
  await existing.save();
  const roleName = (user.role?.slug || user.role?.name || "").toLowerCase();
  return { token: signAccessToken({ ...user, roleName }), user: { ...user, roleName } };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeRefreshTokenFamilyFromHash(tokenHash) {
  const visited = new Set();
  let currentHash = tokenHash;
  while (currentHash && !visited.has(currentHash)) {
    visited.add(currentHash);
    const node = await RefreshToken.findOne({ tokenHash: currentHash });
    if (!node) break;
    if (!node.revokedAt) {
      node.revokedAt = new Date();
      await node.save();
    }
    currentHash = node.replacedByTokenHash || null;
  }
}

export async function handleRefreshTokenReuse(existing, logger = console) {
  if (!existing?.revokedAt) return;
  logger.warn?.(
    {
      userId: String(existing.userId || ""),
      tokenHashPrefix: String(existing.tokenHash || "").slice(0, 12),
      replacedTokenHashPrefix: String(existing.replacedByTokenHash || "").slice(0, 12),
    },
    "Refresh token reuse detected; revoking token family",
  );
  if (existing.replacedByTokenHash) {
    await revokeRefreshTokenFamilyFromHash(existing.replacedByTokenHash);
  }
}
