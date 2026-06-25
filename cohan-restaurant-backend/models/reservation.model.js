import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import generateOrderCode from "../utils/generateOrderCode.js";

const { Types } = mongoose;

const ReservationSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    restaurantName: { type: String, default: "" },
    tableId: { type: Types.ObjectId, ref: "Table", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },

    orderCode: { type: String, index: true },

    timeTo: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60, min: 0 },
    isUnlimitedTime: { type: Boolean, default: false },

    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerEmail: { type: String, trim: true },

    partySize: { type: Number, default: 2, min: 1 },
    note: { type: String, trim: true },

    linkedMenuSubtotal: { type: Number, default: 0, min: 0 },
    depositAmount: { type: Number, default: 0, min: 0 },
    depositTxnId: { type: Types.ObjectId, ref: "PaymentTransaction" },
    depositStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },

    paymentMethod: { type: String, default: "momo" },
    paymentReference: { type: String },

    status: {
      type: String,
      enum: [
        "pending_payment",
        "confirmed",
        "seated",
        "pending_change",
        "cancelled",
        "completed",
        "no_show",
      ],
      default: "pending_payment",
      index: true,
    },

    pendingPaymentExpiresAt: { type: Date, index: true },

    changeRequestType: { type: String, enum: ["time", "table", "none"], default: "none" },
    changeRequestStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected"],
      default: "none",
    },
    changeRequestFee: { type: Number, default: 0, min: 0 },
    requestedTimeTo: { type: Date },
    requestedDurationMinutes: { type: Number, min: 0 },
    requestedTableId: { type: Types.ObjectId, ref: "Table" },

    // Customer-side history hiding only. This must not change the business status
    // of the reservation, unlike manager no-show/cancel workflows.
    hiddenFromCustomerUserIds: [{ type: Types.ObjectId, ref: "User", index: true }],
  },
  { collection: "reservations" }
);

ReservationSchema.pre("validate", function (next) {
  if (!this.orderCode) {
    this.orderCode = generateOrderCode("RSV", new Date(), null);
  }

  if (this.isUnlimitedTime) {
    this.durationMinutes = 0;
  } else if (!this.durationMinutes || this.durationMinutes <= 0) {
    this.durationMinutes = 60;
  }

  if (this.status === "pending_payment" && !this.pendingPaymentExpiresAt) {
    this.pendingPaymentExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  }

  if (this.status !== "pending_payment") {
    this.pendingPaymentExpiresAt = null;
  }

  next();
});

ReservationSchema.index({ restaurantId: 1, tableId: 1, timeTo: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ userId: 1, hiddenFromCustomerUserIds: 1, createdAt: -1 });
ReservationSchema.index({ orderCode: 1 });

export const Reservation = mongoose.model("Reservation", ReservationSchema);
export default Reservation;
