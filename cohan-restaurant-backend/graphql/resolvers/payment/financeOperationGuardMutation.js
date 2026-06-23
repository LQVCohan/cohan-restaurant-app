import PaymentMutation from "./mutation.js";
import { withFinanceOperationLock } from "../../../src/services/finance/financeOperationLock.service.js";

function refundLockKey(id) {
  return `refund:${String(id || "").trim()}`;
}

function supplierPaymentLockKey(id) {
  return `supplier-payable:${String(id || "").trim()}`;
}

async function processRefundRequest(parent, args, ctx, info) {
  return withFinanceOperationLock(refundLockKey(args?.id), () =>
    PaymentMutation.processRefundRequest(parent, args, ctx, info),
  );
}

async function retryRefundRequest(parent, args, ctx, info) {
  return withFinanceOperationLock(refundLockKey(args?.id), () =>
    PaymentMutation.retryRefundRequest(parent, args, ctx, info),
  );
}

async function recordSupplierPayment(parent, args, ctx, info) {
  return withFinanceOperationLock(supplierPaymentLockKey(args?.id), () =>
    PaymentMutation.recordSupplierPayment(parent, args, ctx, info),
  );
}

export default {
  processRefundRequest,
  retryRefundRequest,
  recordSupplierPayment,
};
