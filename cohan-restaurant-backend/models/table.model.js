// src/models/table.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const TableStatus = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "offline",
];
export const TableType = [
  "standard",
  "booth",
  "vip",
  "outdoor",
  "bar",
  "private",
];

// Subschema cho vị trí (không cần timestamps/virtual id)
const PositionSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    rotation: { type: Number, default: 0 },
    shape: {
      type: String,
      enum: ["rect", "circle", "custom"],
      default: "rect",
    },
    w: { type: Number, default: 80 },
    h: { type: Number, default: 80 },
    path: { type: String }, // SVG path nếu shape=custom
  },
  { _id: false }
);

// Top-level schema dùng BaseSchemaModel để có virtual id + lean virtuals
const TableSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Floor",
    required: true,
    index: true,
  },

  code: { type: String, required: true, trim: true }, // ký hiệu bàn: T01, B12...
  type: { type: String, enum: TableType, default: "standard", index: true },

  capacity: { type: Number, required: true, min: 1 },

  position: { type: PositionSchema, required: true },

  photos: { type: [String], default: [] }, // ảnh thực tế
  vrUrl: { type: String }, // link 360/VR
  notes: { type: String },

  status: {
    type: String,
    enum: TableStatus,
    default: "available",
    index: true,
  },

  // denormalize để filter/sort nhanh (không join floor khi list)
  floorLevel: { type: Number, default: 1, index: true },

  tags: { type: [String], default: [] },

  isJoinable: { type: Boolean, default: false },
  joinGroupId: { type: String },
  deposit: { type: Number, default: 1 },
});

// Không trùng code trong cùng floor của cùng nhà hàng
TableSchema.index({ restaurantId: 1, floorId: 1, code: 1 }, { unique: true });
// Truy vấn nhanh theo status/capacity/type
TableSchema.index({ restaurantId: 1, status: 1, capacity: 1 });
TableSchema.index({ restaurantId: 1, type: 1 });

export default mongoose.model("Table", TableSchema);
