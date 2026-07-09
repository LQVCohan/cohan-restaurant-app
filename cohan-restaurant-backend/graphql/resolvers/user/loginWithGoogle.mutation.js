import { Buffer } from "node:buffer";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { GraphQLError } from "graphql";
import fetch from "node-fetch";
import { Customer, Role, User } from "../../../models/index.js";
import { issueRefreshToken, signAccessToken } from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";
import { logAuthAuditEvent } from "../../../src/security/loginSecurity.js";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const bad = (message) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (message) => new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });

let googleJwksCache = { keys: [], expiresAt: 0 };

function googleClientIds() {
  return String(
    process.env.GOOGLE_CLIENT_IDS ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      "",
  )
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function base64UrlToBuffer(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function decodeJwtPart(value) {
  try {
    return JSON.parse(base64UrlToBuffer(value).toString("utf8"));
  } catch {
    throw bad("Google token không hợp lệ.");
  }
}

async function fetchGoogleJwks() {
  if (googleJwksCache.keys.length && googleJwksCache.expiresAt > Date.now()) {
    return googleJwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) throw bad("Không thể xác thực Google token.");

  const payload = await response.json();
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  googleJwksCache = {
    keys: Array.isArray(payload?.keys) ? payload.keys : [],
    expiresAt: Date.now() + Math.max(60, maxAge) * 1000,
  };
  return googleJwksCache.keys;
}

async function verifyGoogleIdToken(idToken) {
  const clientIds = googleClientIds();
  if (!clientIds.length) {
    throw new GraphQLError("GOOGLE_CLIENT_ID is not configured", {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    });
  }

  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw bad("Google token không hợp lệ.");

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw bad("Google token không hợp lệ.");

  const keys = await fetchGoogleJwks();
  const jwk = keys.find((item) => item.kid === header.kid && item.kty === "RSA");
  if (!jwk) throw bad("Google token không hợp lệ.");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBuffer(parts[2]);
  const signatureOk = verifySignature("RSA-SHA256", signedContent, publicKey, signature);
  if (!signatureOk) throw bad("Google token không hợp lệ.");

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.some((item) => clientIds.includes(item))) throw bad("Google token không đúng ứng dụng.");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) throw bad("Google token không hợp lệ.");
  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) throw bad("Google token đã hết hạn.");
  if (!payload.sub || !payload.email) throw bad("Google token thiếu thông tin tài khoản.");
  if (!(payload.email_verified === true || payload.email_verified === "true")) {
    throw bad("Email Google chưa được xác minh.");
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    fullName: String(payload.name || payload.email).trim(),
    avatarUrl: payload.picture ? String(payload.picture) : null,
  };
}

async function buildAuthPayload(userId) {
  const userObj = await User.findById(userId).populate("role").lean({ virtuals: true });
  const roleName = (userObj?.role?.slug || userObj?.role?.name || "").toLowerCase();
  const token = signAccessToken({ ...userObj, roleName });
  return { token, user: sanitizeUserForClient({ ...userObj, roleName }) };
}

async function defaultCustomerRole() {
  return Role.findOne({ $or: [{ slug: "customer" }, { name: /^customer$/i }] })
    .select("_id")
    .lean();
}

async function findOrCreateGoogleUser(profile, ctx) {
  const now = new Date();
  let user = await User.findOne({ googleId: profile.googleId });

  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user?.googleId && user.googleId !== profile.googleId) {
      throw forbidden("Email này đã liên kết với một tài khoản Google khác.");
    }
  }

  if (!user) {
    const role = await defaultCustomerRole();
    user = new Customer({
      fullName: profile.fullName,
      email: profile.email,
      googleId: profile.googleId,
      provider: "google",
      status: "active",
      userType: "CUSTOMER",
      role: role?._id || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      emailVerified: true,
      emailVerifiedAt: now,
      verifiedAt: now,
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
    });
  } else {
    const status = String(user.status || "").toLowerCase();
    if (["blocked", "inactive"].includes(status)) {
      throw forbidden("Tài khoản hiện không thể đăng nhập.");
    }

    user.googleId = profile.googleId;
    user.provider = "google";
    user.fullName = user.fullName || profile.fullName;
    user.avatarUrl = user.avatarUrl || profile.avatarUrl || undefined;
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || now;
    user.verifiedAt = user.verifiedAt || now;
    if (status === "pending") user.status = "active";
  }

  user.lastLoginAt = now;
  user.lastLoginIp = ctx?.request?.ip || ctx?.request?.headers?.["x-forwarded-for"] || undefined;
  await user.save();
  return user;
}

export async function loginWithGoogle(_, { idToken, credential }, ctx) {
  const profile = await verifyGoogleIdToken(idToken || credential);
  const user = await findOrCreateGoogleUser(profile, ctx);
  const payload = await buildAuthPayload(user._id);
  const requestIp = ctx?.request?.ip || ctx?.request?.headers?.["x-forwarded-for"] || "unknown";

  logAuthAuditEvent(ctx, "google_login_success", {
    ip: requestIp,
    identifierType: "google",
    userId: String(user._id),
    roleName: payload.user?.roleName || "",
  });

  if (ctx?.reply) {
    await issueRefreshToken({
      userId: user._id,
      reply: ctx.reply,
      userAgent: ctx?.request?.headers?.["user-agent"],
      ip: ctx?.request?.ip,
    });
  }

  return payload;
}
