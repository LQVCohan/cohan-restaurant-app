import mongoose from "mongoose";

const { Schema } = mongoose;

const restaurantPayoutAccountSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },
    bankCode: { type: String, default: "" },
    accountNumberEncrypted: { type: String, select: false, required: true },
    accountNumberLast4: { type: String, default: "" },
    provider: { type: String, default: "manual" },
    providerMerchantId: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive", "pending_verification"], default: "pending_verification", index: true },
    payoutEnabled: { type: Boolean, default: false },
    dailyLimit: { type: Number, default: 0 },
    perTransactionLimit: { type: Number, default: 0 },
    currency: { type: String, default: "VND" },
  },
  { timestamps: true },
);

restaurantPayoutAccountSchema.index({ restaurantId: 1, status: 1, payoutEnabled: 1 });

export default mongoose.model("RestaurantPayoutAccount", restaurantPayoutAccountSchema);
