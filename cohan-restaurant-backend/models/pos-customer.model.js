import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const PosCustomerSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  fullName: { type: String, trim: true, default: "" },
  phone: { type: String, trim: true, required: true },
  email: { type: String, trim: true, default: "" },
  defaultAddress: { type: String, trim: true, default: "" },
  addressBook: [
    {
      address: { type: String, trim: true },
      note: { type: String, trim: true, default: "" },
      lastUsedAt: { type: Date, default: Date.now },
    },
  ],
  note: { type: String, trim: true, default: "" },
  source: {
    type: String,
    enum: ["POS", "DELIVERY", "TAKEAWAY"],
    default: "POS",
  },
  orderCount: { type: Number, default: 0 },
  lastOrderAt: { type: Date },
  isActive: { type: Boolean, default: true },
});

PosCustomerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });

export default mongoose.model("PosCustomer", PosCustomerSchema);
