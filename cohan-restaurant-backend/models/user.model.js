// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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

const userSchema = new mongoose.Schema(
  {
    // Hiển thị / tìm kiếm
    fullName: { type: String, trim: true },

    // Định danh
    username: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
      sparse: true, // cho phép null mà vẫn unique khi có giá trị
    },

    // Liên hệ
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },

    address: addressSchema,

    // Bảo mật
    passwordHash: { type: String }, // không lưu mật khẩu thô
    provider: {
      type: String,
      enum: ["local", "google", "facebook", "apple", "other"],
      default: "local",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "blocked", "pending"],
      default: "active",
      index: true,
    },

    // Quyền (tham chiếu Role) — giữ nguyên kiểu bạn đang dùng
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],

    // Nhà hàng đã tương tác gần đây
    refRestaurants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
    ],

    // Điểm & phân hạng khách hàng

    loyaltyPoints: { type: Number, default: 0 },
    customerType: {
      type: String,
      enum: ["VIP", "NEW", "OFTEN"],
      default: "NEW",
      index: true,
    },

    // Thống kê
    totalOrders: { type: Number, default: 0 },
    totalSpending: { type: Number, default: 0 },
  },
  {
    timestamps: true, // createdAt = ngày tạo tài khoản, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id
userSchema.virtual("id").get(function () {
  return String(this._id);
});

// Helpers cho mật khẩu
userSchema.methods.setPassword = async function (plain) {
  if (!plain) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.checkPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

// Optional: index thêm phục vụ tìm kiếm
userSchema.index({
  fullName: "text",
  "address.city": 1,
  "address.district": 1,
});

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
