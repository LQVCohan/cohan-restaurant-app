import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  EmployeeBankAccount,
  PayrollItem,
  PayrollPayment,
  PayrollPayout,
  PayrollPayoutBatch,
  PayrollPeriod,
  RestaurantPayoutAccount,
} from "../../../models/index.js";
import { markPayrollItemPaid } from "./payrollPayment.service.js";

const BANK_ACCOUNT_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const BANK_ACCOUNT_ENCRYPTION_VERSION = 1;
const FALLBACK_DEV_SECRET = "cohan-payroll-dev-test-bank-account-key-do-not-use-in-production";
let warnedAboutFallbackKey = false;

const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["success", "succeeded", "paid", "completed"].includes(value)) return "success";
  if (["failed", "failure", "error", "rejected"].includes(value)) return "failed";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["pending", "queued"].includes(value)) return "pending";
  if (["processing", "in_progress", "running"].includes(value)) return "processing";
  return "processing";
};

const isProduction = () => String(process.env.NODE_ENV || "").toLowerCase() === "production";

function resolveEncryptionSecret() {
  const secret = process.env.PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY;
  if (secret) return secret;
  if (isProduction()) throw new Error("PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY_REQUIRED");
  if (!warnedAboutFallbackKey) {
    warnedAboutFallbackKey = true;
    // eslint-disable-next-line no-console
    console.warn("[payroll] PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY missing; using deterministic dev/test fallback key. Do not use this fallback in production.");
  }
  return FALLBACK_DEV_SECRET;
}

function deriveEncryptionKey(secret = resolveEncryptionSecret()) {
  const text = String(secret || "");
  if (!text && isProduction()) throw new Error("PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY_REQUIRED");

  if (/^[a-f0-9]{64}$/i.test(text)) return Buffer.from(text, "hex");
  try {
    const decoded = Buffer.from(text, "base64");
    if (decoded.length === 32) return decoded;
  } catch (_) {
    // Fall through to scrypt derivation.
  }
  return crypto.scryptSync(text, "cohan-payroll-bank-account-v1", 32);
}

function encodeBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function tryDecodeLegacyBase64(value) {
  const text = String(value || "");
  if (!text || text.trim().startsWith("{")) return null;
  try {
    const decoded = Buffer.from(text, "base64").toString("utf8");
    if (/^[\d\s-]{4,}$/.test(decoded)) return decoded;
  } catch (_) {
    return null;
  }
  return null;
}

export function encryptAccountNumber(value) {
  const accountNumber = String(value || "").trim();
  if (!accountNumber) return "";
  const iv = crypto.randomBytes(12);
  const key = deriveEncryptionKey();
  const cipher = crypto.createCipheriv(BANK_ACCOUNT_ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    version: BANK_ACCOUNT_ENCRYPTION_VERSION,
    algorithm: BANK_ACCOUNT_ENCRYPTION_ALGORITHM,
    iv: encodeBase64Url(iv),
    authTag: encodeBase64Url(authTag),
    ciphertext: encodeBase64Url(ciphertext),
  });
}

export function decryptAccountNumber(value) {
  const encrypted = String(value || "").trim();
  if (!encrypted) return "";
  const legacy = tryDecodeLegacyBase64(encrypted);
  if (legacy) return legacy;
  let payload;
  try {
    payload = JSON.parse(encrypted);
  } catch (err) {
    throw new Error("PAYROLL_BANK_ACCOUNT_DECRYPT_FAILED");
  }
  if (payload?.algorithm !== BANK_ACCOUNT_ENCRYPTION_ALGORITHM || !payload.iv || !payload.authTag || !payload.ciphertext) {
    throw new Error("PAYROLL_BANK_ACCOUNT_DECRYPT_FAILED");
  }
  const decipher = crypto.createDecipheriv(BANK_ACCOUNT_ENCRYPTION_ALGORITHM, deriveEncryptionKey(), decodeBase64Url(payload.iv));
  decipher.setAuthTag(decodeBase64Url(payload.authTag));
  return Buffer.concat([decipher.update(decodeBase64Url(payload.ciphertext)), decipher.final()]).toString("utf8");
}

export const last4 = (value) => String(value || "").replace(/\s+/g, "").slice(-4);
const maskLast4 = (digits) => (digits ? `****${String(digits).slice(-4)}` : "");

class ManualPayoutProvider {
  async createPayout(payload) {
    return { status: "success", providerTransactionId: payload.requestId, raw: { mode: "manual" } };
  }
  async createBatchPayout(payload) {
    return { status: "success", providerTransactionId: payload.requestId, raw: { mode: "manual", count: payload.items?.length || 0 } };
  }
  async getPayoutStatus() { return { status: "success" }; }
  async handleWebhook(payload) { return payload; }
}
class MockPayoutProvider extends ManualPayoutProvider {
  async createPayout(payload) {
    const note = String(payload.note || "").toLowerCase();
    const fail = note.includes("fail");
    const processing = note.includes("processing") || note.includes("pending");
    const status = fail ? "failed" : processing ? "processing" : "success";
    return { status, providerTransactionId: `mock_${payload.requestId}`, failureReason: fail ? "Mock payout failed" : "", raw: { mode: "mock", status } };
  }
  async createBatchPayout(payload) {
    return { status: "processing", providerTransactionId: `mock_batch_${payload.requestId}`, raw: { mode: "mock", count: payload.items?.length || 0 } };
  }
}
class FutureBankPayoutProvider extends ManualPayoutProvider {
  async createPayout() { throw new Error("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED"); }
  async createBatchPayout() { throw new Error("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED"); }
}

export function getPayrollPayoutProvider() {
  const mode = String(process.env.PAYROLL_PAYOUT_MODE || "manual").toLowerCase();
  const provider = String(process.env.PAYROLL_PAYOUT_PROVIDER || mode || "manual").toLowerCase();
  if (mode === "mock" || provider === "mock") return new MockPayoutProvider();
  if (mode === "provider") return new FutureBankPayoutProvider();
  return new ManualPayoutProvider();
}

function mapPayout(row) {
  return row && {
    id: String(row._id || row.id),
    restaurantId: String(row.restaurantId),
    periodId: String(row.periodId),
    payrollItemId: row.payrollItemId ? String(row.payrollItemId) : null,
    employeeId: row.employeeId ? String(row.employeeId) : null,
    payoutBatchId: row.payoutBatchId ? String(row.payoutBatchId) : null,
    amount: Number(row.amount || 0),
    currency: row.currency || "VND",
    sourceAccountId: row.sourceAccountId ? String(row.sourceAccountId) : null,
    destinationAccountName: row.destinationAccountName || "",
    destinationBankName: row.destinationBankName || "",
    destinationBankCode: row.destinationBankCode || "",
    destinationAccountNumberMasked: row.destinationAccountNumberMasked || "",
    provider: row.provider || "manual",
    providerTransactionId: row.providerTransactionId || "",
    requestId: row.requestId || "",
    idempotencyKey: row.idempotencyKey || "",
    status: row.status || "pending",
    failureReason: row.failureReason || "",
    method: row.method || "bank_transfer",
    note: row.note || "",
    referenceCode: row.referenceCode || "",
    requestedBy: row.requestedBy ? String(row.requestedBy) : null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    paidAt: row.paidAt || null,
    retryCount: Number(row.retryCount || 0),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}
export const mapPayrollPayoutToGql = mapPayout;
export const mapPayoutBatchToGql = (row) => row && ({
  id: String(row._id || row.id),
  restaurantId: String(row.restaurantId),
  periodId: String(row.periodId),
  totalAmount: Number(row.totalAmount || 0),
  totalEmployees: Number(row.totalEmployees || 0),
  successCount: Number(row.successCount || 0),
  processingCount: Number(row.processingCount || 0),
  failedCount: Number(row.failedCount || 0),
  status: row.status || "pending",
  method: row.method || "bank_transfer",
  provider: row.provider || "manual",
  requestedBy: row.requestedBy ? String(row.requestedBy) : null,
  approvedBy: row.approvedBy ? String(row.approvedBy) : null,
  submittedAt: row.submittedAt || null,
  completedAt: row.completedAt || null,
  note: row.note || "",
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

export async function listPayrollPayouts({ periodId, employeeId = null, status = null }) {
  const q = { periodId: toObjectId(periodId) };
  if (employeeId) q.employeeId = toObjectId(employeeId);
  if (status) q.status = status;
  const rows = await PayrollPayout.find(q).sort({ createdAt: -1 }).lean();
  return rows.map(mapPayout);
}

export async function getPayrollPayoutBatch(batchId) {
  const row = await PayrollPayoutBatch.findById(batchId).lean();
  return mapPayoutBatchToGql(row);
}

async function getRemainingAmount(item) {
  const paidRows = await PayrollPayment.aggregate([
    { $match: { payrollItemId: item._id } },
    { $group: { _id: null, amount: { $sum: "$amount" } } },
  ]);
  const paid = roundMoney(paidRows?.[0]?.amount || 0);
  return Math.max(roundMoney(Number(item.breakdown?.netSalary || 0) - paid), 0);
}

async function findDefaultEmployeeBankAccount({ employeeId, restaurantId }) {
  await cleanupDefaultEmployeeBankAccounts({ employeeId, restaurantId });
  return EmployeeBankAccount.findOne({ employeeId: toObjectId(employeeId), restaurantId: toObjectId(restaurantId), isDefault: true }).sort({ updatedAt: -1 }).lean();
}

export async function cleanupDefaultEmployeeBankAccounts({ employeeId, restaurantId }) {
  const rows = await EmployeeBankAccount.find({ employeeId: toObjectId(employeeId), restaurantId: toObjectId(restaurantId), isDefault: true }).sort({ updatedAt: -1, createdAt: -1 }).select({ _id: 1 }).lean();
  if (rows.length <= 1) return rows[0] || null;
  const [keep, ...rest] = rows;
  await EmployeeBankAccount.updateMany({ _id: { $in: rest.map((row) => row._id) } }, { $set: { isDefault: false } });
  return keep;
}

async function resolvePayoutPrerequisites({ periodId, employeeId, sourceAccountId, requireVerifiedBank = true }) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (!["finalized", "paying"].includes(String(period.status))) throw new Error("PAYROLL_PERIOD_NOT_PAYABLE");
  const item = await PayrollItem.findOne({ periodId: period._id, employeeId: toObjectId(employeeId) }).lean();
  if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");
  if (item.status === "paid") throw new Error("ALREADY_PAID");
  const remaining = await getRemainingAmount(item);
  if (remaining <= 0) throw new Error("ALREADY_PAID");
  const source = sourceAccountId ? await RestaurantPayoutAccount.findOne({ _id: toObjectId(sourceAccountId), restaurantId: period.restaurantId, status: "active", payoutEnabled: true }).lean() : null;
  if (String(process.env.PAYROLL_PAYOUT_MODE || "manual") === "provider" && !source) throw new Error("PAYROLL_SOURCE_ACCOUNT_REQUIRED");
  const bank = await findDefaultEmployeeBankAccount({ employeeId: item.employeeId, restaurantId: period.restaurantId });
  if (requireVerifiedBank && (!bank || bank.verificationStatus !== "verified")) throw new Error("EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED");
  return { period, item, remaining, source, bank };
}

function buildProviderName() {
  const mode = String(process.env.PAYROLL_PAYOUT_MODE || "manual").toLowerCase();
  return String(process.env.PAYROLL_PAYOUT_PROVIDER || mode || "manual");
}

async function applySuccessPayment({ payout, actorId = null, paidAt = new Date() }) {
  const existingPayment = await PayrollPayment.findOne({ payoutId: payout._id }).lean();
  if (existingPayment) return existingPayment;
  return markPayrollItemPaid({
    input: {
      periodId: payout.periodId,
      employeeId: payout.employeeId,
      amount: payout.amount,
      method: payout.method || "bank_transfer",
      paidAt,
      note: payout.note || "",
      referenceCode: payout.providerTransactionId || payout.referenceCode || "",
      idempotencyKey: `payout:${payout._id}`,
      payoutId: payout._id,
    },
    actorId,
  });
}

export async function applyPayrollPayoutResult({ payoutId, providerTransactionId = "", status, failureReason = "", rawPayload = null, actorId = null }) {
  const query = payoutId ? { _id: toObjectId(payoutId) } : { providerTransactionId };
  const payout = await PayrollPayout.findOne(query);
  if (!payout) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
  const nextStatus = normalizeStatus(status);
  if (payout.status === "success") return mapPayout(payout);
  if (nextStatus === "success") {
    payout.status = "success";
    payout.failureReason = "";
    payout.rawProviderResponse = rawPayload || payout.rawProviderResponse;
    payout.paidAt = payout.paidAt || new Date();
    if (providerTransactionId) payout.providerTransactionId = providerTransactionId;
    await payout.save();
    await applySuccessPayment({ payout, actorId, paidAt: payout.paidAt });
  } else if (nextStatus === "failed" || nextStatus === "cancelled") {
    payout.status = nextStatus;
    payout.failureReason = failureReason || payout.failureReason || (nextStatus === "cancelled" ? "Cancelled" : "Payout failed");
    payout.rawProviderResponse = rawPayload || payout.rawProviderResponse;
    if (providerTransactionId) payout.providerTransactionId = providerTransactionId;
    await payout.save();
    const item = await PayrollItem.findById(payout.payrollItemId).lean();
    if (item && item.status !== "paid") {
      await PayrollItem.findByIdAndUpdate(item._id, { $set: { status: nextStatus === "cancelled" ? "pending_payment" : "payment_failed" } });
    }
  } else {
    payout.status = nextStatus;
    payout.rawProviderResponse = rawPayload || payout.rawProviderResponse;
    if (providerTransactionId) payout.providerTransactionId = providerTransactionId;
    await payout.save();
  }
  await refreshPayoutBatchState(payout.payoutBatchId);
  return mapPayout(await PayrollPayout.findById(payout._id).lean());
}

export async function createPayrollPayout({ input, actorId = null }) {
  const idempotencyKey = String(input.idempotencyKey || crypto.randomUUID());
  const existing = await PayrollPayout.findOne({ idempotencyKey }).lean();
  if (existing) return mapPayout(existing);
  const mode = String(process.env.PAYROLL_PAYOUT_MODE || "manual").toLowerCase();
  const requireVerifiedBank = mode !== "manual" || input.method === "bank_transfer";
  const { period, item, remaining, bank } = await resolvePayoutPrerequisites({ ...input, requireVerifiedBank });
  const amount = input.amount == null ? remaining : roundMoney(input.amount);
  if (!(amount > 0)) throw new Error("PAYROLL_PAYOUT_AMOUNT_INVALID");
  if (amount > remaining) throw new Error("PAYROLL_PAYOUT_OVERPAY");
  const requestId = input.requestId || idempotencyKey;
  await PayrollPeriod.findByIdAndUpdate(period._id, { $set: { status: "paying" } });
  await PayrollItem.findByIdAndUpdate(item._id, { $set: { status: "processing_payment" } });
  const providerName = buildProviderName();
  const response = await getPayrollPayoutProvider().createPayout({ requestId, amount, note: input.note });
  const responseStatus = normalizeStatus(response.status);
  const payout = await PayrollPayout.create({
    restaurantId: period.restaurantId,
    periodId: period._id,
    payrollItemId: item._id,
    employeeId: item.employeeId,
    amount,
    sourceAccountId: input.sourceAccountId || null,
    destinationAccountName: bank?.accountHolderName || item.employeeName,
    destinationBankName: bank?.bankName || "",
    destinationBankCode: bank?.bankCode || "",
    destinationAccountNumberMasked: bank ? maskLast4(bank.accountNumberLast4) : "",
    provider: providerName,
    providerTransactionId: response.providerTransactionId || requestId,
    requestId,
    idempotencyKey,
    status: responseStatus,
    failureReason: response.failureReason || "",
    method: input.method || "bank_transfer",
    note: input.note || "",
    referenceCode: input.referenceCode || "",
    rawProviderResponse: response.raw || response,
    requestedBy: actorId,
    paidAt: responseStatus === "success" ? new Date() : null,
  });
  if (responseStatus === "success") {
    await applySuccessPayment({ payout, actorId, paidAt: payout.paidAt });
  } else if (responseStatus === "failed") {
    await PayrollItem.findByIdAndUpdate(item._id, { $set: { status: "payment_failed" } });
  }
  return mapPayout(await PayrollPayout.findById(payout._id).lean());
}

function resolveBatchStatus({ successCount, processingCount, failedCount, totalEmployees }) {
  if (totalEmployees <= 0) return "failed";
  if (successCount === totalEmployees) return "success";
  if (failedCount === totalEmployees) return "failed";
  if (processingCount > 0 && failedCount === 0 && successCount === 0) return "processing";
  if (processingCount > 0 && failedCount === 0) return "processing";
  return "partial_success";
}

async function refreshPayoutBatchState(batchId) {
  if (!batchId) return null;
  const batch = await PayrollPayoutBatch.findById(batchId);
  if (!batch) return null;
  const rows = await PayrollPayout.find({ payoutBatchId: batch._id }).select({ status: 1, amount: 1 }).lean();
  const counts = rows.reduce((acc, row) => {
    if (row.status === "success") acc.successCount += 1;
    else if (["pending", "processing"].includes(row.status)) acc.processingCount += 1;
    else acc.failedCount += 1;
    acc.totalAmount += Number(row.amount || 0);
    return acc;
  }, { successCount: 0, processingCount: 0, failedCount: 0, totalAmount: 0 });
  const totalEmployees = rows.length || Number(batch.totalEmployees || 0);
  const status = resolveBatchStatus({ ...counts, totalEmployees });
  batch.set({ ...counts, totalEmployees, status, completedAt: counts.processingCount > 0 ? null : (batch.completedAt || new Date()) });
  await batch.save();
  return batch;
}

export async function createPayrollBatchPayout({ input, actorId = null }) {
  const period = await PayrollPeriod.findById(input.periodId).lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (!["finalized", "paying"].includes(String(period.status))) throw new Error("PAYROLL_PERIOD_NOT_PAYABLE");
  let ids = Array.from(new Set((input.employeeIds || []).map(String))).filter(Boolean);
  if (!ids.length) {
    const rows = await PayrollItem.find({ periodId: period._id, status: { $nin: ["paid", "locked"] } }).select({ employeeId: 1 }).lean();
    ids = rows.map((r) => String(r.employeeId));
  }
  const batch = await PayrollPayoutBatch.create({ restaurantId: period.restaurantId, periodId: period._id, totalEmployees: ids.length, method: input.method || "bank_transfer", provider: buildProviderName(), requestedBy: actorId, submittedAt: new Date(), note: input.note || "" });
  let successCount = 0;
  let processingCount = 0;
  let failedCount = 0;
  let totalAmount = 0;
  const payouts = [];
  const errors = [];
  for (const employeeId of ids) {
    try {
      const payout = await createPayrollPayout({ input: { ...input, employeeId, idempotencyKey: `${input.idempotencyKey || batch._id}:${employeeId}` }, actorId });
      await PayrollPayout.findByIdAndUpdate(payout.id, { $set: { payoutBatchId: batch._id } });
      payouts.push({ ...payout, payoutBatchId: String(batch._id) });
      totalAmount += Number(payout.amount || 0);
      if (payout.status === "success") successCount += 1;
      else if (["pending", "processing"].includes(payout.status)) processingCount += 1;
      else failedCount += 1;
    } catch (err) {
      failedCount += 1;
      errors.push({ employeeId, code: err.message || "PAYROLL_PAYOUT_FAILED", message: err.message || "Không thể tạo payout" });
    }
  }
  const status = resolveBatchStatus({ successCount, processingCount, failedCount, totalEmployees: ids.length });
  await PayrollPayoutBatch.findByIdAndUpdate(batch._id, {
    $set: { successCount, processingCount, failedCount, totalAmount, status, completedAt: processingCount > 0 ? null : new Date() },
  });
  return { successCount, processingCount, failedCount, payouts, errors, batch: await getPayrollPayoutBatch(batch._id) };
}

export async function retryPayrollPayout({ payoutId, idempotencyKey, actorId = null }) {
  const payout = await PayrollPayout.findById(payoutId).lean();
  if (!payout) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
  if (!["failed", "cancelled"].includes(String(payout.status))) throw new Error("PAYROLL_PAYOUT_RETRY_NOT_ALLOWED");
  const nextKey = String(idempotencyKey || crypto.randomUUID());
  await PayrollPayout.findByIdAndUpdate(payout._id, { $inc: { retryCount: 1 }, $set: { status: "processing", idempotencyKey: nextKey, requestId: nextKey, failureReason: "" } });
  const response = await getPayrollPayoutProvider().createPayout({ requestId: nextKey, amount: payout.amount, note: payout.note });
  return applyPayrollPayoutResult({ payoutId: payout._id, providerTransactionId: response.providerTransactionId || nextKey, status: response.status, failureReason: response.failureReason || "", rawPayload: response.raw || response, actorId });
}

export async function cancelPayrollPayout({ payoutId, reason, actorId = null }) {
  if (!String(reason || "").trim()) throw new Error("PAYROLL_PAYOUT_CANCEL_REASON_REQUIRED");
  if (String(process.env.PAYROLL_PAYOUT_MODE || "manual").toLowerCase() === "provider") throw new Error("PAYROLL_PAYOUT_CANCEL_NOT_SUPPORTED");
  const payout = await PayrollPayout.findById(payoutId);
  if (!payout) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
  if (payout.status === "success") throw new Error("PAYROLL_PAYOUT_CANCEL_NOT_ALLOWED");
  if (!["pending", "processing"].includes(String(payout.status))) throw new Error("PAYROLL_PAYOUT_CANCEL_NOT_ALLOWED");
  payout.status = "cancelled";
  payout.failureReason = reason;
  payout.rawProviderResponse = { ...(payout.rawProviderResponse || {}), cancelledBy: actorId ? String(actorId) : null, cancelReason: reason };
  await payout.save();
  await PayrollItem.findByIdAndUpdate(payout.payrollItemId, { $set: { status: "pending_payment" } });
  await refreshPayoutBatchState(payout.payoutBatchId);
  return mapPayout(await PayrollPayout.findById(payout._id).lean());
}

export async function upsertEmployeeBankAccount({ input, actorId = null }) {
  const data = {
    ...input,
    employeeId: toObjectId(input.employeeId),
    restaurantId: toObjectId(input.restaurantId),
    accountNumberEncrypted: encryptAccountNumber(input.accountNumber),
    accountNumberLast4: last4(input.accountNumber),
    isDefault: input.isDefault !== false,
    verificationStatus: input.verificationStatus || "pending",
  };
  delete data.accountNumber;
  if (data.isDefault) {
    await EmployeeBankAccount.updateMany({ employeeId: data.employeeId, restaurantId: data.restaurantId, isDefault: true }, { $set: { isDefault: false } });
  }
  const filter = input.id ? { _id: toObjectId(input.id) } : { employeeId: data.employeeId, restaurantId: data.restaurantId, accountNumberLast4: data.accountNumberLast4 };
  const row = await EmployeeBankAccount.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true });
  if (row.isDefault) await cleanupDefaultEmployeeBankAccounts({ employeeId: data.employeeId, restaurantId: data.restaurantId });
  return mapEmployeeBankAccount(row);
}

export async function verifyEmployeeBankAccount({ employeeId, restaurantId, verificationStatus = "verified", actorId = null }) {
  await cleanupDefaultEmployeeBankAccounts({ employeeId, restaurantId });
  const row = await EmployeeBankAccount.findOneAndUpdate({ employeeId: toObjectId(employeeId), restaurantId: toObjectId(restaurantId), isDefault: true }, { $set: { verificationStatus, verifiedAt: verificationStatus === "verified" ? new Date() : null, verifiedBy: actorId } }, { new: true, sort: { updatedAt: -1 } });
  if (!row) throw new Error("EMPLOYEE_BANK_ACCOUNT_NOT_FOUND");
  return mapEmployeeBankAccount(row);
}

export function mapEmployeeBankAccount(row) {
  return row && {
    id: String(row._id || row.id),
    employeeId: String(row.employeeId),
    restaurantId: String(row.restaurantId),
    accountHolderName: row.accountHolderName,
    bankName: row.bankName,
    bankCode: row.bankCode || "",
    accountNumberLast4: row.accountNumberLast4 || "",
    accountNumberMasked: maskLast4(row.accountNumberLast4),
    branchName: row.branchName || "",
    isDefault: row.isDefault !== false,
    verificationStatus: row.verificationStatus || "pending",
    verifiedAt: row.verifiedAt || null,
    verifiedBy: row.verifiedBy ? String(row.verifiedBy) : null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function upsertRestaurantPayoutAccount({ input }) {
  const data = { ...input, restaurantId: toObjectId(input.restaurantId), accountNumberEncrypted: encryptAccountNumber(input.accountNumber), accountNumberLast4: last4(input.accountNumber) };
  delete data.accountNumber;
  const row = await RestaurantPayoutAccount.findOneAndUpdate(input.id ? { _id: toObjectId(input.id) } : { restaurantId: data.restaurantId, accountName: data.accountName }, { $set: data }, { upsert: true, new: true });
  return mapRestaurantPayoutAccount(row);
}

export function mapRestaurantPayoutAccount(row) {
  return row && {
    id: String(row._id || row.id),
    restaurantId: String(row.restaurantId),
    accountName: row.accountName,
    bankName: row.bankName,
    bankCode: row.bankCode || "",
    accountNumberLast4: row.accountNumberLast4 || "",
    accountNumberMasked: maskLast4(row.accountNumberLast4),
    provider: row.provider || "manual",
    providerMerchantId: row.providerMerchantId || "",
    status: row.status || "pending_verification",
    payoutEnabled: Boolean(row.payoutEnabled),
    dailyLimit: Number(row.dailyLimit || 0),
    perTransactionLimit: Number(row.perTransactionLimit || 0),
    currency: row.currency || "VND",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}
