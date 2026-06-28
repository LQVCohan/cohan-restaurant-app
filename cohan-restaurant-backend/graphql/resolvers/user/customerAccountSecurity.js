import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { RefreshToken, User } from "../../../models/index.js";
import { clearRefreshCookie, hashRefreshToken } from "../../../src/security/authTokens.js";

const requireUserId = (ctx) => {
  const userId = ctx?.user?.id || ctx?.user?._id;
  if (!userId) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  return new mongoose.Types.ObjectId(userId);
};

const currentRefreshHash = (ctx) => {
  const name = process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token";
  const raw = ctx?.cookies?.[name] || ctx?.req?.cookies?.[name] || ctx?.request?.cookies?.[name];
  return raw ? hashRefreshToken(raw) : null;
};

const isActive = (token, now = new Date()) => !token.revokedAt && token.expiresAt > now;

export default {
  Query: {
    myLoginSessions: async (_, { limit = 20 }, ctx) => {
      const userId = requireUserId(ctx);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const currentHash = currentRefreshHash(ctx);
      const now = new Date();
      const tokens = await RefreshToken.find({ userId, expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();

      return tokens.map((token) => ({
        id: String(token._id),
        userAgent: token.userAgent || null,
        ip: token.ip || null,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        isCurrent: Boolean(currentHash && token.tokenHash === currentHash),
        isActive: isActive(token, now),
      }));
    },
  },

  Mutation: {
    revokeMyLoginSession: async (_, { id }, ctx) => {
      const userId = requireUserId(ctx);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new GraphQLError("Invalid session id", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const currentHash = currentRefreshHash(ctx);
      const token = await RefreshToken.findOne({ _id: id, userId });
      if (!token) return false;
      token.revokedAt = token.revokedAt || new Date();
      await token.save();
      if (currentHash && token.tokenHash === currentHash && ctx?.reply) clearRefreshCookie(ctx.reply);
      return true;
    },

    revokeOtherMyLoginSessions: async (_, __, ctx) => {
      const userId = requireUserId(ctx);
      const now = new Date();
      const query = { userId, revokedAt: null, expiresAt: { $gt: now } };
      const currentHash = currentRefreshHash(ctx);
      if (currentHash) query.tokenHash = { $ne: currentHash };
      const result = await RefreshToken.updateMany(query, { $set: { revokedAt: now } });
      return result.modifiedCount || 0;
    },

    deleteMyAccount: async (_, { currentPassword, confirmText }, ctx) => {
      const userId = requireUserId(ctx);
      const normalizedConfirm = String(confirmText || "").trim().toUpperCase();
      if (!["XOA TAI KHOAN", "XÓA TÀI KHOẢN"].includes(normalizedConfirm)) {
        throw new GraphQLError("Invalid confirmation text", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const user = await User.findById(userId);
      if (!user) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      if (user.passwordHash && !(await user.checkPassword(currentPassword || ""))) {
        throw new GraphQLError("Current password is incorrect", { extensions: { code: "FORBIDDEN" } });
      }

      const now = new Date();
      user.status = "inactive";
      user.deletedAt = now;
      user.deleteExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      user.deletedBy = user._id;
      await user.save();
      await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: now } });
      if (ctx?.reply) clearRefreshCookie(ctx.reply);
      return true;
    },
  },
};
