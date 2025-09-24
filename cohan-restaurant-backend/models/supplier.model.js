import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true },
    contact: String,
    phone: String,
    email: String,
    address: String,
  },
  baseOptions
);

SupplierSchema.index({ name: 1 }, { unique: true });

export default mongoose.model("Supplier", SupplierSchema);
