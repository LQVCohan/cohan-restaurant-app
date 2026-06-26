// src/models/invoice.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const { Schema, Types } = mongoose;

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
    totals: { type: Number, required: true }, // (price + modifiersPrice) * quantity
    modifiers: [
      {
        optionId: Types.ObjectId,
        optionName: String,
        groupId: Types.ObjectId,
        price: Number,
      },
    ],
  },
  { _id: false },
);

// Tong tien (chi tiet)
const InvoiceTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    discountReason: { type: String },
    voucherCode: { type: String },
    promotionId: { type: Types.ObjectId, ref: "Promotion" },
    grandTotal: { type: Number, required: true }, // subtotal - discount + tax + service
  },
  { _id: false },
);

const InvoiceSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    orderIds: [{ type: Types.ObjectId, ref: "Order" }],
    userId: { type: Types.ObjectId, ref: "User" },
    tableCode: { type: String },

    // So hoa don tang dan, hien thi cho khach (vd. INV-2025-000123)
    number: { type: String },

    // Thoi diem phat hanh hoa don
    issuedAt: { type: Date, required: true },

    // Dong hang
    lines: [InvoiceLineSchema],

    // Tong tien chi tiet
    totals: { type: InvoiceTotalsSchema, required: true },

    // So tien da thanh toan tren hoa don (luy ke)
    paid: { type: Number, default: 0 },

    // Trang thai thanh toan cua hoa don
    status: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID", "VOID"],
      default: "UNPAID",
      index: true,
    },

    // Tien te hien thi tren hoa don
    currency: { type: String, default: "VND" },

    // Tham chieu giao dich thanh toan moi nhat (PaymentTransaction._id)
    refTransactionId: { type: Types.ObjectId, ref: "PaymentTransaction" },
    meta: { type: Schema.Types.Mixed },

    // (tuy chon) ma/QR hien thi cho khach, neu ban van can
    code: { type: String },
  },
  {},
);

InvoiceSchema.index({ restaurantId: 1, orderId: 1 });
InvoiceSchema.index({ restaurantId: 1, orderIds: 1 });
InvoiceSchema.index({ number: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ code: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ refTransactionId: 1 }, { unique: true, sparse: true });

export const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
export default Invoice;
