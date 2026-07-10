import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const PaymentProviderCredentialSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  provider: { type: String, enum: ["momo", "vnpay"], required: true, index: true },
  mode: { type: String, enum: ["sandbox", "production"], default: "sandbox", index: true },
  version: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true, index: true },
  encryptedPayload: { type: String, required: true, select: false },
  maskedIdentifier: { type: String, default: "" },
  createdBy: { type: Types.ObjectId, ref: "User" },
  updatedBy: { type: Types.ObjectId, ref: "User" },
  configuredAt: { type: Date, default: Date.now },
  disconnectedAt: { type: Date },
});

PaymentProviderCredentialSchema.index(
  { restaurantId: 1, provider: 1, mode: 1, version: 1 },
  { unique: true },
);
PaymentProviderCredentialSchema.index(
  { restaurantId: 1, provider: 1, mode: 1, active: 1, version: -1 },
);

export default mongoose.models.PaymentProviderCredential ||
  mongoose.model("PaymentProviderCredential", PaymentProviderCredentialSchema);
