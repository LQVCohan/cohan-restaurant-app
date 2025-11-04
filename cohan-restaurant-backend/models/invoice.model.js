import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js"; // Giả định
const { Schema, Types } = mongoose;

// Schema này đã được "đồng bộ" với OrderItem GQL
const InvoiceLineSchema = new Schema(
  {
    dishId: { type: String },
    menuId: { type: String },
    categoryId: { type: String },
    name: { type: String, required: true },
    unit: { type: String },
    price: { type: Number, required: true },
    modifiersPrice: { type: Number, default: 0 },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true }, // = (price + modifiersPrice) * quantity
    modifiers: [
      {
        optionId: Types.ObjectId,
        optionName: String,
        groupId: Types.ObjectId,
        price: Number,
      },
    ],
  },
  { _id: false }
);

// Đồng bộ với OrderTotals GQL
const InvoiceTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Types.ObjectId, ref: "Order", required: true },
    userId: { type: Types.ObjectId, ref: "User" },
    tableCode: { type: String },
    lines: [InvoiceLineSchema],
    totals: { type: InvoiceTotalsSchema, required: true },
    code: { type: String, unique: true, sparse: true }, // Mã hóa đơn
  },
  {}
);

InvoiceSchema.index({ restaurantId: 1, orderId: 1 });
InvoiceSchema.index({ code: 1 });

export default mongoose.models.Invoice ||
  mongoose.model("Invoice", InvoiceSchema);
