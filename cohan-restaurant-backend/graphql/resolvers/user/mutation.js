// src/graphql/resolvers/user/mutation.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import process from "process";
import { User, Role } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

import { validatePasswordStrong } from "../../../lib/passwordPolicy.js";
import { verifyRecaptcha } from "../../../lib/recaptcha.js";

// ✅ dùng mutation verify đã chuẩn hóa & helper gửi mail
import emailVerificationMutation, {
  issueAndSendVerificationForUser,
} from "../auth/emailVerification.mutation.js";

const signToken = (user) => {
  const payload = {
    id: String(user._id),
    email: user.email,
    role: (user.role?.slug || user.role?.name || "").toLowerCase(),
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: process.env.JWT_ISSUER || "foodhub-system",
  });
};

export const UserMutation = {
  // ========== Role ==========
  assignRoleToUser: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);
    const { userId, roleId } = input;
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(roleId)
    ) {
      throw new GraphQLError("Invalid userId or roleId");
    }
    const role = await Role.findById(roleId).lean();
    if (!role) throw new GraphQLError("Role not found");
    const u = await User.findById(userId);
    if (!u) throw new GraphQLError("User not found");
    u.role = roleId;
    await u.save();
    return u.toObject();
  },

  // ========== Register ==========
  createUser: async (_, { input }, ctx) => {
    const {
      fullName,
      username,
      email,
      phone,
      address,
      password,
      roleId,
      customerType,
      captchaToken,
      provider = "local",
    } = input;

    if (!fullName?.trim()) {
      throw new GraphQLError("fullName is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const policy = validatePasswordStrong(password);
    if (!policy.ok) {
      throw new GraphQLError(
        `Weak password: ${
          policy.reason || "Password does not meet requirements"
        }`,
        {
          extensions: { code: "BAD_USER_INPUT" },
        }
      );
    }

    const recaptcha = await verifyRecaptcha(captchaToken, ctx);
    if (!recaptcha.ok) {
      throw new GraphQLError(
        recaptcha.reason || "reCAPTCHA verification failed",
        {
          extensions: { code: "BAD_USER_INPUT" },
        }
      );
    }

    let roleDoc = null;
    if (roleId) {
      if (!mongoose.isValidObjectId(roleId)) {
        throw new GraphQLError("Invalid roleId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      roleDoc = await Role.findById(roleId).lean();
      if (!roleDoc) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const exists = await User.findOne({
      $or: [
        { email: email?.toLowerCase().trim() },
        { phone: phone?.replace(/\s+/g, "").replace(/^\+84/, "0") },
        { username: username?.toLowerCase().trim() },
      ],
    });
    if (exists) {
      throw new GraphQLError("Email/Phone/Username already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const doc = new User({
      fullName: fullName.trim(),
      username: username?.trim(),
      email: email?.toLowerCase().trim(),
      phone: phone?.trim(),
      address: address || undefined,
      provider,
      status: "active",
      customerType: customerType || "NEW",
      role: roleId || undefined,
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
    });
    await doc.setPassword(password);
    await doc.save();

    // gửi email xác minh nếu bật
    if (
      String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() ===
      "true"
    ) {
      try {
        await issueAndSendVerificationForUser(doc);
      } catch (err) {
        console.error("Email verification send failed:", err);
        // không throw để không block đăng ký
      }
    }

    const userObj = await User.findById(doc._id)
      .populate("role")
      .lean({ virtuals: true });

    const token = signToken({ ...userObj, role: userObj.role });
    const roleName = (
      userObj.role?.slug ||
      userObj.role?.name ||
      ""
    ).toLowerCase();
    return { token, user: { ...userObj, roleName } };
  },

  // ========== Login ==========
  login: async (_, { email, username, phone, password, captchaToken }, ctx) => {
    if (!password) {
      throw new GraphQLError("Password is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const recaptcha = await verifyRecaptcha(captchaToken, ctx);
    if (!recaptcha.ok) {
      throw new GraphQLError(
        recaptcha.reason || "reCAPTCHA verification failed",
        {
          extensions: { code: "BAD_USER_INPUT" },
        }
      );
    }

    const q = {
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(username ? [{ username: username.trim() }] : []),
        ...(phone ? [{ phone: phone.trim() }] : []),
      ],
    };
    if (q.$or.length === 0) {
      throw new GraphQLError("Provide one of email/username/phone", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const user = await User.findOne(q).populate("role");
    if (!user)
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    if (!user.passwordHash)
      throw new GraphQLError("User has no password", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    if (user.status !== "active")
      throw new GraphQLError("User is not active", {
        extensions: { code: "FORBIDDEN" },
      });

    // Nếu muốn chặn login khi chưa verify, bật đoạn này:
    // if (
    //   process.env.ENABLE_EMAIL_VERIFICATION === "true" &&
    //   !user.emailVerified
    // ) {
    //   throw new GraphQLError("Email not verified. Please check your inbox.", {
    //     extensions: { code: "FORBIDDEN" },
    //   });
    // }

    const ok = user.checkPassword ? await user.checkPassword(password) : false;
    if (!ok)
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });

    const userObj = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });
    const token = signToken({ ...userObj, role: userObj.role });
    const roleName = (
      userObj.role?.slug ||
      userObj.role?.name ||
      ""
    ).toLowerCase();

    return { token, user: { ...userObj, roleName } };
  },

  // ========== gộp các mutation verify từ file chuyên trách ==========
  ...emailVerificationMutation,
};
