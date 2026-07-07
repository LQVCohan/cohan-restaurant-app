import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Buffer } from "buffer";
import process from "process";
import { GraphQLError } from "graphql";
import { User } from "../../../models/index.js";
import { mailer, buildContactChangeOtpMail } from "../../../lib/mailer.js";
import { sendSms, buildContactChangeOtpSms } from "../notifications/sms.service.js";
import { logEvent } from "../eventLog.service.js";

const TARGET_EMAIL = "email";
const TARGET_PHONE = "phone";
const CONTACT_CHANGE_OTP_LENGTH = 6;
const DELIVERY_STATUS = {
  SENT: "SENT",
  FAILED: "FAILED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  COOLDOWN: "COOLDOWN",
};

function graphQLError(message, code) {
  return new GraphQLError(message, { extensions: { code } });
}

function otpLength() {
  return CONTACT_CHANGE_OTP_LENGTH;
}

function ttlMs() {
  return Math.max(1, Number(process.env.CONTACT_CHANGE_OTP_TTL_MINUTES || 10)) * 60 * 1000;
}

function ttlMinutes() {
  return Math.round(ttlMs() / 60000);
}

function cooldownMs() {
  return Math.max(0, Number(process.env.CONTACT_CHANGE_OTP_COOLDOWN_SECONDS || 60)) * 1000;
}

function maxAttempts() {
  return Math.max(1, Number(process.env.CONTACT_CHANGE_OTP_MAX_ATTEMPTS || 5));
}

function normalizeTarget(target) {
  const normalized = String(target || "").trim().toLowerCase();
  if ([TARGET_EMAIL, TARGET_PHONE].includes(normalized)) return normalized;
  if (normalized === "email") return TARGET_EMAIL;
  if (normalized === "phone") return TARGET_PHONE;
  throw graphQLError("Invalid contact change target.", "INVALID_CONTACT_TARGET");
}

function normalizePhone(value = "") {
  return String(value || "").trim().replace(/\s+/g, "").replace(/^\+84/, "0");
}

function normalizeValue(target, value) {
  const raw = String(value || "").trim();
  if (target === TARGET_EMAIL) {
    const email = raw.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw graphQLError("Invalid email.", "INVALID_EMAIL");
    }
    return email;
  }

  const phone = normalizePhone(raw);
  if (!phone || !/^(0|\+?84)(\d{9,10})$/.test(phone.replace(/\s+/g, ""))) {
    throw graphQLError("Invalid phone.", "INVALID_PHONE");
  }
  return phone;
}

function targetEnum(target) {
  return target === TARGET_EMAIL ? "EMAIL" : "PHONE";
}

function maskDestination(target, value = "") {
  const raw = String(value || "");
  if (target === TARGET_EMAIL) {
    const [local, domain] = raw.split("@");
    if (!domain) return "***";
    const prefix = local.slice(0, 1) || "*";
    return `${prefix}***@${domain}`;
  }
  if (raw.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

function createOtp() {
  const length = otpLength();
  const digits = [];
  for (let i = 0; i < length; i += 1) {
    digits.push(String(randomInt(0, 10)));
  }
  return digits.join("");
}

function hashOtp({ userId, target, value, otp }) {
  const pepper = process.env.CONTACT_CHANGE_OTP_PEPPER || process.env.VERIFICATION_TOKEN_PEPPER || "";
  return createHash("sha256")
    .update(`${userId}:${target}:${value}:${otp}:${pepper}`)
    .digest("hex");
}

function hashesMatch(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && timingSafeEqual(leftBuffer, rightBuffer);
}

function actorId(user, ctx) {
  return ctx?.user?._id || ctx?.user?.id || user?._id || user?.id || null;
}

function auditMeta({ user, target, value, status, provider, sent, skipped, error, attempts }) {
  return {
    userId: String(user?._id || user?.id || ""),
    target: targetEnum(target),
    maskedDestination: maskDestination(target, value),
    status,
    provider: provider || null,
    sent: Boolean(sent),
    skipped: Boolean(skipped),
    error: error || null,
    attempts: typeof attempts === "number" ? attempts : undefined,
  };
}

async function writeAudit({ ctx, user, verb, target, value, status = "success", delivery = {}, attempts }) {
  await logEvent({
    ctx,
    restaurantId: user?.restaurantForStaff || null,
    actorUserId: actorId(user, ctx),
    verb,
    object: { kind: "User", id: user?._id || user?.id },
    source: "account-security",
    status,
    meta: auditMeta({
      user,
      target,
      value,
      status: delivery?.status,
      provider: delivery?.provider,
      sent: delivery?.sent,
      skipped: delivery?.skipped,
      error: delivery?.error,
      attempts,
    }),
  });
}

function resultPayload({ ok, target, value, status, message, cooldownUntil = null }) {
  return {
    ok,
    target: targetEnum(target),
    maskedDestination: maskDestination(target, value),
    status,
    message,
    cooldownUntil,
  };
}

async function assertUniqueContact({ user, target, value }) {
  const duplicate = await User.findOne({ _id: { $ne: user._id || user.id }, [target]: value }).lean();
  if (duplicate) {
    throw graphQLError(
      target === TARGET_EMAIL ? "Email already in use." : "Phone already in use.",
      target === TARGET_EMAIL ? "EMAIL_ALREADY_IN_USE" : "PHONE_ALREADY_IN_USE",
    );
  }
}

function ensureAuthenticatedUser(user) {
  if (!user?._id && !user?.id) throw graphQLError("Authentication required.", "AUTH_REQUIRED");
}

function setContactChangeOtp(user, value) {
  if (typeof user?.set === "function") {
    user.set("contactChangeOtp", value);
  } else {
    user.contactChangeOtp = value;
  }
}

function deliveryMessage(delivery, target, value) {
  if (delivery.status === DELIVERY_STATUS.SENT) {
    return `Mã OTP đã được gửi đến ${maskDestination(target, value)}.`;
  }
  if (delivery.status === DELIVERY_STATUS.COOLDOWN) {
    return "Vui lòng chờ trước khi gửi lại mã.";
  }
  if (delivery.status === DELIVERY_STATUS.NOT_CONFIGURED) {
    return "Chưa cấu hình kênh gửi OTP. Vui lòng thử lại sau hoặc liên hệ quản trị viên.";
  }
  return "Không thể gửi mã OTP. Vui lòng thử lại sau.";
}

export async function requestContactChangeOtp({ user, target, value, ctx } = {}) {
  ensureAuthenticatedUser(user);
  const normalizedTarget = normalizeTarget(target);
  const normalizedValue = normalizeValue(normalizedTarget, value);
  const fresh = await User.findById(user._id || user.id);
  if (!fresh) throw graphQLError("User not found.", "USER_NOT_FOUND");

  const currentValue = normalizedTarget === TARGET_PHONE ? normalizePhone(fresh.phone || "") : String(fresh.email || "").toLowerCase();
  if (currentValue === normalizedValue) throw graphQLError("Contact value is unchanged.", "CONTACT_UNCHANGED");

  await assertUniqueContact({ user: fresh, target: normalizedTarget, value: normalizedValue });

  const lastSentAt = fresh.contactChangeOtp?.lastSentAt ? new Date(fresh.contactChangeOtp.lastSentAt).getTime() : 0;
  if (lastSentAt && Date.now() - lastSentAt < cooldownMs()) {
    const cooldownUntil = new Date(lastSentAt + cooldownMs());
    const delivery = { status: DELIVERY_STATUS.COOLDOWN, skipped: true };
    await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.cooldown", target: normalizedTarget, value: normalizedValue, status: "warning", delivery });
    return resultPayload({
      ok: false,
      target: normalizedTarget,
      value: normalizedValue,
      status: DELIVERY_STATUS.COOLDOWN,
      message: "Vui lòng chờ trước khi gửi lại mã OTP.",
      cooldownUntil,
    });
  }

  const otp = createOtp();
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + ttlMs());
  const pendingOtp = {
    target: normalizedTarget,
    value: normalizedValue,
    otpHash: hashOtp({ userId: fresh._id, target: normalizedTarget, value: normalizedValue, otp }),
    expiresAt,
    attempts: 0,
    lastSentAt: sentAt,
    requestedAt: sentAt,
  };

  const delivery = { status: DELIVERY_STATUS.FAILED, sent: false, skipped: false, provider: null, error: null };
  try {
    if (normalizedTarget === TARGET_EMAIL) {
      const mailResult = await mailer.sendMail(buildContactChangeOtpMail({
        to: normalizedValue,
        otp,
        user: fresh,
        target: normalizedTarget,
        ttlMinutes: ttlMinutes(),
      }));
      delivery.provider = mailResult?.skipped ? "smtp:not_configured" : "smtp";
      delivery.sent = !mailResult?.skipped && !mailResult?.rejected?.length;
      delivery.skipped = Boolean(mailResult?.skipped);
      delivery.status = delivery.sent ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.NOT_CONFIGURED;
      if (!delivery.sent) delivery.error = "CONTACT_CHANGE_PROVIDER_NOT_CONFIGURED";
    } else {
      const smsResult = await sendSms({ to: normalizedValue, text: buildContactChangeOtpSms({ otp, ttlMinutes: ttlMinutes() }) });
      delivery.provider = smsResult?.provider || null;
      delivery.sent = Boolean(smsResult?.sent);
      delivery.skipped = Boolean(smsResult?.skipped);
      delivery.status = delivery.sent ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.NOT_CONFIGURED;
      if (!delivery.sent) delivery.error = smsResult?.error || "CONTACT_CHANGE_PROVIDER_NOT_CONFIGURED";
    }
  } catch (err) {
    delivery.status = DELIVERY_STATUS.FAILED;
    delivery.error = err?.extensions?.code || err?.code || err?.message || "CONTACT_CHANGE_DELIVERY_FAILED";
  }

  if (delivery.status === DELIVERY_STATUS.SENT) {
    setContactChangeOtp(fresh, pendingOtp);
  } else {
    setContactChangeOtp(fresh, undefined);
  }
  await fresh.save();

  await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.request", target: normalizedTarget, value: normalizedValue, status: delivery.status === DELIVERY_STATUS.SENT ? "success" : "warning", delivery });

  return resultPayload({
    ok: delivery.status === DELIVERY_STATUS.SENT,
    target: normalizedTarget,
    value: normalizedValue,
    status: delivery.status,
    message: deliveryMessage(delivery, normalizedTarget, normalizedValue),
  });
}

export async function confirmContactChangeOtp({ user, target, otp, ctx } = {}) {
  ensureAuthenticatedUser(user);
  const normalizedTarget = normalizeTarget(target);
  const normalizedOtp = String(otp || "").trim();
  if (!new RegExp(`^\\d{${otpLength()}}$`).test(normalizedOtp)) {
    throw graphQLError("Invalid OTP.", "INVALID_OTP");
  }

  const fresh = await User.findById(user._id || user.id);
  if (!fresh) throw graphQLError("User not found.", "USER_NOT_FOUND");
  const pending = fresh.contactChangeOtp || {};
  if (pending.target !== normalizedTarget || !pending.value || !pending.otpHash) {
    throw graphQLError("No pending contact change OTP.", "CONTACT_CHANGE_OTP_NOT_FOUND");
  }

  const pendingValue = normalizeValue(normalizedTarget, pending.value);
  if (!pending.expiresAt || new Date(pending.expiresAt).getTime() <= Date.now()) {
    setContactChangeOtp(fresh, undefined);
    await fresh.save();
    await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.expired", target: normalizedTarget, value: pendingValue, status: "warning", delivery: { status: "EXPIRED" } });
    throw graphQLError("OTP expired.", "CONTACT_CHANGE_OTP_EXPIRED");
  }

  const attempts = Number(pending.attempts || 0);
  if (attempts >= maxAttempts()) {
    setContactChangeOtp(fresh, undefined);
    await fresh.save();
    await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.max_attempts", target: normalizedTarget, value: pendingValue, status: "warning", delivery: { status: "MAX_ATTEMPTS" }, attempts });
    throw graphQLError("OTP max attempts exceeded.", "CONTACT_CHANGE_OTP_MAX_ATTEMPTS");
  }

  const incomingHash = hashOtp({ userId: fresh._id, target: normalizedTarget, value: pendingValue, otp: normalizedOtp });
  if (!hashesMatch(incomingHash, pending.otpHash)) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= maxAttempts()) {
      setContactChangeOtp(fresh, undefined);
    } else {
      fresh.contactChangeOtp.attempts = nextAttempts;
    }
    await fresh.save();
    await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.failed", target: normalizedTarget, value: pendingValue, status: "warning", delivery: { status: "INVALID_OTP" }, attempts: nextAttempts });
    throw graphQLError("Invalid OTP.", nextAttempts >= maxAttempts() ? "CONTACT_CHANGE_OTP_MAX_ATTEMPTS" : "INVALID_OTP");
  }

  await assertUniqueContact({ user: fresh, target: normalizedTarget, value: pendingValue });

  const now = new Date();
  if (normalizedTarget === TARGET_EMAIL) {
    fresh.email = pendingValue;
    fresh.emailVerified = true;
    fresh.emailVerifiedAt = now;
    fresh.emailVerifyToken = null;
    fresh.emailVerifyTokenHash = null;
    fresh.emailVerifyTokenExp = null;
  } else {
    fresh.phone = pendingValue;
    fresh.phoneVerified = true;
    fresh.phoneVerifiedAt = now;
    fresh.phoneVerifyToken = null;
    fresh.phoneVerifyTokenHash = null;
    fresh.phoneVerifyTokenExp = null;
  }
  setContactChangeOtp(fresh, undefined);
  await fresh.save();

  await writeAudit({
    ctx,
    user: fresh,
    verb: normalizedTarget === TARGET_EMAIL ? "account.contact_change.email_confirmed" : "account.contact_change.phone_confirmed",
    target: normalizedTarget,
    value: pendingValue,
    status: "success",
    delivery: { status: "VERIFIED", sent: true },
  });

  return User.findById(fresh._id).populate("role").lean({ virtuals: true });
}

export async function cancelContactChangeOtp({ user, target, ctx } = {}) {
  ensureAuthenticatedUser(user);
  const normalizedTarget = normalizeTarget(target);
  const fresh = await User.findById(user._id || user.id);
  if (!fresh) throw graphQLError("User not found.", "USER_NOT_FOUND");
  const pendingValue = fresh.contactChangeOtp?.target === normalizedTarget ? fresh.contactChangeOtp?.value : null;
  if (pendingValue) {
    setContactChangeOtp(fresh, undefined);
    await fresh.save();
  }
  await writeAudit({ ctx, user: fresh, verb: "account.contact_change_otp.cancel", target: normalizedTarget, value: pendingValue || fresh[normalizedTarget] || "", status: "success", delivery: { status: "CANCELLED" } });
  return true;
}

export default {
  requestContactChangeOtp,
  confirmContactChangeOtp,
  cancelContactChangeOtp,
};
