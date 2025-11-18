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
    // trạng thái account (login được hay không)
    type: String,
    enum: ["active", "inactive", "blocked", "pending"],
    default: "active",
  },

  // Phân loại người dùng cấp cao
  userType: {
    type: String,
    enum: ["CUSTOMER", "STAFF", "MANAGER", "ADMIN"],
    default: "CUSTOMER",
  },

  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },

  // Nhân sự có thể thuộc nhiều nhà hàng
  refRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],

  // Mã số thuế (cho nhân viên hoặc chủ nhà hàng, nếu cần)
  taxCode: {
    type: String,
    trim: true,
  },

  /* ============================================================
   * THÔNG TIN KHÁCH HÀNG
   * ============================================================ */
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

  /* ============================================================
   * THÔNG TIN NHÂN VIÊN / STAFF
   * ============================================================ */

  // Mã nhân viên nội bộ
  employeeCode: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
  },
  rate: { type: Number, default: 0 }, // điểm trung bình (1–5)
  rateCount: { type: Number, default: 0 },
  // Chức danh hiển thị (Phục vụ, Thu ngân, Quản lý, Bếp...)
  positionTitle: {
    type: String,
    trim: true,
  },

  // Hình thức làm việc
  employmentType: {
    type: String,
    enum: ["full_time", "part_time", "probation", "seasonal", "contract"],
    default: "full_time",
  },

  // Trạng thái công việc (khác với status account)
  employmentStatus: {
    type: String,
    enum: ["working", "on_leave", "resigned", "suspended"],
    default: "working",
  },

  // Nhà hàng chính (nếu nhân viên thuộc nhiều nơi)
  primaryRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
  },

  // Loại ca làm chính
  shiftType: {
    type: String,
    enum: ["morning", "afternoon", "evening", "full_day", "rotating"],
  },

  // Ngày làm việc trong tuần
  workingDays: [
    {
      type: String,
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  ],

  // Ngày vào làm / nghỉ việc
  dateJoined: { type: Date },
  dateLeft: { type: Date, default: null },

  // Thông tin đăng nhập gần nhất
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String },

  // Ép đổi mật khẩu lần tới đăng nhập
  forcePasswordChange: { type: Boolean, default: false },

  // Ghi chú nội bộ (chỉ HR / quản lý xem)
  noteInternal: { type: String, trim: true },

  // Thông tin liên hệ khẩn cấp
  emergencyContact: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relation: { type: String, trim: true },
  },
});

/* ============================================================
 * HOOKS
 * ============================================================ */
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

  // 4️⃣ Chuẩn hoá taxCode (nếu có)
  if (this.taxCode) {
    this.taxCode = this.taxCode.trim();
  }

  next();
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
  // Khi chưa populate role thì chỉ có ObjectId
  const r = this.role;
  if (!r) return "";
  // Nếu đã populate => r có {slug, name}
  const slug = r.slug || r?.toObject?.()?.slug;
  const name = r.name || r?.toObject?.()?.name;
  return (slug || name || "").toString().toLowerCase();
});

/* ============================================================
 * INDEXES
 * ============================================================ */

// Search tên + địa chỉ
userSchema.index({
  fullName: "text",
  "address.city": 1,
  "address.district": 1,
});

// TTL cho guest account
userSchema.index(
  { guestExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { isGuest: true } }
);

// Index cho mã nhân viên
userSchema.index({ employeeCode: 1 });

// Index cho lọc nhân viên theo trạng thái & nhà hàng
userSchema.index({ userType: 1, employmentStatus: 1, primaryRestaurant: 1 });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
