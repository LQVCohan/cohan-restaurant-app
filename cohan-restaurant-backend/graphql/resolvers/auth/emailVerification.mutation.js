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

function enabled(name, fallback = true) {
  return String(process.env[name] ?? String(fallback)).toLowerCase() === "true";
}

function normalizeChannel(channel) {
  return String(channel || "AUTO").toUpperCase();
}

async function assertCanResendForTarget(ctx, target) {
  requireAuth(ctx);
  if (hasRole(ctx.user, ["admin"])) return true;
  if (hasRole(ctx.user, ["manager", "hr"])) {
    const restaurantId = target?.restaurantForStaff || target?.refRestaurants?.[0] || null;
    if (!restaurantId) {
      throw new GraphQLError("FORBIDDEN", { extensions: { code: "FORBIDDEN" } });
    }
    await requireRestaurantAccess(ctx, restaurantId);
    if (String(target?.userType || "").toUpperCase() === "ADMIN") {
      throw new GraphQLError("FORBIDDEN", { extensions: { code: "FORBIDDEN" } });
    }
    return true;
  }
  if (String(ctx.user.id || ctx.user._id) === String(target?._id || target?.id)) return true;
  throw new GraphQLError("FORBIDDEN", { extensions: { code: "FORBIDDEN" } });
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

export default {
  // Mutation: requestEmailVerification(email: String!): Boolean!
  requestEmailVerification: async (_root, { email }, ctx) => {
    if (!enabled("ENABLE_EMAIL_VERIFICATION", true)) return true;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user) return true; // Không tiết lộ user existence.
    if (user.emailVerified) return true;
    await issueVerificationForUser({ user, channels: "EMAIL", reason: "request", ctx });
    return true;
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
    await issueVerificationForUser({ user, channels: "EMAIL", reason: "resend", ctx });
    return true;
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
};
