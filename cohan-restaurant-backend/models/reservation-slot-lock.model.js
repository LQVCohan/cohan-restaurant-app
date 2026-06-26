import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Types } = mongoose;

const ReservationSlotLockSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    tableId: { type: Types.ObjectId, ref: "Table", required: true, index: true },
    reservationId: { type: Types.ObjectId, ref: "Reservation", required: true },
    userId: { type: Types.ObjectId, ref: "User", index: true },
    customerKey: { type: String, trim: true, index: true },
    slotStart: { type: Date, required: true, index: true },
    slotEnd: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["holding", "confirmed", "released", "expired", "cancelled"],
      default: "holding",
    },
    expiresAt: { type: Date },
  },
  { collection: "reservation_slot_locks" }
);

ReservationSlotLockSchema.index({ restaurantId: 1, tableId: 1, slotStart: 1, slotEnd: 1 });
ReservationSlotLockSchema.index({ expiresAt: 1 });
ReservationSlotLockSchema.index({ reservationId: 1 });
ReservationSlotLockSchema.index({ status: 1 });

export const ReservationSlotLock = mongoose.model("ReservationSlotLock", ReservationSlotLockSchema);
export default ReservationSlotLock;
