import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const TimesheetSchema = new Schema(
  {
    shiftId: { type: Types.ObjectId, ref: "Shift", required: true },
    hours: { type: Number, default: 0 },
    wage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  baseOptions
);

export default mongoose.model("Timesheet", TimesheetSchema);
