import mongoose from "mongoose";
import {
  BankTransaction,
  Invoice,
  PaymentReconciliation,
  PaymentTransaction,
  SupplierPayable,
} from "../../../models/index.js";
import {
  requireFinanceWrite,
  requireReconciliationWrite,
  requireRefundWrite,
} from "../../../src/services/finance/financePermission.service.js";
import PaymentMutation from "./mutation.js";

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const createRefundRequest = async (parent, { input = {} }, ctx, info) => {
  const restaurantId = toId(input.restaurantId);
  if (!restaurantId) throw new Error("Invalid restaurantId");
  await requireRefundWrite(ctx, restaurantId);

  const normalizedInput = { ...input };
  const invoiceId = toId(input.invoiceId);
  const paymentTransactionId = toId(input.paymentTransactionId);
  const orderId = toId(input.orderId);

  if (!invoiceId && !paymentTransactionId && !orderId) {
    throw new Error("Refund source is required");
  }

  if (invoiceId) {
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      restaurantId,
    }).lean();
    if (!invoice) throw new Error("Invoice not found in restaurant scope");

    normalizedInput.paymentTransactionId =
      normalizedInput.paymentTransactionId ||
      (invoice.refTransactionId ? String(invoice.refTransactionId) : null);
    normalizedInput.orderId =
      normalizedInput.orderId ||
      (invoice.orderId
        ? String(invoice.orderId)
        : Array.isArray(invoice.orderIds) && invoice.orderIds.length
          ? String(invoice.orderIds[0])
          : null);
  }

  if (normalizedInput.paymentTransactionId) {
    const transaction = await PaymentTransaction.findOne({
      _id: toId(normalizedInput.paymentTransactionId),
      restaurantId,
      status: "SUCCESS",
    }).lean();
    if (!transaction) {
      throw new Error("Successful payment transaction not found in restaurant scope");
    }
  }

  return PaymentMutation.createRefundRequest(
    parent,
    { input: normalizedInput },
    ctx,
    info,
  );
};

const createSupplierPayable = async (parent, { input = {} }, ctx, info) => {
  const restaurantId = toId(input.restaurantId);
  if (!restaurantId) throw new Error("Invalid restaurantId");
  await requireFinanceWrite(ctx, restaurantId);

  if (Number(input.paidAmount || 0) > 0) {
    throw new Error(
      "Initial supplier payment must be recorded through recordSupplierPayment",
    );
  }

  return PaymentMutation.createSupplierPayable(
    parent,
    { input: { ...input, paidAmount: 0 } },
    ctx,
    info,
  );
};

const updateSupplierPayable = async (parent, { id, input = {} }, ctx, info) => {
  const payableId = toId(id);
  const payable = payableId ? await SupplierPayable.findById(payableId) : null;
  if (!payable) throw new Error("Supplier payable not found");

  const restaurantId = toId(payable.restaurantId);
  await requireFinanceWrite(ctx, restaurantId);

  if (
    input.paidAmount !== undefined &&
    Math.abs(Number(input.paidAmount || 0) - Number(payable.paidAmount || 0)) > 1e-6
  ) {
    throw new Error(
      "Paid amount can only change through recordSupplierPayment",
    );
  }

  const { paidAmount: _ignoredPaidAmount, ...safeInput } = input;
  return PaymentMutation.updateSupplierPayable(
    parent,
    { id, input: safeInput },
    ctx,
    info,
  );
};

const voidSupplierPayable = async (parent, { id, reason }, ctx, info) => {
  const payableId = toId(id);
  const payable = payableId ? await SupplierPayable.findById(payableId) : null;
  if (!payable) throw new Error("Supplier payable not found");

  const restaurantId = toId(payable.restaurantId);
  await requireFinanceWrite(ctx, restaurantId);

  if (Number(payable.paidAmount || 0) > 0) {
    throw new Error(
      "Supplier payable with recorded payments cannot be voided; reverse the payments first",
    );
  }

  return PaymentMutation.voidSupplierPayable(
    parent,
    { id, reason },
    ctx,
    info,
  );
};

const manuallyMatchBankTransaction = async (
  parent,
  { input = {} },
  ctx,
  info,
) => {
  const bankTransactionId = toId(input.bankTransactionId);
  const bankTransaction = bankTransactionId
    ? await BankTransaction.findById(bankTransactionId)
    : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");

  const restaurantId = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, restaurantId);

  const targets = [input.paymentSessionId, input.paymentTransactionId].filter(
    Boolean,
  );
  if (targets.length !== 1) {
    throw new Error("Select exactly one payment to match");
  }

  return PaymentMutation.manuallyMatchBankTransaction(
    parent,
    { input },
    ctx,
    info,
  );
};

const reconcileBankTransaction = async (
  parent,
  { bankTransactionId },
  ctx,
  info,
) => {
  const id = toId(bankTransactionId);
  const bankTransaction = id ? await BankTransaction.findById(id) : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");

  const restaurantId = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, restaurantId);

  if (["matched", "resolved", "ignored"].includes(bankTransaction.matchStatus)) {
    const existing = await PaymentReconciliation.findOne({
      bankTransactionId: bankTransaction._id,
    });
    if (existing) return existing;
    throw new Error("Bank transaction is already finalized");
  }

  return PaymentMutation.reconcileBankTransaction(
    parent,
    { bankTransactionId },
    ctx,
    info,
  );
};

const ignoreBankTransaction = async (parent, { id, reason }, ctx, info) => {
  const bankTransactionId = toId(id);
  const bankTransaction = bankTransactionId
    ? await BankTransaction.findById(bankTransactionId)
    : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");

  const restaurantId = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, restaurantId);

  if (bankTransaction.matchStatus === "ignored") return bankTransaction;
  if (["matched", "resolved"].includes(bankTransaction.matchStatus)) {
    throw new Error("Finalized bank transaction cannot be ignored");
  }

  return PaymentMutation.ignoreBankTransaction(
    parent,
    { id, reason },
    ctx,
    info,
  );
};

export default {
  createRefundRequest,
  createSupplierPayable,
  updateSupplierPayable,
  voidSupplierPayable,
  manuallyMatchBankTransaction,
  reconcileBankTransaction,
  ignoreBankTransaction,
};
