// src/models/Shift.js
import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    shiftType: {
      type: String,
      enum: ["morning", "afternoon", "evening", "full_day", "rotating"],
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "pending"],
      default: "scheduled",
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Shift", shiftSchema);
