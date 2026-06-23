import mongoose from "mongoose";
import { BankTransaction, PaymentSession } from "../../../models/index.js";
import PaymentMutation from "./mutation.js";
import { settlePaidOrderPaymentSession } from "../../../src/services/payment/paymentSession.service.js";
import { emitPaymentRealtime } from "../../../src/services/payment/paymentRealtime.service.js";

function toStringId(value) {
  if (value == null) return null;
  return String(value?._id || value?.id || value);
}

function roundMoney(value) {
  return Math.round(Number(value || 0));
}

function isBankTransferPayment(payment = {}) {
  const provider = String(payment.provider || "").toLowerCase();
  const paymentMethod = String(payment.paymentMethod || "").toLowerCase();
  return ["bank_transfer", "transfer"].includes(provider)
    || ["bank_transfer", "transfer"].includes(paymentMethod);
}

function getOrderIdsFromPayment(payment = {}) {
  if (Array.isArray(payment?.metadata?.orderIds) && payment.metadata.orderIds.length) {
    return payment.metadata.orderIds.map(String).filter(Boolean);
  }
  return [payment.orderId].filter(Boolean).map(String);
}

function isConfirmablePaymentStatus(payment = {}) {
  return ["pending", "success"].includes(String(payment.status || "").toLowerCase());
}

function appendPaymentEvent(payment, event) {
  payment.events = Array.isArray(payment.events) ? payment.events : [];
  payment.events.push(event);
}

async function confirmBankTransferPaymentFromReconciliation({
  reconciliation,
  bankTransactionId,
  ctx,
  source,
}) {
  if (!reconciliation || String(reconciliation.status || "") !== "matched") return null;

  const bankTransaction = bankTransactionId && mongoose.isValidObjectId(bankTransactionId)
    ? await BankTransaction.findById(bankTransactionId)
    : null;

  const paymentSessionId =
    toStringId(reconciliation.paymentSessionId) ||
    toStringId(bankTransaction?.matchedPaymentSessionId);

  if (!paymentSessionId || !mongoose.isValidObjectId(paymentSessionId)) return null;

  const payment = await PaymentSession.findOne({ _id: paymentSessionId });
  if (!payment) return null;
  if (!isBankTransferPayment(payment)) return null;
  if (!isConfirmablePaymentStatus(payment)) return null;

  const expectedAmount = roundMoney(payment.amount ?? reconciliation.expectedAmount);
  const receivedAmount = roundMoney(bankTransaction?.amount ?? reconciliation.receivedAmount);
  if (!(expectedAmount > 0) || expectedAmount !== receivedAmount) return null;

  const now = new Date();
  const providerTransactionId =
    bankTransaction?.transactionId ||
    payment.providerTransactionId ||
    payment.reference;

  const alreadySuccess = String(payment.status || "").toLowerCase() === "success";
  payment.status = "success";
  payment.callbackStatus = "verified";
  payment.providerTransactionId = providerTransactionId;
  payment.reconciledAt = payment.reconciledAt || now;
  payment.callbackAt = payment.callbackAt || now;
  payment.callbackRaw = payment.callbackRaw || bankTransaction?.raw || {
    source,
    bankTransactionId: toStringId(bankTransaction?._id || bankTransactionId),
  };
  payment.transfer = {
    ...(payment.transfer || {}),
    status: "VERIFIED",
    verifiedAt: payment.transfer?.verifiedAt || now,
    providerTransactionId,
    receivedAmount,
    varianceAmount: 0,
    rejectReason: undefined,
    rejectedAt: undefined,
  };

  appendPaymentEvent(payment, {
    type: alreadySuccess ? "reconciliation_verified_existing_success" : "transfer_verified",
    payload: {
      by: source,
      bankTransactionId: toStringId(bankTransaction?._id || bankTransactionId),
      providerTransactionId,
    },
  });

  await payment.save();

  if (getOrderIdsFromPayment(payment).length) {
    await settlePaidOrderPaymentSession({ payment, source });
  }

  const confirmedPayment = await PaymentSession.findById(payment._id).lean?.()
    || (typeof payment.toObject === "function" ? payment.toObject() : payment);

  await emitPaymentRealtime({
    io: ctx?.io,
    payment: confirmedPayment,
    eventType: "PAYMENT_VERIFIED",
    message: "Thanh toán chuyển khoản đã được đối soát và xác nhận.",
  });

  return confirmedPayment;
}

async function reconcileBankTransaction(parent, args, ctx, info) {
  const reconciliation = await PaymentMutation.reconcileBankTransaction(parent, args, ctx, info);
  const confirmedPayment = await confirmBankTransferPaymentFromReconciliation({
    reconciliation,
    bankTransactionId: args?.bankTransactionId,
    ctx,
    source: "bank_reconciliation_auto",
  });

  if (confirmedPayment && reconciliation && typeof reconciliation === "object") {
    reconciliation.paymentConfirmation = {
      status: confirmedPayment.status,
      paymentSessionId: toStringId(confirmedPayment._id || confirmedPayment.id),
    };
  }

  return reconciliation;
}

async function manuallyMatchBankTransaction(parent, args, ctx, info) {
  const reconciliation = await PaymentMutation.manuallyMatchBankTransaction(parent, args, ctx, info);
  const confirmedPayment = await confirmBankTransferPaymentFromReconciliation({
    reconciliation,
    bankTransactionId: args?.input?.bankTransactionId,
    ctx,
    source: "bank_reconciliation_manual",
  });

  if (confirmedPayment && reconciliation && typeof reconciliation === "object") {
    reconciliation.paymentConfirmation = {
      status: confirmedPayment.status,
      paymentSessionId: toStringId(confirmedPayment._id || confirmedPayment.id),
    };
  }

  return reconciliation;
}

export default {
  reconcileBankTransaction,
  manuallyMatchBankTransaction,
};
