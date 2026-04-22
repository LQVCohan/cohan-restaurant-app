import mongoose from "mongoose";

const employeeCodeCounterSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
      index: true,
    },
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const EmployeeCodeCounter =
  mongoose.models.EmployeeCodeCounter ||
  mongoose.model("EmployeeCodeCounter", employeeCodeCounterSchema);

export default EmployeeCodeCounter;
