// src/graphql/resolvers/auth/emailVerification.mutation.js
import { GraphQLError } from "graphql";
import process from "process";
import { User } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { hasRole } from "../../../utils/authz.js";
import {
  issueVerificationForUser,
  resendAccountVerification,
  verifyEmailToken,
  verifyPhoneToken,
  verifyAnyToken,
} from "../../../src/services/auth/accountVerification.service.js";
import {
  requestContactChangeOtp as requestContactChangeOtpService,
  confirmContactChangeOtp as confirmContactChangeOtpService,
  cancelContactChangeOtp as cancelContactChangeOtpService,
} from "../../../src/services/auth/contactChangeOtp.service.js";

function enabled(name, fallback = true) {
  return String(process.env[name] ?? String(fallback)).toLowerCase() === "true";
}

function normalizeChannel(channel) {
  return String(channel || "AUTO").toUpperCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "").replace(/^\+84/, "0").trim();
}

function idString(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || value.value || "");
  return String(value);
}

function targetRestaurantIds(target) {
  const ids = [
    target?.restaurantForStaff,
    target?.restaurantId,
    ...(Array.isArray(target?.restaurantIds) ? target.restaurantIds : []),
  ]
    .map(idString)
    .filter(Boolean);
  return [...new Set(ids)];
}

function forbidden() {
  return new GraphQLError("FORBIDDEN", { extensions: { code: "FORBIDDEN" } });
}

function channelLabel(channel) {
  return channel === "sms" ? "SMS" : "email";
}

function channelCode(channel, suffix) {
  return `${channel === "sms" ? "SMS" : "EMAIL"}_${suffix}`;
}

function ensureVerificationDispatched(result, channel = "email") {
  const delivery = channel === "sms" ? result?.sms : result?.email;
  const status = String(delivery?.status || result?.status || "").toUpperCase();
  const label = channelLabel(channel);

  if (status === "SENT" || status === "ALREADY_VERIFIED" || status === "VERIFIED") {
    return true;
  }

  if (status === "COOLDOWN") {
    throw new GraphQLError(`Verification ${label} was requested too recently. Please wait before trying again.`, {
      extensions: { code: "TOO_MANY_REQUESTS", deliveryStatus: status, cooldownUntil: delivery?.cooldownUntil || null },
    });
  }

  if (status === "NOT_CONFIGURED") {
    throw new GraphQLError(`Verification ${label} was not sent because the ${label} provider is not configured.`, {
      extensions: { code: channelCode(channel, "PROVIDER_NOT_CONFIGURED"), deliveryStatus: status, provider: delivery?.provider || null, error: delivery?.error || null },
    });
  }

  if (status === "FAILED") {
    throw new GraphQLError(`Verification ${label} delivery failed.`, {
      extensions: { code: channelCode(channel, "DELIVERY_FAILED"), deliveryStatus: status, provider: delivery?.provider || null, error: delivery?.error || null },
    });
  }

  throw new GraphQLError(`Verification ${label} was not sent.`, {
    extensions: { code: channelCode(channel, "NOT_SENT"), deliveryStatus: status || "UNKNOWN", provider: delivery?.provider || null, error: delivery?.error || null },
  });
}

async function hasAccessToAnyTargetRestaurant(ctx, restaurantIds) {
  for (const restaurantId of restaurantIds) {
    try {
      await requireRestaurantAccess(ctx, restaurantId);
      return true;
    } catch (err) {
      const code = err?.extensions?.code || err?.code || err?.statusCode;
      if (!["FORBIDDEN", "FORBIDDEN_SCOPE", 403].includes(code)) throw err;
    }
  }
  return false;
}

export async function assertCanResendForTarget(ctx, target) {
  requireAuth(ctx);
  if (hasRole(ctx.user, ["admin"])) return true;

  const isTargetAdmin = String(target?.userType || target?.roleName || target?.role?.slug || "").toUpperCase() === "ADMIN";
  if (isTargetAdmin) throw forbidden();

  const currentUserId = idString(ctx.user.id || ctx.user._id);
  const targetUserId = idString(target?._id || target?.id);
  if (currentUserId && currentUserId === targetUserId) return true;

  if (hasRole(ctx.user, ["manager", "hr"])) {
    const restaurantIds = targetRestaurantIds(target);
    if (!restaurantIds.length) throw forbidden();
    if (await hasAccessToAnyTargetRestaurant(ctx, restaurantIds)) return true;
  }

  throw forbidden();
}

// Backward-compatible helper để nơi khác (vd: createUser) có thể gọi tái sử dụng.
export async function issueAndSendVerificationForUser(user, options = {}) {
  return issueVerificationForUser({
    user,
    channels: options.channel || options.channels || "AUTO",
    requestedBy: options.requestedBy || null,
    reason: options.reason || "issue",
    ctx: options.ctx || null,
    force: Boolean(options.force),
  });
}

const mutations = {
  // Mutation: requestEmailVerification(email: String!): Boolean!
  requestEmailVerification: async (_root, { email }, ctx) => {
    if (!enabled("ENABLE_EMAIL_VERIFICATION", true)) return true;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user) return true; // Không tiết lộ user existence.
    if (user.emailVerified) return true;
    const result = await issueVerificationForUser({ user, channels: "EMAIL", reason: "request", ctx });
    return ensureVerificationDispatched(result, "email");
  },

  // Mutation: verifyEmail(token: String!): Boolean!
  verifyEmail: async (_root, { token }) => {
    if (!enabled("ENABLE_EMAIL_VERIFICATION", true)) return true;
    return verifyEmailToken(token);
  },

  // Mutation: resendVerification(email: String!): Boolean!
  resendVerification: async (_root, { email }, ctx) => {
    if (!enabled("ENABLE_EMAIL_VERIFICATION", true)) return true;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user) return true; // Không tiết lộ user existence.
    if (user.emailVerified) return true;
    const result = await issueVerificationForUser({ user, channels: "EMAIL", reason: "resend", ctx });
    return ensureVerificationDispatched(result, "email");
  },

  resendSmsVerification: async (_root, { phone }, ctx) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return true;
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return true; // Không tiết lộ user existence.
    if (user.phoneVerified) return true;
    const result = await issueVerificationForUser({ user, channels: "SMS", reason: "resend", ctx });
    return ensureVerificationDispatched(result, "sms");
  },

  requestMyVerification: async (_root, { channel = "AUTO" }, ctx) => {
    requireAuth(ctx);
    const user = await User.findById(ctx.user.id || ctx.user._id);
    if (!user) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });
    return issueVerificationForUser({ user, channels: normalizeChannel(channel), requestedBy: user, reason: "request_my", ctx });
  },

  resendUserVerification: async (_root, { userId, channel = "AUTO" }, ctx) => {
    const target = await User.findById(userId);
    if (!target) throw new GraphQLError("USER_NOT_FOUND", { extensions: { code: "NOT_FOUND" } });
    await assertCanResendForTarget(ctx, target);
    return resendAccountVerification({ userId, channel: normalizeChannel(channel), requestedBy: ctx.user, ctx });
  },

  verifyPhone: async (_root, { token }) => verifyPhoneToken(token),

  verifyAccountToken: async (_root, { token, channel }) => verifyAnyToken({ token, channel }),

  requestContactChangeOtp: async (_root, { input }, ctx) => {
    requireAuth(ctx);
    return requestContactChangeOtpService({ user: ctx.user, target: input?.target, value: input?.value, ctx });
  },

  confirmContactChangeOtp: async (_root, { input }, ctx) => {
    requireAuth(ctx);
    return confirmContactChangeOtpService({ user: ctx.user, target: input?.target, otp: input?.otp, ctx });
  },

  cancelContactChangeOtp: async (_root, { target }, ctx) => {
    requireAuth(ctx);
    return cancelContactChangeOtpService({ user: ctx.user, target, ctx });
  },
};

export const resendSmsVerification = mutations.resendSmsVerification;
export default mutations;