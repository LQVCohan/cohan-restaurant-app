import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;
const EXTERNAL_PROVIDERS = new Set(["momo", "vnpay"]);

export function resolvePaymentRuntimeMode(mode, env = process.env) {
  const requestedMode =
    String(mode || "sandbox").trim().toLowerCase() === "production"
      ? "production"
      : "sandbox";
  const productionAllowed =
    String(env.NODE_ENV || "development").trim().toLowerCase() === "production" ||
    String(env.PAYMENT_ALLOW_PRODUCTION_IN_DEVELOPMENT || "")
      .trim()
      .toLowerCase() === "true";

  // ponytail: local development must not reach a real payment gateway by accident.
  return requestedMode === "production" && !productionAllowed
    ? "sandbox"
    : requestedMode;
}

const PaymentEventSchema = new Schema(
  {
    type: { type: String, required: true },
    at: { type: Date, default: Date.now },
    payload: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const TransferPaymentSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "NOT_REQUIRED",
        "INSTRUCTIONS_SHOWN",
        "SUBMITTED",
        "VERIFYING",
        "VERIFIED",
        "REJECTED",
        "FAILED",
        "EXPIRED",
      ],
      default: "NOT_REQUIRED",
      index: true,
    },
    instructionsShownAt: { type: Date },
    submittedAt: { type: Date },
    submittedBy: { type: Types.ObjectId, ref: "User" },
    proofImages: { type: [String], default: [] },
    proofNote: { type: String, trim: true },
    customerClaimedPaidAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectedBy: { type: Types.ObjectId, ref: "User" },
    rejectReason: { type: String, trim: true },
    providerTransactionId: { type: String, trim: true },
    receivedAmount: { type: Number, min: 0 },
    varianceAmount: { type: Number },
    matchedBankTransactionId: { type: Types.ObjectId, ref: "BankTransaction", index: true },
    matchedReconciliationId: { type: Types.ObjectId, ref: "PaymentReconciliation", index: true },
    rejectedCount: { type: Number, default: 0, min: 0 },
    maxRejectedCount: { type: Number, default: 3, min: 1 },
    lastRejectedAt: { type: Date },
    lastRejectedReason: { type: String, trim: true },
    reminderShownAt: { type: Date },
    pausedAt: { type: Date },
    resumedAt: { type: Date },
    proofCycleStartedAt: { type: Date },
  },
  { _id: false }
);

const PaymentSessionSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
  orderId: { type: Types.ObjectId, ref: "Order", index: true },
  reservationId: { type: Types.ObjectId, ref: "Reservation", index: true },
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },

  provider: {
    type: String,
    enum: ["momo", "vnpay", "bank_transfer"],
    required: true,
    index: true,
  },
  paymentMethod: { type: String, default: "qr" },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "cancelled", "expired"],
    default: "pending",
    index: true,
  },
  callbackStatus: {
    type: String,
    enum: ["none", "received", "verified", "rejected"],
    default: "none",
  },

  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "VND" },

  requestId: { type: String, required: true, index: true },
  reference: { type: String, required: true, index: true },
  providerTransactionId: { type: String, index: true },
  providerCredentialId: { type: Types.ObjectId, ref: "PaymentProviderCredential", index: true },
  providerCredentialSource: { type: String, enum: ["restaurant", "platform"] },
  providerCredentialMode: { type: String, enum: ["sandbox", "production"] },
  payUrl: { type: String },
  deeplink: { type: String },
  qrCodeUrl: { type: String },

  callbackAt: { type: Date },
  reconciledAt: { type: Date },
  expiresAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: Types.ObjectId, ref: "User" },
  cancelReason: { type: String },

  providerResponseRaw: { type: Schema.Types.Mixed },
  callbackRaw: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed },
  transfer: { type: TransferPaymentSchema, default: () => ({}) },

  events: { type: [PaymentEventSchema], default: [] },
});

PaymentSessionSchema.pre("save", async function attachRestaurantCredential() {
  if (!this.isNew || !this.restaurantId || !EXTERNAL_PROVIDERS.has(String(this.provider))) return;
  const {
    getRestaurantProviderMode,
    resolvePaymentProviderCredential,
  } = await import("../src/services/payment/paymentCredential.service.js");
  const configuredMode = await getRestaurantProviderMode(
    this.restaurantId,
    this.provider,
  );
  const mode = resolvePaymentRuntimeMode(configuredMode);
  const resolved = await resolvePaymentProviderCredential({
    restaurantId: this.restaurantId,
    provider: this.provider,
    mode,
  });
  if (resolvePaymentRuntimeMode(resolved.mode) !== resolved.mode) {
    throw new Error("PAYMENT_PRODUCTION_DISABLED_IN_DEVELOPMENT");
  }
  this.providerCredentialId = resolved.credentialId || undefined;
  this.providerCredentialSource = resolved.source;
  this.providerCredentialMode = resolved.mode;
  this.$locals.paymentProviderCredentials = resolved.credentials;
});

PaymentSessionSchema.post("findOne", async function primeCallbackCredential(payment) {
  const query = this.getQuery?.() || {};
  if (
    !payment ||
    !query.provider ||
    !query.reference ||
    !EXTERNAL_PROVIDERS.has(String(payment.provider))
  ) return;
  try {
    const { resolvePaymentProviderCredential } = await import("../src/services/payment/paymentCredential.service.js");
    const { primePaymentCredentialContext } = await import("../src/services/payment/providers.js");
    const resolved = await resolvePaymentProviderCredential({
      restaurantId: payment.restaurantId,
      provider: payment.provider,
      mode: payment.providerCredentialMode || "sandbox",
      credentialId: payment.providerCredentialId,
    });
    payment.$locals.paymentProviderCredentials = resolved.credentials;
    primePaymentCredentialContext(payment.provider, payment.reference, resolved.credentials);
  } catch (_) {
    // Verification will safely fall back to platform credentials and reject on mismatch.
  }
});

PaymentSessionSchema.index({ provider: 1, reference: 1 }, { unique: true });
PaymentSessionSchema.index({ provider: 1, requestId: 1 });
PaymentSessionSchema.index({ reservationId: 1, createdAt: -1 });
PaymentSessionSchema.index({ orderId: 1, createdAt: -1 });
PaymentSessionSchema.index({ "transfer.status": 1, createdAt: -1 });

export default mongoose.models.PaymentSession ||
  mongoose.model("PaymentSession", PaymentSessionSchema);
