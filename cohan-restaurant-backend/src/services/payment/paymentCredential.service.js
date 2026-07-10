import crypto from "node:crypto";
import mongoose from "mongoose";
import { PaymentProviderCredential, Restaurant } from "../../../models/index.js";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;
const FALLBACK_DEV_SECRET = "cohan-payment-credential-dev-key-do-not-use-in-production";
const PROVIDERS = ["momo", "vnpay"];
const MODES = ["sandbox", "production"];
let warnedAboutFallbackKey = false;

const isProduction = () => String(process.env.NODE_ENV || "").toLowerCase() === "production";

export function normalizePaymentProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!PROVIDERS.includes(provider)) throw new Error("Unsupported payment provider");
  return provider;
}

export function normalizePaymentMode(value) {
  return String(value || "sandbox").trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function resolveEncryptionSecret() {
  const secret = String(process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY || "").trim();
  if (secret) return secret;
  if (isProduction()) throw new Error("PAYMENT_CREDENTIAL_ENCRYPTION_KEY_REQUIRED");
  if (!warnedAboutFallbackKey) {
    warnedAboutFallbackKey = true;
    // eslint-disable-next-line no-console
    console.warn("[payment] PAYMENT_CREDENTIAL_ENCRYPTION_KEY missing; using development fallback key.");
  }
  return FALLBACK_DEV_SECRET;
}

function deriveKey(secret = resolveEncryptionSecret()) {
  if (/^[a-f0-9]{64}$/i.test(secret)) return Buffer.from(secret, "hex");
  try {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length === 32) return decoded;
  } catch (_) {
    // Fall through to scrypt derivation.
  }
  return crypto.scryptSync(secret, "cohan-payment-credential-v1", 32);
}

export function encryptPaymentCredential(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: VERSION,
    algorithm: ALGORITHM,
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  });
}

export function decryptPaymentCredential(value) {
  let payload;
  try {
    payload = JSON.parse(String(value || ""));
  } catch (_) {
    throw new Error("PAYMENT_CREDENTIAL_DECRYPT_FAILED");
  }
  if (
    payload?.version !== VERSION ||
    payload?.algorithm !== ALGORITHM ||
    !payload.iv ||
    !payload.authTag ||
    !payload.ciphertext
  ) {
    throw new Error("PAYMENT_CREDENTIAL_DECRYPT_FAILED");
  }
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      deriveKey(),
      Buffer.from(payload.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plain);
  } catch (_) {
    throw new Error("PAYMENT_CREDENTIAL_DECRYPT_FAILED");
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export function normalizeCredentialPayload(providerValue, input = {}) {
  const provider = normalizePaymentProvider(providerValue);
  if (provider === "momo") {
    return {
      partnerCode: required(input.partnerCode, "MOMO_PARTNER_CODE"),
      accessKey: required(input.accessKey, "MOMO_ACCESS_KEY"),
      secretKey: required(input.secretKey, "MOMO_SECRET_KEY"),
    };
  }
  return {
    tmnCode: required(input.tmnCode, "VNPAY_TMN_CODE"),
    hashSecret: required(input.hashSecret, "VNPAY_HASH_SECRET"),
    bankCode: String(input.bankCode || "").trim().toUpperCase(),
  };
}

export function maskCredentialIdentifier(providerValue, credentials = {}) {
  const provider = normalizePaymentProvider(providerValue);
  const identifier = provider === "momo" ? credentials.partnerCode : credentials.tmnCode;
  const text = String(identifier || "").trim();
  if (!text) return "";
  if (text.length <= 4) return `••••${text}`;
  return `${text.slice(0, 3)}••••${text.slice(-4)}`;
}

export function getPlatformPaymentCredentials(providerValue) {
  const provider = normalizePaymentProvider(providerValue);
  if (provider === "momo") {
    return {
      partnerCode: String(process.env.MOMO_PARTNER_CODE || "").trim(),
      accessKey: String(process.env.MOMO_ACCESS_KEY || "").trim(),
      secretKey: String(process.env.MOMO_SECRET_KEY || "").trim(),
    };
  }
  return {
    tmnCode: String(process.env.VNPAY_TMN_CODE || "").trim(),
    hashSecret: String(process.env.VNPAY_HASH_SECRET || "").trim(),
    bankCode: String(process.env.VNPAY_BANK_CODE || "").trim().toUpperCase(),
  };
}

export function hasCompletePaymentCredentials(providerValue, credentials = {}) {
  const provider = normalizePaymentProvider(providerValue);
  return provider === "momo"
    ? Boolean(credentials.partnerCode && credentials.accessKey && credentials.secretKey)
    : Boolean(credentials.tmnCode && credentials.hashSecret);
}

export async function getRestaurantProviderMode(restaurantId, providerValue) {
  const provider = normalizePaymentProvider(providerValue);
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) return "sandbox";
  const restaurant = await Restaurant.findById(restaurantId)
    .select({ paymentSettings: 1 })
    .lean();
  const config = restaurant?.paymentSettings?.providers?.find(
    (item) => String(item?.provider || "").toLowerCase() === provider,
  );
  return normalizePaymentMode(config?.mode);
}

export async function saveRestaurantPaymentCredential({
  restaurantId,
  provider: providerValue,
  mode: modeValue,
  credentials,
  actorId,
}) {
  if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const provider = normalizePaymentProvider(providerValue);
  const mode = normalizePaymentMode(modeValue);
  const normalized = normalizeCredentialPayload(provider, credentials);
  const latest = await PaymentProviderCredential.findOne({ restaurantId, provider, mode })
    .sort({ version: -1 })
    .select({ version: 1 })
    .lean();
  await PaymentProviderCredential.updateMany(
    { restaurantId, provider, mode, active: true },
    { $set: { active: false, disconnectedAt: new Date(), updatedBy: actorId || null } },
  );
  return PaymentProviderCredential.create({
    restaurantId,
    provider,
    mode,
    version: Number(latest?.version || 0) + 1,
    active: true,
    encryptedPayload: encryptPaymentCredential(normalized),
    maskedIdentifier: maskCredentialIdentifier(provider, normalized),
    createdBy: actorId || null,
    updatedBy: actorId || null,
    configuredAt: new Date(),
  });
}

export async function disconnectRestaurantPaymentCredential({
  restaurantId,
  provider: providerValue,
  mode: modeValue,
  actorId,
}) {
  if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const provider = normalizePaymentProvider(providerValue);
  const mode = normalizePaymentMode(modeValue);
  await PaymentProviderCredential.updateMany(
    { restaurantId, provider, mode, active: true },
    { $set: { active: false, disconnectedAt: new Date(), updatedBy: actorId || null } },
  );
  return { restaurantId, provider, mode };
}

function serializeStatus({ restaurantId, provider, mode, restaurantCredential }) {
  if (restaurantCredential) {
    return {
      restaurantId: String(restaurantId),
      provider,
      mode,
      configured: true,
      source: "restaurant",
      maskedIdentifier: restaurantCredential.maskedIdentifier || "",
      version: Number(restaurantCredential.version || 1),
      updatedAt: restaurantCredential.updatedAt || restaurantCredential.configuredAt,
    };
  }
  const platformCredentials = getPlatformPaymentCredentials(provider);
  const configured = hasCompletePaymentCredentials(provider, platformCredentials);
  return {
    restaurantId: String(restaurantId),
    provider,
    mode,
    configured,
    source: configured ? "platform" : "none",
    maskedIdentifier: configured
      ? maskCredentialIdentifier(provider, platformCredentials)
      : "",
    version: 0,
    updatedAt: null,
  };
}

export async function listRestaurantPaymentCredentialStatuses(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const activeCredentials = await PaymentProviderCredential.find({
    restaurantId,
    active: true,
  }).lean();
  return PROVIDERS.flatMap((provider) =>
    MODES.map((mode) =>
      serializeStatus({
        restaurantId,
        provider,
        mode,
        restaurantCredential: activeCredentials.find(
          (item) => item.provider === provider && item.mode === mode,
        ),
      }),
    ),
  );
}

export async function resolvePaymentProviderCredential({
  restaurantId,
  provider: providerValue,
  mode: modeValue,
  credentialId = null,
}) {
  const provider = normalizePaymentProvider(providerValue);
  const mode = normalizePaymentMode(modeValue);
  let document = null;
  if (credentialId && mongoose.isValidObjectId(credentialId)) {
    document = await PaymentProviderCredential.findById(credentialId)
      .select("+encryptedPayload")
      .lean();
  } else if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    document = await PaymentProviderCredential.findOne({
      restaurantId,
      provider,
      mode,
      active: true,
    })
      .sort({ version: -1 })
      .select("+encryptedPayload")
      .lean();
  }

  if (document) {
    if (document.provider !== provider || document.mode !== mode) {
      throw new Error("PAYMENT_CREDENTIAL_SCOPE_MISMATCH");
    }
    return {
      credentials: decryptPaymentCredential(document.encryptedPayload),
      source: "restaurant",
      credentialId: document._id,
      mode,
      maskedIdentifier: document.maskedIdentifier || "",
    };
  }

  const credentials = getPlatformPaymentCredentials(provider);
  if (!hasCompletePaymentCredentials(provider, credentials)) {
    throw new Error(
      provider === "momo"
        ? "MoMo chưa có tài khoản merchant hợp lệ cho nhà hàng hoặc nền tảng."
        : "VNPAY chưa có tài khoản merchant hợp lệ cho nhà hàng hoặc nền tảng.",
    );
  }
  return {
    credentials,
    source: "platform",
    credentialId: null,
    mode,
    maskedIdentifier: maskCredentialIdentifier(provider, credentials),
  };
}
