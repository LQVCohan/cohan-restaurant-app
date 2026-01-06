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
  { _id: false }
);

// Tổng tiền (chi tiết)
const InvoiceTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true }, // subtotal - discount + tax + service
  },
  { _id: false }
);

const InvoiceSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    orderIds: [{ type: Types.ObjectId, ref: "Order" }],
    userId: { type: Types.ObjectId, ref: "User" },
    tableCode: { type: String },

    // Số hoá đơn tăng dần, hiển thị cho khách (vd. INV-2025-000123)
    number: { type: String, unique: true, sparse: true },

    // Thời điểm phát hành hoá đơn
    issuedAt: { type: Date, required: true },

    // Dòng hàng
    lines: [InvoiceLineSchema],

    // Tổng tiền chi tiết
    totals: { type: InvoiceTotalsSchema, required: true },

    // Số tiền đã thanh toán trên hoá đơn (lũy kế)
    paid: { type: Number, default: 0 },

    // Trạng thái thanh toán của hoá đơn
    status: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID", "VOID"],
      default: "UNPAID",
      index: true,
    },

    // Tiền tệ hiển thị trên hoá đơn
    currency: { type: String, default: "VND" },

    // Tham chiếu giao dịch thanh toán mới nhất (PaymentTransaction._id)
    refTransactionId: { type: Types.ObjectId, ref: "PaymentTransaction" },

    // (tuỳ chọn) mã/QR hiển thị cho khách, nếu bạn vẫn cần
    code: { type: String, unique: true, sparse: true },
  },
  {}
);

InvoiceSchema.index({ restaurantId: 1, orderId: 1 });
InvoiceSchema.index({ restaurantId: 1, orderIds: 1 });
InvoiceSchema.index({ number: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ code: 1 }, { unique: true, sparse: true });

export const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
export default Invoice;
