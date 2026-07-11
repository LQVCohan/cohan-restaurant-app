// src/models/table.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const TableStatus = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "offline",
  "payment_pending",
];
export const TableType = [
  "standard",
  "booth",
  "vip",
  "outdoor",
  "bar",
  "private",
];

const normalizeLegacyDate = (value) => (
  Object.prototype.toString.call(value) === "[object Object]" && Object.keys(value).length === 0
    ? null
    : value
);

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
  },
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Floor",
    required: true,
  },

  code: { type: String, required: true, trim: true }, // ký hiệu bàn: T01, B12...
  type: { type: String, enum: TableType, default: "standard" },

  capacity: { type: Number, required: true, min: 1 },

  position: { type: PositionSchema, required: true },

  photos: { type: [String], default: [] }, // ảnh thực tế
  vrUrl: { type: String }, // link 360/VR
  notes: { type: String },
  visualConfig: { type: mongoose.Schema.Types.Mixed, default: null },

  tableAccessToken: { type: String, default: null },
  tableAccessUrl: { type: String, default: null },
  tableQrCodeDataUrl: { type: String, default: null },
  tableQrGeneratedAt: { type: Date, default: null, set: normalizeLegacyDate },
  tableQrExpiresAt: { type: Date, default: null, set: normalizeLegacyDate },

  status: {
    type: String,
    enum: TableStatus,
    default: "available",
  },

  // denormalize để filter/sort nhanh (không join floor khi list)
  floorLevel: { type: Number, default: 1 },

  tags: { type: [String], default: [] },
  zone: { type: String, trim: true },
  promotionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Promotion" }],
  bookingPerks: { type: [String], default: [] },
  reservationHoldMinutes: { type: Number, min: 0 },
  minSpend: { type: Number, min: 0 },
  cancelPolicy: { type: String, trim: true },

  isJoinable: { type: Boolean, default: false },
  joinGroupId: { type: String },
  // Bàn ghép mới giữ danh sách bàn vật lý; bàn vật lý trỏ về bàn ghép để tạm ẩn.
  mergedFromTableIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
  ],
  mergeAnchorTableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    default: null,
  },
  mergedAt: { type: Date, default: null, set: normalizeLegacyDate },
  mergedIntoTableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    default: null,
  },
  deposit: { type: Number, default: 0 },

  viewLock: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, set: normalizeLegacyDate },
    sessionId: { type: String },
    viewerName: { type: String },
  },
});

// Không trùng code trong cùng floor của cùng nhà hàng
TableSchema.index({ restaurantId: 1, floorId: 1, code: 1 }, { unique: true });
// Truy vấn nhanh theo status/capacity/type
TableSchema.index({ restaurantId: 1, status: 1, capacity: 1 });
TableSchema.index({ restaurantId: 1, type: 1 });
TableSchema.index({ restaurantId: 1, mergedIntoTableId: 1 });
TableSchema.index({ "viewLock.expiresAt": 1 });

export default mongoose.model("Table", TableSchema);
