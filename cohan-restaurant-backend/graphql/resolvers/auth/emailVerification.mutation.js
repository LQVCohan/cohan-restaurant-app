// src/graphql/resolvers/auth/emailVerification.mutation.js
import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import process from "process";
import { User } from "../../../models/index.js";
import { mailer, buildVerifyMail } from "../../../lib/mailer.js";

const VERIFY_TTL_MS = 24 * 3600 * 1000; // 24h
const RESEND_COOLDOWN_MS = 60 * 1000;

function appPublicUrl() {
  return process.env.APP_PUBLIC_URL || "http://localhost:5173";
}
function buildVerifyLink(token) {
  return `${appPublicUrl()}/verify-email/confirm?token=${encodeURIComponent(
    token
  )}`;
}

// 👉 helper để nơi khác (vd: createUser) có thể gọi tái sử dụng
export async function issueAndSendVerificationForUser(user) {
  const now = Date.now();
  const lastSentAt = user?.emailVerifyLastSentAt
    ? new Date(user.emailVerifyLastSentAt).getTime()
    : 0;
  if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
    throw new GraphQLError("Please wait before requesting another verification email.", {
      extensions: { code: "TOO_MANY_REQUESTS" },
    });
  }

  const token = randomBytes(32).toString("hex");
  const exp = new Date(Date.now() + VERIFY_TTL_MS);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerifyToken: token,
        emailVerifyTokenExp: exp,
        emailVerifyLastSentAt: new Date(),
      },
    }
  );

  const link = buildVerifyLink(token);
  await mailer.sendMail(buildVerifyMail({ to: user.email, link }));
}

export default {
  // Mutation: requestEmailVerification(email: String!): Boolean!
  requestEmailVerification: async (_root, { email }) => {
    const enabled =
      String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() ===
      "true";
    if (!enabled) return true;

    const user = await User.findOne({ email }).lean();
    if (!user) return true; // không tiết lộ info
    if (user.emailVerified) return true; // đã xác minh rồi

    await issueAndSendVerificationForUser(user);
    return true;
  },

  // Mutation: verifyEmail(token: String!): Boolean!
  verifyEmail: async (_root, { token }) => {
    const enabled =
      String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() ===
      "true";
    if (!enabled) return true;

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyTokenExp: { $gt: new Date() },
    });
    if (!user) {
      throw new GraphQLError("Invalid or expired verification link.", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true },
        $unset: { emailVerifyToken: 1, emailVerifyTokenExp: 1 },
      }
    );
    return true;
  },

  // Mutation: resendVerification(email: String!): Boolean!
  resendVerification: async (_root, { email }) => {
    const enabled =
      String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() ===
      "true";
    if (!enabled) return true;

    const user = await User.findOne({ email }).lean();
    if (!user) return true;
    if (user.emailVerified) return true;

    await issueAndSendVerificationForUser(user);
    return true;
  },
};
