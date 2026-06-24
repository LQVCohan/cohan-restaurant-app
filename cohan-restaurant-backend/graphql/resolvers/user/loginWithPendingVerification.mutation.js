import { GraphQLError } from "graphql";
import {
  User,
} from "../../../models/index.js";
import { verifyRecaptcha } from "../../../lib/recaptcha.js";
import {
  getLoginAttemptState,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  logAuthAuditEvent,
} from "../../../src/security/loginSecurity.js";
import { issueRefreshToken, signAccessToken } from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";

const normalizePhone = (p) =>
  p ? p.replace(/\s+/g, "").replace(/^\+84/, "0") : p;

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ZERO_WIDTH_CHARS = "​‌‍﻿";
const ZERO_WIDTH_OR_WS_CLASS = `[\\s${ZERO_WIDTH_CHARS}]`;

const buildTrimmedExactRegex = (value = "") =>
  new RegExp(
    `^${ZERO_WIDTH_OR_WS_CLASS}*${escapeRegex(value)}${ZERO_WIDTH_OR_WS_CLASS}*$`,
    "i",
  );

const buildNormalizedFieldExpr = (field) => ({
  $toLower: {
    $trim: {
      input: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: { $ifNull: [field, ""] },
                  find: "\u200B",
                  replacement: "",
                },
              },
              find: "\u200C",
              replacement: "",
            },
          },
          find: "\uFEFF",
          replacement: "",
        },
      },
    },
  },
});

function activationSatisfied(user) {
  const policy = String(process.env.ACCOUNT_ACTIVATION_REQUIRE || "email").toLowerCase();
  const hasEmail = Boolean(user?.email);
  const hasPhone = Boolean(user?.phone);
  const emailOk = Boolean(user?.emailVerified);
  const phoneOk = Boolean(user?.phoneVerified);

  if (policy === "both") return (!hasEmail || emailOk) && (!hasPhone || phoneOk);
  if (policy === "phone") return phoneOk || (!hasPhone && emailOk);
  if (policy === "any") return emailOk || phoneOk;
  if (!hasEmail && hasPhone) return phoneOk;
  return emailOk;
}

function isPendingVerificationAccount(user) {
  return String(user?.status || "").toLowerCase() === "pending" && !activationSatisfied(user);
}

async function buildAuthPayloadForLogin(userId) {
  const userObj = await User.findById(userId)
    .populate("role")
    .lean({ virtuals: true });

  const roleName = (userObj?.role?.slug || userObj?.role?.name || "").toLowerCase();
  const token = signAccessToken({ ...userObj, roleName });

  return { token, user: sanitizeUserForClient({ ...userObj, roleName }) };
}

export async function loginWithPendingVerification(
  _,
  { email, username, phone, password, captchaToken },
  ctx,
) {
  if (!password) {
    throw new GraphQLError("Missing required field: password", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const recaptchaEnabled =
    String(process.env.ENABLE_RECAPTCHA ?? "true").toLowerCase() === "true";
  if (recaptchaEnabled) {
    const recaptcha = await verifyRecaptcha(captchaToken, ctx);
    if (!recaptcha.ok) {
      throw new GraphQLError(
        recaptcha.reason || "reCAPTCHA verification failed",
        { extensions: { code: "BAD_USER_INPUT" } },
      );
    }
  }

  const normalizedEmail = email?.toLowerCase().trim();
  const normalizedUsername = username?.trim().toLowerCase();
  const normalizedPhone = phone ? normalizePhone(phone.trim()) : null;
  const loginIdentifier = normalizedUsername
    ? "username"
    : normalizedEmail
      ? "email"
      : normalizedPhone
        ? "phone"
        : "username";

  const baseLookupOr = [
    ...(normalizedEmail
      ? [
          { email: normalizedEmail },
          { email: { $regex: buildTrimmedExactRegex(normalizedEmail) } },
        ]
      : []),
    ...(normalizedUsername
      ? [
          { username: normalizedUsername },
          { username: { $regex: buildTrimmedExactRegex(normalizedUsername) } },
        ]
      : []),
    ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
  ];

  if (baseLookupOr.length === 0) {
    throw new GraphQLError(
      "Missing login identifier: provide email, username, or phone",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  const requestIp =
    ctx?.request?.ip ||
    ctx?.request?.headers?.["x-forwarded-for"] ||
    "unknown";

  const identifierForThrottle =
    normalizedEmail || normalizedUsername || normalizedPhone || "unknown";

  const throttle = getLoginAttemptState({
    identifier: identifierForThrottle,
    ip: requestIp,
  });

  if (throttle.blocked) {
    logAuthAuditEvent(ctx, "login_rate_limited", {
      ip: requestIp,
      identifierType: loginIdentifier,
      retryAfterMs: throttle.retryAfterMs,
    });
    throw new GraphQLError("Too many failed attempts. Please try again later.", {
      extensions: { code: "TOO_MANY_REQUESTS" },
    });
  }

  let user = await User.findOne({ $or: baseLookupOr }).populate("role");

  if (!user) {
    const normalizedLookupOr = [
      ...(normalizedEmail
        ? [
            {
              $expr: {
                $eq: [buildNormalizedFieldExpr("$email"), normalizedEmail],
              },
            },
          ]
        : []),
      ...(normalizedUsername
        ? [
            {
              $expr: {
                $eq: [buildNormalizedFieldExpr("$username"), normalizedUsername],
              },
            },
          ]
        : []),
    ];

    if (normalizedLookupOr.length > 0) {
      user = await User.findOne({ $or: normalizedLookupOr }).populate("role");
    }
  }

  const failLogin = async (
    reason = "invalid_credentials",
    code = "UNAUTHENTICATED",
    message = "Invalid credentials",
  ) => {
    const nextState = recordFailedLoginAttempt({
      identifier: identifierForThrottle,
      ip: requestIp,
    });

    logAuthAuditEvent(ctx, "login_failed", {
      ip: requestIp,
      identifierType: loginIdentifier,
      reason,
      attempts: nextState.attempts,
    });

    const delayMs = Math.min(1500, 200 + nextState.attempts * 150);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    throw new GraphQLError(message, { extensions: { code } });
  };

  if (!user) await failLogin();
  if (!user.passwordHash) await failLogin("password_login_not_supported");

  const ok = user.checkPassword ? await user.checkPassword(password) : false;
  if (!ok) await failLogin();

  const status = String(user.status || "").toLowerCase();
  if (status !== "active" && !isPendingVerificationAccount(user)) {
    logAuthAuditEvent(ctx, "login_blocked_status", {
      ip: requestIp,
      identifierType: loginIdentifier,
      userId: String(user._id),
      status: user.status,
    });
    throw new GraphQLError("Login is not available for this account", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  resetLoginAttempts({ identifier: identifierForThrottle, ip: requestIp });

  const payload = await buildAuthPayloadForLogin(user._id);
  const roleName = payload.user?.roleName || "";

  logAuthAuditEvent(ctx, status === "pending" ? "login_pending_verification" : "login_success", {
    ip: requestIp,
    identifierType: loginIdentifier,
    userId: String(user._id),
    roleName,
    status,
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
