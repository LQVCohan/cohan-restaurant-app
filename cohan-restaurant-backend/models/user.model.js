// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import BaseSchemaModel from "./baseSchemaModel.js";

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    ward: String,
    district: String,
    city: String,
    country: String,
  },
  { _id: false }
);

const walletSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "VND" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Tạo mật khẩu ngẫu nhiên có:
 * - Chữ hoa
 * - Chữ thường
 * - Chữ số
 * - Ký tự đặc biệt
 */
export const generateRandomPassword = (length = 12) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*()-_=+[]{};:,.<>/?";

  const all = upper + lower + digits + special;
  const size = Math.max(4, Number(length) || 12);

  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];

  for (let i = chars.length; i < size; i += 1) {
    chars.push(all[randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
};

const userSchema = BaseSchemaModel(
  {
    /* ============================================================
     * THÔNG TIN CHUNG
     * ============================================================ */
    fullName: { type: String, trim: true },

    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} không phải là email hợp lệ!`,
      },
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^(0|\+?84)(\d{9,10})$/.test(v.replace(/\s+/g, ""));
        },
        message: (props) =>
          `${props.value} không phải là số điện thoại hợp lệ!`,
      },
    },

    address: addressSchema,

    passwordHash: { type: String },

    provider: {
      type: String,
      enum: ["local", "google", "facebook", "apple", "other"],
      default: "local",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "blocked", "pending"],
      default: "active",
    },

    userType: {
      type: String,
      enum: ["CUSTOMER", "STAFF", "MANAGER", "HR", "ACCOUNTANT", "ADMIN"],
      default: "CUSTOMER",
    },

    loyaltyRank: {
      type: String,
      enum: ["basic", "silver", "gold", "platinum"],
      default: "basic",
      index: true,
    },

    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },

    // CUSTOMER only: recent restaurant history, newest first. Never use for auth/scope.
    refRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],

    // Nhà hàng chính nhân viên được phân công (lưu dạng restaurant ID)
    restaurantForStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null },

    taxCode: {
      type: String,
      trim: true,
    },

    avatarUrl: { type: String },

    wallet: walletSchema,

    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerifyToken: { type: String, default: null },
    emailVerifyTokenHash: { type: String, default: null },
    emailVerifyTokenExp: { type: Date, default: null },
    emailVerifyLastSentAt: { type: Date, default: null },

    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date, default: null },
    phoneVerifyToken: { type: String, default: null },
    phoneVerifyTokenHash: { type: String, default: null },
    phoneVerifyTokenExp: { type: Date, default: null },
    phoneVerifyLastSentAt: { type: Date, default: null },

    verifiedAt: { type: Date, default: null },
    verificationLastChannel: {
      type: String,
      enum: ["email", "sms", "both", "none", null],
      default: "none",
    },
    verificationLastStatus: {
      type: String,
      enum: ["sent", "skipped", "failed", "not_configured", "cooldown", "already_verified", "verified", null],
      default: null,
    },
    verificationLastError: { type: String, default: null },
    verificationLastRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verificationLastRequestedAt: { type: Date, default: null },

    contactChangeOtp: {
      target: { type: String, enum: ["email", "phone"], default: null },
      value: { type: String, trim: true, default: null },
      otpHash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0, min: 0 },
      lastSentAt: { type: Date, default: null },
      requestedAt: { type: Date, default: null },
    },

    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    forcePasswordChange: { type: Boolean, default: false },

    deletedAt: { type: Date, default: null, index: true },
    deleteExpiresAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { discriminatorKey: "userType" }
);

/* ============================================================
 * HOOKS
 * ============================================================ */
userSchema.pre("validate", function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  if (this.phone) {
    let phone = this.phone.replace(/\s+/g, "").replace(/^\+84/, "0");
    if (phone.startsWith("84")) phone = "0" + phone.slice(2);
    this.phone = phone;
  }

  if (this.username) {
    this.username = this.username.trim().toLowerCase();
  }

  if (this.taxCode) {
    this.taxCode = this.taxCode.trim();
  }

  next();
});

userSchema.pre("save", async function (next) {
  try {
    if (this.isNew && !this.passwordHash && !this.isGuest) {
      const plain = generateRandomPassword(12);
      this._generatedPassword = plain;
      await this.setPassword(plain);
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* ============================================================
 * METHODS
 * ============================================================ */
userSchema.methods.setPassword = async function (plain) {
  if (!plain) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.checkPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.virtual("roleName").get(function () {
  const r = this.role;
  if (!r) return "";
  const slug = r.slug || r?.toObject?.()?.slug;
  const name = r.name || r?.toObject?.()?.name;
  return (slug || name || "").toString().toLowerCase();
});

/* ============================================================
 * INDEXES
 * ============================================================ */

userSchema.index({
  fullName: "text",
  "address.city": 1,
  "address.district": 1,
});

userSchema.index({ emailVerifyToken: 1 });
userSchema.index({ emailVerifyTokenHash: 1 });
userSchema.index({ phoneVerifyToken: 1 });
userSchema.index({ phoneVerifyTokenHash: 1 });
userSchema.index({ emailVerifyTokenExp: 1 });
userSchema.index({ phoneVerifyTokenExp: 1 });
userSchema.index({ emailVerified: 1 });
userSchema.index({ phoneVerified: 1 });
userSchema.index({ restaurantForStaff: 1, employeeCode: 1 }, {
  unique: true,
  partialFilterExpression: {
    userType: "STAFF",
    employeeCode: { $exists: true, $type: "string", $ne: "" },
    restaurantForStaff: { $exists: true, $type: "objectId" },
  },
});
userSchema.index({ userType: 1, employmentStatus: 1, restaurantForStaff: 1 });
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
