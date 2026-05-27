import crypto from "crypto";
import jwt from "jsonwebtoken";
import ms from "ms";
import process from "process";
import { RefreshToken, User } from "../../models/index.js";

export const REFRESH_TOKEN_INVALID_MESSAGE = "Authentication failed";

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
    maxAge: Math.floor(ms(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") / 1000),
  };
}

export function clearRefreshCookie(reply) {
  reply.clearCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token", {
    ...refreshCookieOptions(),
    maxAge: 0,
  });
}

export async function issueRefreshToken({ userId, reply, userAgent, ip }) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const refreshTtlMs = ms(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");
  const expiresAt = new Date(Date.now() + refreshTtlMs);
  await RefreshToken.create({ userId, tokenHash, expiresAt, userAgent: userAgent || null, ip: ip || null });
  reply.setCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token", raw, refreshCookieOptions());
  return { raw, tokenHash };
}

export async function rotateRefreshToken({ currentRawToken, reply, userAgent, ip }) {
  const currentHash = crypto.createHash("sha256").update(String(currentRawToken || "")).digest("hex");
  const existing = await RefreshToken.findOne({ tokenHash: currentHash });
  if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) return null;
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
  const tokenHash = crypto.createHash("sha256").update(String(rawToken)).digest("hex");
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
