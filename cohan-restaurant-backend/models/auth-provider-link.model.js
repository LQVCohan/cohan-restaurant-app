import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const AuthProviderLinkSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["google", "facebook"], required: true },
    providerUserId: { type: String, required: true },
    meta: Schema.Types.Mixed,
  },
  baseOptions
);

AuthProviderLinkSchema.index(
  { provider: 1, providerUserId: 1 },
  { unique: true }
);

export default mongoose.model("AuthProviderLink", AuthProviderLinkSchema);
