import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const ReservationSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    tableIds: [{ type: Types.ObjectId, ref: "Table" }],
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    timeFrom: { type: Date, required: true },
    timeTo: { type: Date, required: true },
    partySize: { type: Number, default: 2 },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "seated",
        "cancelled",
        "completed",
        "no_show",
      ],
      default: "pending",
    },
    depositTxnId: { type: Types.ObjectId, ref: "PaymentTransaction" },
  },
  baseOptions
);

ReservationSchema.index({ restaurantId: 1, timeFrom: 1, timeTo: 1 });

export default mongoose.model("Reservation", ReservationSchema);
