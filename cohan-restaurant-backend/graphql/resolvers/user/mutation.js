// src/graphql/resolvers/user/mutation.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import process from "process";
import { User, Role } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

import { validatePasswordStrong } from "../../../lib/passwordPolicy.js";
import { verifyRecaptcha } from "../../../lib/recaptcha.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveBase64Avatar(base64, userId) {
  // base64 có thể là "data:image/png;base64,XXXX" hoặc "XXXX"
  const hasPrefix = /^data:image\/([a-zA-Z0-9+]+);base64,/.test(base64 || "");
  const pureBase64 = hasPrefix ? base64.split(",")[1] : base64;

  // Detect ext từ prefix nếu có
  let ext = "png";
  if (hasPrefix) {
    const m = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    if (m?.[1]) ext = m[1].toLowerCase();
  }

  const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
  ensureDirSync(uploadsDir);

  const filename = `${userId}-${Date.now()}.${ext}`;
  const absPath = path.join(uploadsDir, filename);
  fs.writeFileSync(absPath, Buffer.from(pureBase64, "base64"));

  // URL public (ví dụ: /uploads/avatars/xxx.png)
  return `/uploads/avatars/${filename}`;
}

// helper: chuẩn hoá số điện thoại VN nhẹ nhàng
const normalizePhone = (p) =>
  p ? p.replace(/\s+/g, "").replace(/^\+84/, "0") : p;

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

  // ========== Change password (simple args) ==========
  async changeMyPassword(_, { currentPassword, newPassword }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    if (!currentPassword || !newPassword) {
      throw new GraphQLError("Missing password", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const user = await User.findById(authUser.id);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    if (!user.passwordHash) {
      throw new GraphQLError("User has no password", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    const ok = user.checkPassword
      ? await user.checkPassword(currentPassword)
      : false;
    if (!ok) {
      throw new GraphQLError("Current password is incorrect", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const policy = validatePasswordStrong(newPassword);
    if (!policy.ok) {
      throw new GraphQLError(
        `Weak password: ${
          policy.reason || "Password does not meet requirements"
        }`,
        { extensions: { code: "BAD_USER_INPUT" } }
      );
    }

    await user.setPassword(newPassword);
    await user.save();
    return true;
  },

  // ========== Change password (alias, input object) ==========

  // ======== CẬP NHẬT AVATAR (nâng cao: base64/fileUrl) =========
  async updateAvatar(_, { input }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await User.findById(authUser.id);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    let nextUrl = user.avatarUrl || null;

    if (input?.fileBase64) {
      try {
        nextUrl = saveBase64Avatar(input.fileBase64, user._id);
      } catch (err) {
        console.error("saveBase64Avatar error:", err);
        throw new GraphQLError("Failed to save avatar", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    } else if (input?.fileUrl) {
      // bạn chỉ định URL sẵn có (VD sau khi gọi REST /api/upload)
      nextUrl = input.fileUrl;
    } else if (typeof input?.clear === "boolean" && input.clear === true) {
      nextUrl = null;
    } else {
      throw new GraphQLError("No avatar provided", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    user.avatarUrl = nextUrl;
    await user.save();
    const saved = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });
    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return { ...saved, roleName };
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
        { extensions: { code: "BAD_USER_INPUT" } }
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
        { phone: normalizePhone(phone) },
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

    if (
      String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() ===
      "true"
    ) {
      try {
        await issueAndSendVerificationForUser(doc);
      } catch (err) {
        console.error("Email verification send failed:", err);
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

    // if (process.env.ENABLE_EMAIL_VERIFICATION === "true" && !user.emailVerified) {
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

  // ========== Update current user (có avatarUrl) ==========
  updateUser: async (_, { input }, ctx) => {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const u = await User.findById(authUser.id);
    if (!u) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const updates = {};
    // fullName
    if (typeof input.fullName === "string") {
      const v = input.fullName.trim();
      if (!v) {
        throw new GraphQLError("fullName cannot be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.fullName = v;
    }

    // username (duy nhất – nếu cho phép đổi)
    if (typeof input.username === "string" && input.username.trim()) {
      const nextUsername = input.username.trim();
      const existUsername = await User.findOne({
        _id: { $ne: u._id },
        username: nextUsername.toLowerCase(),
      }).lean();
      if (existUsername) {
        throw new GraphQLError("Username already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.username = nextUsername;
    }

    // email (duy nhất)
    if (typeof input.email === "string") {
      const nextEmail = input.email.trim().toLowerCase();
      if (nextEmail) {
        const existEmail = await User.findOne({
          _id: { $ne: u._id },
          email: nextEmail,
        }).lean();
        if (existEmail) {
          throw new GraphQLError("Email already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        // nếu email đổi ⇒ reset verify
        if (u.email && u.email !== nextEmail) {
          updates.emailVerified = false;
        }
        updates.email = nextEmail;
      } else {
        updates.email = null; // cho phép xoá nếu cần
        updates.emailVerified = false;
      }
    }

    // phone (duy nhất nhẹ)
    if (typeof input.phone === "string") {
      const nextPhone = normalizePhone(input.phone.trim());
      if (nextPhone) {
        const existPhone = await User.findOne({
          _id: { $ne: u._id },
          phone: nextPhone,
        }).lean();
        if (existPhone) {
          throw new GraphQLError("Phone already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        updates.phone = nextPhone;
      } else {
        updates.phone = null;
      }
    }

    // address (ghi đè từng field)
    if (input.address && typeof input.address === "object") {
      updates.address = {
        line1: input.address.line1 ?? u.address?.line1 ?? "",
        line2: input.address.line2 ?? u.address?.line2 ?? "",
        ward: input.address.ward ?? u.address?.ward ?? "",
        district: input.address.district ?? u.address?.district ?? "",
        city: input.address.city ?? u.address?.city ?? "",
        country: input.address.country ?? u.address?.country ?? "vietnam",
      };
    }

    // avatarUrl (đổi độc lập hoặc kèm các trường khác)
    if (Object.prototype.hasOwnProperty.call(input, "avatarUrl")) {
      // Cho phép set null/empty để xoá; FE gửi string hoặc null
      const v = (input.avatarUrl ?? "").toString().trim();
      updates.avatarUrl = v || null;
    }

    // cập nhật
    const saved = await User.findByIdAndUpdate(u._id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("role")
      .lean({ virtuals: true });

    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return { ...saved, roleName };
  },
  async createGuestUser(_, { fullName, phone, expiresInDays = 30 }, { user }) {
    requireRole(user, ["admin", "manager", "staff"]);

    const doc = new User({
      fullName: (fullName || "Guest").trim(),
      phone: phone ? normalizePhone(phone) : undefined,
      status: "active",
      isGuest: true,
      guestExpiresAt: dayjs().add(expiresInDays, "day").toDate(),
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
    });

    await doc.save();
    const saved = await User.findById(doc._id)
      .populate("role")
      .lean({ virtuals: true });
    return saved;
  },

  // === NEW: admin cập nhật user bất kỳ ===
  async adminUpdateUser(_, { userId, input }, { user: authUser }) {
    requireRole(authUser, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const u = await User.findById(userId);
    if (!u) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const updates = {};
    if (typeof input.fullName === "string")
      updates.fullName = input.fullName.trim();
    if (typeof input.username === "string" && input.username.trim()) {
      const nextUsername = input.username.trim().toLowerCase();
      const existUsername = await User.findOne({
        _id: { $ne: u._id },
        username: nextUsername,
      }).lean();
      if (existUsername) {
        throw new GraphQLError("Username already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.username = nextUsername;
    }
    if (typeof input.email === "string") {
      const nextEmail = input.email.trim().toLowerCase() || null;
      if (nextEmail) {
        const existEmail = await User.findOne({
          _id: { $ne: u._id },
          email: nextEmail,
        }).lean();
        if (existEmail) {
          throw new GraphQLError("Email already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        if (u.email && u.email !== nextEmail) updates.emailVerified = false;
      } else {
        updates.emailVerified = false;
      }
      updates.email = nextEmail;
    }
    if (typeof input.phone === "string") {
      const nextPhone = normalizePhone(input.phone);
      if (nextPhone) {
        const existPhone = await User.findOne({
          _id: { $ne: u._id },
          phone: nextPhone,
        }).lean();
        if (existPhone) {
          throw new GraphQLError("Phone already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        updates.phone = nextPhone;
      } else {
        updates.phone = null;
      }
    }
    if (input.address && typeof input.address === "object") {
      updates.address = {
        line1: input.address.line1 ?? u.address?.line1 ?? "",
        line2: input.address.line2 ?? u.address?.line2 ?? "",
        ward: input.address.ward ?? u.address?.ward ?? "",
        district: input.address.district ?? u.address?.district ?? "",
        city: input.address.city ?? u.address?.city ?? "",
        country: input.address.country ?? u.address?.country ?? "vietnam",
      };
    }
    if (Object.prototype.hasOwnProperty.call(input, "avatarUrl")) {
      const v = (input.avatarUrl ?? "").toString().trim();
      updates.avatarUrl = v || null;
    }
    if (typeof input.status === "string") {
      const s = input.status.toLowerCase();
      if (!["active", "inactive", "blocked", "pending"].includes(s)) {
        throw new GraphQLError("Invalid status", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.status = s;
    }
    if (typeof input.customerType === "string")
      updates.customerType = input.customerType;
    if (typeof input.loyaltyPoints === "number")
      updates.loyaltyPoints = Math.max(0, input.loyaltyPoints);
    if (typeof input.totalOrders === "number")
      updates.totalOrders = Math.max(0, input.totalOrders);
    if (typeof input.totalSpending === "number")
      updates.totalSpending = Math.max(0, input.totalSpending);
    if (typeof input.isGuest === "boolean") updates.isGuest = input.isGuest;
    if (input.guestExpiresAt)
      updates.guestExpiresAt = new Date(input.guestExpiresAt);
    if (Array.isArray(input.refRestaurantIds)) {
      updates.refRestaurants = input.refRestaurantIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }

    // cho phép đổi role trực tiếp
    if (input.roleId) {
      if (!mongoose.isValidObjectId(input.roleId)) {
        throw new GraphQLError("Invalid roleId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const roleDoc = await Role.findById(input.roleId).lean();
      if (!roleDoc) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.role = input.roleId;
    }

    const saved = await User.findByIdAndUpdate(u._id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("role")
      .lean({ virtuals: true });

    return saved;
  },

  // === NEW: đổi status nhanh ===
  async setUserStatus(_, { userId, status }, { user: authUser }) {
    requireRole(authUser, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const s = (status || "").toLowerCase();
    if (!["active", "inactive", "blocked", "pending"].includes(s)) {
      throw new GraphQLError("Invalid status", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const saved = await User.findByIdAndUpdate(
      userId,
      { status: s },
      { new: true }
    ).lean();
    if (!saved) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return saved;
  },

  // === NEW: xoá mềm (đặt inactive) ===
  async softDeleteUser(_, { userId }, { user: authUser }) {
    requireRole(authUser, ["admin"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const saved = await User.findByIdAndUpdate(
      userId,
      { status: "inactive" },
      { new: true }
    ).lean();
    if (!saved) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return true;
  },
  // ========== verify email mutations ==========
  ...emailVerificationMutation,
};
