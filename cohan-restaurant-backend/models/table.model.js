import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const TableSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    floorId: { type: Types.ObjectId, ref: "Floor" },
    code: { type: String, required: true },
    capacity: { type: Number, default: 2 },
    position: { x: Number, y: Number },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "maintenance"],
      default: "available",
    },
  },
  baseOptions
);

TableSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

export default mongoose.model("Table", TableSchema);
