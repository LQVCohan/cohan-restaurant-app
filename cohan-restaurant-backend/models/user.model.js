// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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

const userSchema = BaseSchemaModel({
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
        if (!v) return true; // cho phép null
        // Biểu thức chính quy kiểm tra định dạng email cơ bản
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
        if (!v) return true; // cho phép null
        // Cho phép số có 9-11 chữ số, bắt đầu bằng 0 hoặc +84
        return /^(0|\+?84)(\d{9,10})$/.test(v.replace(/\s+/g, ""));
      },
      message: (props) => `${props.value} không phải là số điện thoại hợp lệ!`,
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

  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  refRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],

  loyaltyPoints: { type: Number, default: 0 },
  customerType: {
    type: String,
    enum: ["VIP", "NEW", "OFTEN"],
    default: "NEW",
  },
  avatarUrl: { type: String },
  totalOrders: { type: Number, default: 0 },
  totalSpending: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, default: null },
  emailVerifyTokenExp: { type: Date, default: null },
  isGuest: { type: Boolean, default: false },
  guestExpiresAt: { type: Date }, // TTL index bên dưới
});

userSchema.pre("validate", function (next) {
  // 1️⃣ Chuẩn hoá email
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  // 2️⃣ Chuẩn hoá phone
  if (this.phone) {
    let phone = this.phone.replace(/\s+/g, "").replace(/^\+84/, "0"); // đổi +84 -> 0
    if (phone.startsWith("84")) phone = "0" + phone.slice(2); // đổi 84xxxx -> 0xxxx
    this.phone = phone;
  }

  // 3️⃣ Chuẩn hoá username
  if (this.username) {
    this.username = this.username.trim().toLowerCase();
  }

  next();
});

userSchema.methods.setPassword = async function (plain) {
  if (!plain) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.checkPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.index({
  fullName: "text",
  "address.city": 1,
  "address.district": 1,
});
userSchema.index(
  { guestExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { isGuest: true } }
);
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
