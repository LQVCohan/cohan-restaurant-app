import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Types } = mongoose;

/**
 * Reservation Schema (Đặt bàn)
 * - Tự động có createdAt, updatedAt và virtual id
 * - Dùng BaseSchemaModel để đồng nhất cấu trúc
 */
const ReservationSchema = BaseSchemaModel(
  {
    // --- Thông tin cơ bản ---
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    restaurantName: { type: String, default: "" },
    tableId: {
      type: Types.ObjectId,
      ref: "Table",
      required: true,
    },

    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Thời gian ---
    timeFrom: { type: Date, required: true },
    durationMinutes: { type: Number, default: 90 },

    // --- Thông tin khách hàng ---
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerEmail: { type: String, trim: true },

    // --- Số lượng và ghi chú ---
    partySize: { type: Number, default: 2 },
    note: { type: String, trim: true },

    // --- Đặt cọc / thanh toán ---
    depositAmount: { type: Number, default: 0 },
    depositTxnId: { type: Types.ObjectId, ref: "PaymentTransaction" },
    depositStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "refunded", "cancelled"],
      default: "pending",
    },

    // --- Trạng thái đặt bàn ---
    status: {
      type: String,
      enum: [
        "pending_payment", // chờ thanh toán trong 10p
        "confirmed", // đã cọc
        "seated", // khách đã đến
        "cancelled", // khách hủy hoặc hệ thống tự hủy
        "completed", // kết thúc
        "no_show", // không đến
      ],
      default: "pending_payment",
    },

    // --- Tự động hủy nếu quá hạn ---
    pendingPaymentExpiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },

    // --- Mã đặt bàn, sinh tự động ---
    orderCode: {
      type: String,
      unique: true,
    },
  },
  {
    collection: "reservations",
  }
);

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

// Tự sinh mã đặt bàn ngắn (vd: RES-20251019-ABC123)
ReservationSchema.pre("save", function (next) {
  if (!this.orderCode) {
    const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const datePart = new Date().toISOString().split("T")[0].replace(/-/g, "");
    this.orderCode = `RES-${datePart}-${shortId}`;
  }

  // Nếu trạng thái là pending_payment mà chưa có expireAt → đặt TTL 10 phút
  if (this.status === "pending_payment" && !this.pendingPaymentExpiresAt) {
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    this.pendingPaymentExpiresAt = expires;
  }

  next();
});

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

ReservationSchema.index({ restaurantId: 1, timeFrom: 1 });
ReservationSchema.index({ userId: 1 });
ReservationSchema.index({ status: 1 });

// Khi reservation hết TTL, MongoDB tự xóa document → FE có thể query thất bại = đã hết hạn
// hoặc BE có cron check trước khi xóa để cập nhật status = "cancelled"

// ─────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────

// Virtual: thời gian kết thúc
ReservationSchema.virtual("timeTo").get(function () {
  if (!this.timeFrom || !this.durationMinutes) return null;
  return new Date(this.timeFrom.getTime() + this.durationMinutes * 60000);
});

export default mongoose.model("Reservation", ReservationSchema);
