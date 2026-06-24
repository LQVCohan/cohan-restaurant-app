import { randomBytes, createHash } from "node:crypto";
import process from "process";
import { GraphQLError } from "graphql";
import { User } from "../../../models/index.js";
import { mailer, buildVerifyMail } from "../../../lib/mailer.js";
import { sendSms, buildVerificationSms } from "../notifications/sms.service.js";
import { logEvent } from "../eventLog.service.js";
import { issueRefreshToken, signAccessToken } from "../../security/authTokens.js";
import { sanitizeUserForClient } from "../../security/sanitizeUserForClient.js";

const CHANNEL_EMAIL = "email";
const CHANNEL_SMS = "sms";
const STATUS = {
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  COOLDOWN: "COOLDOWN",
  ALREADY_VERIFIED: "ALREADY_VERIFIED",
  VERIFIED: "VERIFIED",
};

function boolEnv(name, fallback = false) {
  return String(process.env[name] ?? String(fallback)).toLowerCase() === "true";
}

function ttlMs() {
  return Math.max(1, Number(process.env.VERIFICATION_TOKEN_TTL_HOURS || 24)) * 3600 * 1000;
}

function cooldownMs() {
  return Math.max(0, Number(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS || 60)) * 1000;
}

function appPublicUrl() {
  return String(process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

function hashToken(token) {
  const pepper = process.env.VERIFICATION_TOKEN_PEPPER || "";
  return createHash("sha256").update(`${token}${pepper}`).digest("hex");
}

function generateToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

function actorId(requestedBy, ctx) {
  return requestedBy?._id || requestedBy?.id || ctx?.user?._id || ctx?.user?.id || null;
}

function normalizeChannel(channel) {
  const c = String(channel || "AUTO").trim().toLowerCase();
  if (c === "email") return [CHANNEL_EMAIL];
  if (c === "sms" || c === "phone") return [CHANNEL_SMS];
  if (c === "both") return [CHANNEL_EMAIL, CHANNEL_SMS];
  return null;
}

function defaultChannels() {
  const configured = String(process.env.DEFAULT_VERIFICATION_CHANNELS || "email")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => [CHANNEL_EMAIL, CHANNEL_SMS].includes(item));
  return configured.length ? configured : [CHANNEL_EMAIL];
}

export function resolveVerificationChannels(user, channel = "AUTO") {
  const explicit = normalizeChannel(channel);
  if (explicit) return explicit;
  const preferred = defaultChannels();
  const result = [];
  for (const item of preferred) {
    if (item === CHANNEL_EMAIL && user?.email) result.push(CHANNEL_EMAIL);
    if (item === CHANNEL_SMS && user?.phone) result.push(CHANNEL_SMS);
  }
  if (!result.length && user?.email) result.push(CHANNEL_EMAIL);
  if (!result.length && user?.phone) result.push(CHANNEL_SMS);
  return [...new Set(result)];
}

function buildEmailLink(token) {
  return `${appPublicUrl()}/verify-email/confirm?token=${encodeURIComponent(token)}`;
}

function buildPhoneLink(token) {
  return `${appPublicUrl()}/verify-phone/confirm?token=${encodeURIComponent(token)}`;
}

function deliveryBase(channel) {
  return {
    channel,
    attempted: false,
    sent: false,
    skipped: false,
    status: STATUS.SKIPPED,
    provider: null,
    messageId: null,
    error: null,
    lastSentAt: null,
    cooldownUntil: null,
  };
}

function trimDetail(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeError(error) {
  const parts = [
    error?.code && `code=${error.code}`,
    error?.command && `command=${error.command}`,
    error?.responseCode && `responseCode=${error.responseCode}`,
    error?.response && `response=${error.response}`,
    error?.message && `message=${error.message}`,
    error?.extensions?.code && `extensionCode=${error.extensions.code}`,
  ].filter(Boolean);

  return trimDetail(parts.join("; ") || "DELIVERY_FAILED");
}

export function canResendVerification({ user, channel }) {
  const field = channel === CHANNEL_EMAIL ? "emailVerifyLastSentAt" : "phoneVerifyLastSentAt";
  const last = user?.[field] ? new Date(user[field]).getTime() : 0;
  const now = Date.now();
  if (last && now - last < cooldownMs()) {
    return { ok: false, cooldownUntil: new Date(last + cooldownMs()) };
  }
  return { ok: true, cooldownUntil: null };
}

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

async function buildAuthPayloadForVerifiedUser(userId, ctx = null) {
  const userObj = await User.findById(userId).populate("role").lean({ virtuals: true });
  if (!userObj) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });

  const roleName = (userObj?.role?.slug || userObj?.role?.name || "").toLowerCase();
  const token = signAccessToken({ ...userObj, roleName });

  if (ctx?.reply) {
    await issueRefreshToken({
      userId: userObj._id,
      reply: ctx.reply,
      userAgent: ctx?.request?.headers?.["user-agent"],
      ip: ctx?.request?.ip,
      persistent: true,
    });
  }

  return { token, user: sanitizeUserForClient({ ...userObj, roleName }) };
}

async function writeVerificationAudit({ ctx, user, verb, status, channels, reason, result, error }) {
  await logEvent({
    ctx,
    restaurantId: user?.restaurantForStaff || user?.refRestaurants?.[0] || null,
    actorUserId: actorId(null, ctx),
    verb,
    object: { kind: "User", id: user?._id || user?.id },
    source: "account-verification",
    status:
      status === STATUS.SENT ||
      status === STATUS.ALREADY_VERIFIED ||
      status === STATUS.VERIFIED
        ? "success"
        : "warning",
    meta: {
      targetUserId: String(user?._id || user?.id || ""),
      actorUserId: String(actorId(null, ctx) || ""),
      channels,
      status,
      reason,
      provider: result?.provider || null,
      sent: Boolean(result?.sent),
      skipped: Boolean(result?.skipped),
      error: error ? sanitizeError(error) : result?.error || null,
    },
  });
}

async function updateLastDispatch(userId, { channel, status, requestedBy, ctx, error }) {
  const now = new Date();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        verificationLastChannel: channel,
        verificationLastStatus: String(status || "").toLowerCase(),
        verificationLastError: error ? sanitizeError(error) : null,
        verificationLastRequestedBy: actorId(requestedBy, ctx),
        verificationLastRequestedAt: now,
      },
    },
  );
}

async function issueEmail({ user, requestedBy, reason, ctx, force }) {
  const result = deliveryBase(CHANNEL_EMAIL);
  if (!user?.email) {
    result.status = STATUS.FAILED;
    result.error = "USER_EMAIL_MISSING";
    return result;
  }
  if (user.emailVerified) {
    return { ...result, status: STATUS.ALREADY_VERIFIED, skipped: true };
  }
  if (!boolEnv("ENABLE_EMAIL_VERIFICATION", true)) {
    return { ...result, status: STATUS.SKIPPED, skipped: true, error: "EMAIL_VERIFICATION_DISABLED" };
  }
  const resend = canResendVerification({ user, channel: CHANNEL_EMAIL });
  if (!force && !resend.ok) {
    return { ...result, status: STATUS.COOLDOWN, skipped: true, cooldownUntil: resend.cooldownUntil };
  }

  const { token, hash } = generateToken();
  const exp = new Date(Date.now() + ttlMs());
  const sentAt = new Date();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerifyTokenHash: hash,
        emailVerifyTokenExp: exp,
        emailVerifyLastSentAt: sentAt,
        verificationLastRequestedBy: actorId(requestedBy, ctx),
        verificationLastRequestedAt: sentAt,
      },
      $unset: { emailVerifyToken: 1 },
    },
  );

  result.attempted = true;
  result.lastSentAt = sentAt;
  try {
    const mailResult = await mailer.sendMail(
      buildVerifyMail({
        to: user.email,
        link: buildEmailLink(token),
        user,
        reason,
        ttlHours: Math.round(ttlMs() / 3600000),
      }),
    );
    result.provider = mailResult?.skipped ? "smtp:not_configured" : "smtp";
    result.messageId = mailResult?.messageId || null;
    result.skipped = Boolean(mailResult?.skipped);
    result.sent = !mailResult?.skipped && !mailResult?.rejected?.length;
    result.status = result.sent ? STATUS.SENT : STATUS.NOT_CONFIGURED;
    if (!result.sent) result.error = mailResult?.error || "EMAIL_PROVIDER_NOT_CONFIGURED";
  } catch (err) {
    result.status = STATUS.FAILED;
    result.error = sanitizeError(err);
  }
  await writeVerificationAudit({ ctx, user, verb: reason === "resend" ? "account.verification.resend" : "account.verification.issue", status: result.status, channels: [CHANNEL_EMAIL], reason, result });
  return result;
}

async function issueSms({ user, requestedBy, reason, ctx, force }) {
  const result = deliveryBase(CHANNEL_SMS);
  if (!user?.phone) {
    result.status = STATUS.FAILED;
    result.error = "USER_PHONE_MISSING";
    return result;
  }
  if (user.phoneVerified) {
    return { ...result, status: STATUS.ALREADY_VERIFIED, skipped: true };
  }
  if (!boolEnv("ENABLE_PHONE_VERIFICATION", false) || !boolEnv("ENABLE_SMS_VERIFICATION", false)) {
    return { ...result, status: STATUS.SKIPPED, skipped: true, error: "SMS_VERIFICATION_DISABLED" };
  }
  const resend = canResendVerification({ user, channel: CHANNEL_SMS });
  if (!force && !resend.ok) {
    return { ...result, status: STATUS.COOLDOWN, skipped: true, cooldownUntil: resend.cooldownUntil };
  }

  const { token, hash } = generateToken();
  const exp = new Date(Date.now() + ttlMs());
  const sentAt = new Date();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        phoneVerifyTokenHash: hash,
        phoneVerifyTokenExp: exp,
        phoneVerifyLastSentAt: sentAt,
        verificationLastRequestedBy: actorId(requestedBy, ctx),
        verificationLastRequestedAt: sentAt,
      },
      $unset: { phoneVerifyToken: 1 },
    },
  );

  result.attempted = true;
  result.lastSentAt = sentAt;
  try {
    const smsResult = await sendSms({ to: user.phone, text: buildVerificationSms({ link: buildPhoneLink(token) }) });
    result.provider = smsResult?.provider || null;
    result.messageId = smsResult?.messageId || null;
    result.skipped = Boolean(smsResult?.skipped);
    result.sent = Boolean(smsResult?.sent);
    result.status = result.sent ? STATUS.SENT : STATUS.NOT_CONFIGURED;
    if (!result.sent) result.error = smsResult?.error || "SMS_PROVIDER_NOT_CONFIGURED";
  } catch (err) {
    result.status = STATUS.FAILED;
    result.error = sanitizeError(err);
  }
  await writeVerificationAudit({ ctx, user, verb: reason === "resend" ? "account.verification.resend" : "account.verification.issue", status: result.status, channels: [CHANNEL_SMS], reason, result });
  return result;
}

function aggregateStatus(results) {
  const list = Object.values(results).filter(Boolean);
  if (list.some((r) => r.status === STATUS.SENT)) return STATUS.SENT;
  if (list.some((r) => r.status === STATUS.COOLDOWN)) return STATUS.COOLDOWN;
  if (list.length && list.every((r) => r.status === STATUS.ALREADY_VERIFIED)) return STATUS.ALREADY_VERIFIED;
  if (list.some((r) => r.status === STATUS.NOT_CONFIGURED)) return STATUS.NOT_CONFIGURED;
  if (list.some((r) => r.status === STATUS.FAILED)) return STATUS.FAILED;
  return STATUS.SKIPPED;
}

export async function issueVerificationForUser({ user, channels = "AUTO", requestedBy = null, reason = "issue", ctx = null, force = false } = {}) {
  if (!user?._id && !user?.id) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });
  const fresh = await User.findById(user._id || user.id);
  if (!fresh) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });
  const resolvedChannels = resolveVerificationChannels(fresh, channels);
  const results = {};
  if (resolvedChannels.includes(CHANNEL_EMAIL)) results.email = await issueEmail({ user: fresh, requestedBy, reason, ctx, force });
  if (resolvedChannels.includes(CHANNEL_SMS)) results.sms = await issueSms({ user: fresh, requestedBy, reason, ctx, force });
  const status = aggregateStatus(results);
  await updateLastDispatch(fresh._id, {
    channel: resolvedChannels.length > 1 ? "both" : resolvedChannels[0] || "none",
    status,
    requestedBy,
    ctx,
    error: Object.values(results).find((r) => r?.error)?.error,
  });
  return {
    ok: dispatchOk(status, results),
    userId: String(fresh._id),
    channels: resolvedChannels,
    status,
    message: statusMessage(status, results),
    email: results.email || null,
    sms: results.sms || null,
    errors: Object.values(results).map((r) => r?.error).filter(Boolean),
  };
}

function dispatchOk(status, results = {}) {
  if ([STATUS.SENT, STATUS.ALREADY_VERIFIED].includes(status)) return true;
  if (status !== STATUS.SKIPPED) return false;
  const errors = Object.values(results).map((r) => String(r?.error || "")).filter(Boolean);
  return errors.length > 0 && errors.every((error) => error.endsWith("_DISABLED"));
}

function statusMessage(status, results = {}) {
  if (status === STATUS.SENT) return "Đã gửi xác nhận.";
  if (status === STATUS.ALREADY_VERIFIED) return "Tài khoản đã được xác minh, không cần gửi lại.";
  if (status === STATUS.COOLDOWN) return "Vui lòng chờ trước khi gửi lại xác nhận.";
  if (status === STATUS.NOT_CONFIGURED) return "Provider email/SMS chưa được cấu hình.";
  if (status === STATUS.SKIPPED) return "Kênh xác minh đang tắt hoặc bị bỏ qua.";
  return Object.values(results).find((r) => r?.error)?.error || "Không thể gửi xác nhận.";
}

export async function resendAccountVerification({ userId, channel = "AUTO", requestedBy = null, ctx = null }) {
  const user = await User.findById(userId);
  if (!user) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });
  return issueVerificationForUser({ user, channels: channel, requestedBy, reason: "resend", ctx });
}

async function verifyToken({ token, channel, returnUser = false }) {
  if (!token) throw new GraphQLError("Missing verification token.", { extensions: { code: "BAD_USER_INPUT" } });
  const tokenHash = hashToken(token);
  const isEmail = channel === CHANNEL_EMAIL;
  const expField = isEmail ? "emailVerifyTokenExp" : "phoneVerifyTokenExp";
  const hashField = isEmail ? "emailVerifyTokenHash" : "phoneVerifyTokenHash";
  const rawField = isEmail ? "emailVerifyToken" : "phoneVerifyToken";
  const verifiedField = isEmail ? "emailVerified" : "phoneVerified";
  const verifiedAtField = isEmail ? "emailVerifiedAt" : "phoneVerifiedAt";
  const user = await User.findOne({
    [expField]: { $gt: new Date() },
    $or: [{ [hashField]: tokenHash }, { [rawField]: token }],
  });
  if (!user) throw new GraphQLError("Invalid or expired verification link.", { extensions: { code: "BAD_USER_INPUT" } });
  const now = new Date();
  user[verifiedField] = true;
  user[verifiedAtField] = now;
  user[hashField] = null;
  user[rawField] = null;
  user[expField] = null;
  if (activationSatisfied(user)) {
    user.verifiedAt = user.verifiedAt || now;
    if (user.status === "pending") user.status = "active";
  }
  user.verificationLastChannel = channel;
  user.verificationLastStatus = "verified";
  user.verificationLastError = null;
  await user.save();
  await writeVerificationAudit({ ctx: null, user, verb: isEmail ? "account.verification.email_verified" : "account.verification.phone_verified", status: STATUS.VERIFIED, channels: [channel], reason: "verify", result: { sent: true } });
  return returnUser ? user : true;
}

export function verifyEmailToken(token) {
  return verifyToken({ token, channel: CHANNEL_EMAIL });
}

export function verifyPhoneToken(token) {
  return verifyToken({ token, channel: CHANNEL_SMS });
}

export function verifyAnyToken({ token, channel }) {
  const c = String(channel || "").toLowerCase();
  if (c === "email") return verifyEmailToken(token);
  if (c === "sms" || c === "phone") return verifyPhoneToken(token);
  throw new GraphQLError("Unsupported verification channel.", { extensions: { code: "BAD_USER_INPUT" } });
}

export async function verifyAnyTokenAndIssueAuth({ token, channel, ctx }) {
  const c = String(channel || "").toLowerCase();
  if (!["email", "sms", "phone"].includes(c)) {
    throw new GraphQLError("Unsupported verification channel.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const normalizedChannel = c === "phone" ? CHANNEL_SMS : c;
  const verifiedUser = await verifyToken({ token, channel: normalizedChannel, returnUser: true });
  return buildAuthPayloadForVerifiedUser(verifiedUser._id, ctx);
}

export default {
  issueVerificationForUser,
  verifyEmailToken,
  verifyPhoneToken,
  verifyAnyToken,
  verifyAnyTokenAndIssueAuth,
  resendAccountVerification,
  canResendVerification,
};
