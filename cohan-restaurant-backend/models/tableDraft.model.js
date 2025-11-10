// src/models/tableDraft.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const tableDraftSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    index: true,
  },
  tableCode: { type: String, index: true },

  customerName: String,
  customerPhone: String,
  customerEmail: String,
  note: String,
  partySize: Number,
  timeTo: Date,

  // TTL
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } }, // MongoDB TTL
});

/**
 * Duy nhất theo (restaurantId + tableId) nếu có tableId,
 * nếu không có tableId thì duy nhất theo (restaurantId + tableCode).
 * Ta dùng index riêng để cover cả 2 trường hợp.
 */
tableDraftSchema.index(
  { restaurantId: 1, tableId: 1 },
  { unique: true, partialFilterExpression: { tableId: { $type: "objectId" } } }
);

export default mongoose.model("TableDraft", tableDraftSchema);
