import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const TableEventItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: { type: String, trim: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const TableEventSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    required: true,
  },
  tableCode: { type: String, trim: true },
  eventPackageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventPackage",
  },
  eventName: { type: String, trim: true },
  promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
  promotionCode: { type: String, trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  orderCode: { type: String, trim: true },
  status: { type: String, default: "active" },
  items: { type: [TableEventItemSchema], default: [] },
  note: { type: String, trim: true },
});

TableEventSchema.index({ restaurantId: 1, tableId: 1, createdAt: -1 });

export default mongoose.model("TableEvent", TableEventSchema);
