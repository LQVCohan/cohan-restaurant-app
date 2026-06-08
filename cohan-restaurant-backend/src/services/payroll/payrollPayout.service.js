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

const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const maskAccountNumber = (value) => {
  const raw = String(value || "").replace(/\s+/g, "");
  if (!raw) return "";
  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};
export const encryptAccountNumber = (value) => Buffer.from(String(value || ""), "utf8").toString("base64");
export const last4 = (value) => String(value || "").replace(/\s+/g, "").slice(-4);

class ManualPayoutProvider {
  async createPayout(payload) {
    return { status: "processing", providerTransactionId: payload.requestId, raw: { mode: "manual" } };
  }
  async createBatchPayout(payload) {
    return { status: "processing", providerTransactionId: payload.requestId, raw: { mode: "manual", count: payload.items?.length || 0 } };
  }
  async getPayoutStatus() { return { status: "processing" }; }
  async handleWebhook(payload) { return payload; }
}
class MockPayoutProvider extends ManualPayoutProvider {
  async createPayout(payload) {
    const fail = String(payload.note || "").toLowerCase().includes("fail");
    return { status: fail ? "failed" : "success", providerTransactionId: `mock_${payload.requestId}`, failureReason: fail ? "Mock payout failed" : "", raw: { mode: "mock" } };
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
  return {
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
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}
export const mapPayrollPayoutToGql = mapPayout;
export const mapPayoutBatchToGql = (row) => row && ({
  id: String(row._id || row.id), restaurantId: String(row.restaurantId), periodId: String(row.periodId),
  totalAmount: Number(row.totalAmount || 0), totalEmployees: Number(row.totalEmployees || 0),
  successCount: Number(row.successCount || 0), failedCount: Number(row.failedCount || 0), status: row.status || "pending",
  method: row.method || "bank_transfer", provider: row.provider || "manual", requestedBy: row.requestedBy ? String(row.requestedBy) : null,
  approvedBy: row.approvedBy ? String(row.approvedBy) : null, submittedAt: row.submittedAt || null, completedAt: row.completedAt || null,
  note: row.note || "", createdAt: row.createdAt || null, updatedAt: row.updatedAt || null,
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
  const bank = await EmployeeBankAccount.findOne({ employeeId: item.employeeId, restaurantId: period.restaurantId, isDefault: true }).lean();
  if (requireVerifiedBank && (!bank || bank.verificationStatus !== "verified")) throw new Error("EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED");
  return { period, item, remaining, source, bank };
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
  const providerName = String(process.env.PAYROLL_PAYOUT_PROVIDER || mode || "manual");
  const response = await getPayrollPayoutProvider().createPayout({ requestId, amount, note: input.note });
  const payout = await PayrollPayout.create({
    restaurantId: period.restaurantId, periodId: period._id, payrollItemId: item._id, employeeId: item.employeeId,
    amount, sourceAccountId: input.sourceAccountId || null, destinationAccountName: bank?.accountHolderName || item.employeeName,
    destinationBankName: bank?.bankName || "", destinationBankCode: bank?.bankCode || "", destinationAccountNumberMasked: bank ? `****${bank.accountNumberLast4}` : "",
    provider: providerName, providerTransactionId: response.providerTransactionId || requestId, requestId, idempotencyKey,
    status: response.status === "success" ? "success" : response.status === "failed" ? "failed" : "processing",
    failureReason: response.failureReason || "", method: input.method || "bank_transfer", note: input.note || "", referenceCode: input.referenceCode || "",
    rawProviderResponse: response.raw || response, requestedBy: actorId, paidAt: response.status === "success" ? new Date() : null,
  });
  if (response.status === "success") {
    await markPayrollItemPaid({ input: { periodId: period._id, employeeId: item.employeeId, amount, method: input.method || "bank_transfer", paidAt: new Date(), note: input.note, referenceCode: payout.providerTransactionId, idempotencyKey: `payout:${payout._id}` }, actorId });
  } else if (response.status === "failed") {
    await PayrollItem.findByIdAndUpdate(item._id, { $set: { status: "payment_failed" } });
  }
  return mapPayout(await PayrollPayout.findById(payout._id).lean());
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
  const batch = await PayrollPayoutBatch.create({ restaurantId: period.restaurantId, periodId: period._id, totalEmployees: ids.length, method: input.method || "bank_transfer", provider: process.env.PAYROLL_PAYOUT_PROVIDER || process.env.PAYROLL_PAYOUT_MODE || "manual", requestedBy: actorId, submittedAt: new Date(), note: input.note || "" });
  let successCount = 0; let failedCount = 0; let totalAmount = 0; const payouts = []; const errors = [];
  for (const employeeId of ids) {
    try {
      const payout = await createPayrollPayout({ input: { ...input, employeeId, idempotencyKey: `${input.idempotencyKey || batch._id}:${employeeId}` }, actorId });
      await PayrollPayout.findByIdAndUpdate(payout.id, { $set: { payoutBatchId: batch._id } });
      payouts.push(payout); totalAmount += Number(payout.amount || 0); if (payout.status === "failed") failedCount += 1; else successCount += 1;
    } catch (err) { failedCount += 1; errors.push({ employeeId, code: err.message || "PAYROLL_PAYOUT_FAILED", message: err.message || "Không thể tạo payout" }); }
  }
  const status = successCount && failedCount ? "partial_success" : failedCount ? "failed" : "success";
  await PayrollPayoutBatch.findByIdAndUpdate(batch._id, { $set: { successCount, failedCount, totalAmount, status, completedAt: new Date() } });
  return { successCount, failedCount, payouts, errors, batch: await getPayrollPayoutBatch(batch._id) };
}

export async function upsertEmployeeBankAccount({ input, actorId = null }) {
  const data = { ...input, employeeId: toObjectId(input.employeeId), restaurantId: toObjectId(input.restaurantId), accountNumberEncrypted: encryptAccountNumber(input.accountNumber), accountNumberLast4: last4(input.accountNumber), verificationStatus: input.verificationStatus || "pending" };
  delete data.accountNumber;
  const row = await EmployeeBankAccount.findOneAndUpdate({ employeeId: data.employeeId, restaurantId: data.restaurantId, isDefault: data.isDefault !== false }, { $set: data }, { upsert: true, new: true });
  return mapEmployeeBankAccount(row);
}
export async function verifyEmployeeBankAccount({ employeeId, restaurantId, verificationStatus = "verified", actorId = null }) {
  const row = await EmployeeBankAccount.findOneAndUpdate({ employeeId: toObjectId(employeeId), restaurantId: toObjectId(restaurantId), isDefault: true }, { $set: { verificationStatus, verifiedAt: verificationStatus === "verified" ? new Date() : null, verifiedBy: actorId } }, { new: true });
  if (!row) throw new Error("EMPLOYEE_BANK_ACCOUNT_NOT_FOUND");
  return mapEmployeeBankAccount(row);
}
export function mapEmployeeBankAccount(row) { return row && { id: String(row._id || row.id), employeeId: String(row.employeeId), restaurantId: String(row.restaurantId), accountHolderName: row.accountHolderName, bankName: row.bankName, bankCode: row.bankCode || "", accountNumberLast4: row.accountNumberLast4 || "", accountNumberMasked: `****${row.accountNumberLast4 || ""}`, branchName: row.branchName || "", isDefault: row.isDefault !== false, verificationStatus: row.verificationStatus || "pending", verifiedAt: row.verifiedAt || null, verifiedBy: row.verifiedBy ? String(row.verifiedBy) : null, createdAt: row.createdAt || null, updatedAt: row.updatedAt || null }; }
export async function upsertRestaurantPayoutAccount({ input }) {
  const data = { ...input, restaurantId: toObjectId(input.restaurantId), accountNumberEncrypted: encryptAccountNumber(input.accountNumber), accountNumberLast4: last4(input.accountNumber) };
  delete data.accountNumber;
  const row = await RestaurantPayoutAccount.findOneAndUpdate(input.id ? { _id: toObjectId(input.id) } : { restaurantId: data.restaurantId, accountName: data.accountName }, { $set: data }, { upsert: true, new: true });
  return mapRestaurantPayoutAccount(row);
}
export function mapRestaurantPayoutAccount(row) { return row && { id: String(row._id || row.id), restaurantId: String(row.restaurantId), accountName: row.accountName, bankName: row.bankName, bankCode: row.bankCode || "", accountNumberLast4: row.accountNumberLast4 || "", accountNumberMasked: `****${row.accountNumberLast4 || ""}`, provider: row.provider || "manual", providerMerchantId: row.providerMerchantId || "", status: row.status || "pending_verification", payoutEnabled: Boolean(row.payoutEnabled), dailyLimit: Number(row.dailyLimit || 0), perTransactionLimit: Number(row.perTransactionLimit || 0), currency: row.currency || "VND", createdAt: row.createdAt || null, updatedAt: row.updatedAt || null }; }
