// src/models/tableCustomer.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const tableCustomerSchema = BaseSchemaModel({
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

  // Thông tin khách hàng
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  note: String,
  dietaryNotes: String,
  customerPreferences: String,

  // Thông tin thêm cho bàn/khách
  partySize: Number,
  timeFrom: Date,
  timeTo: Date,
});

/**
 * Duy nhất theo (restaurantId + tableId) nếu có tableId
 */
tableCustomerSchema.index(
  { restaurantId: 1, tableId: 1 },
  { unique: true, partialFilterExpression: { tableId: { $type: "objectId" } } }
);

/**
 * Duy nhất theo (restaurantId + tableCode) nếu có tableCode
 */
tableCustomerSchema.index(
  { restaurantId: 1, tableCode: 1 },
  { unique: true, partialFilterExpression: { tableCode: { $type: "string" } } }
);

export default mongoose.model("TableCustomer", tableCustomerSchema);
