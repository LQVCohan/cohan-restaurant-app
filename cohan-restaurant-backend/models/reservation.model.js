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
    timeTo: { type: Date, required: true },
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
    },

  },
  {
    collection: "reservations",
  }
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

ReservationSchema.index({ restaurantId: 1, timeTo: 1 });
ReservationSchema.index({ userId: 1 });
ReservationSchema.index({ status: 1 });
ReservationSchema.index({ pendingPaymentExpiresAt: 1, status: 1 });
// Khi reservation hết TTL, MongoDB tự xóa document → FE có thể query thất bại = đã hết hạn
// hoặc BE có cron check trước khi xóa để cập nhật status = "cancelled"

export const Reservation = mongoose.model("Reservation", ReservationSchema);
export default Reservation;
