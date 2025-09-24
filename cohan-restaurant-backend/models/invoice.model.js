import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const InvoiceLineSchema = new Schema(
  {
    name: String,
    qty: Number,
    price: Number,
    total: Number,
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },
    lines: [InvoiceLineSchema],
    tax: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    total: { type: Number, required: true },
    code: { type: String, unique: true, sparse: true },
  },
  baseOptions
);

export default mongoose.model("Invoice", InvoiceSchema);
