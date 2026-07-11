export const PaymentResolvers = {
  PaymentSession: {
    restaurantId(parent) { return parent?.restaurantId ? String(parent.restaurantId) : null; },
    orderId(parent) { return parent?.orderId ? String(parent.orderId) : null; },
    reservationId(parent) { return parent?.reservationId ? String(parent.reservationId) : null; },
    userId(parent) { return parent?.userId ? String(parent.userId) : null; },
  },
  PaymentTransaction: {
    orderId(parent) {
      if (parent.orderId) return String(parent.orderId);
      if (Array.isArray(parent.orderIds) && parent.orderIds.length) {
        return String(parent.orderIds[0]);
      }
      return null;
    },
    method(parent) {
      const value = String(parent.method || "cash").toLowerCase();
      return ["cash", "card", "transfer", "bank_transfer", "e_wallet", "momo", "vnpay", "other"].includes(value)
        ? value
        : "other";
    },
    refundIds(parent) { return (parent.refundIds || []).map(String); },
  },
  Invoice: {
    orderId(parent) {
      if (parent.orderId) return String(parent.orderId);
      if (Array.isArray(parent.orderIds) && parent.orderIds.length) {
        return String(parent.orderIds[0]);
      }
      return null;
    },
  },
  Cashflow: {
    restaurantId(parent) {
      return parent.restaurantId ? String(parent.restaurantId) : null;
    },
    reference(parent) {
      if (!parent.ref) return null;
      return {
        kind: parent.ref.kind || null,
        id: parent.ref.id ? String(parent.ref.id) : null,
        orderId:
          parent.ref.orderId
            ? String(parent.ref.orderId)
            : Array.isArray(parent.ref.orderIds) && parent.ref.orderIds.length
              ? String(parent.ref.orderIds[0])
              : null,
        invoiceId: parent.ref.invoiceId ? String(parent.ref.invoiceId) : null,
        paymentTransactionId: parent.ref.paymentTransactionId ? String(parent.ref.paymentTransactionId) : null,
        payrollPaymentId: parent.ref.payrollPaymentId ? String(parent.ref.payrollPaymentId) : null,
        stockMovementId: parent.ref.stockMovementId ? String(parent.ref.stockMovementId) : null,
        reconciliationId: parent.ref.reconciliationId ? String(parent.ref.reconciliationId) : null,
        refundId: parent.ref.refundId ? String(parent.ref.refundId) : null,
      };
    },
    createdBy(parent) { return parent.createdBy ? String(parent.createdBy) : null; },
    approvedBy(parent) { return parent.approvedBy ? String(parent.approvedBy) : null; },
    voidedBy(parent) { return parent.voidedBy ? String(parent.voidedBy) : null; },
  },
  BankTransaction: {
    id(parent) { return String(parent._id || parent.id); },
    restaurantId(parent) { return parent.restaurantId ? String(parent.restaurantId) : null; },
    matchedPaymentSessionId(parent) { return parent.matchedPaymentSessionId ? String(parent.matchedPaymentSessionId) : null; },
    bankAccountNumber(parent) { return parent.bankAccountNumberMasked || null; },
    bankAccountNumberMasked(parent) { return parent.bankAccountNumberMasked || null; },
    bankAccountNumberLast4(parent) { return parent.bankAccountNumberLast4 || null; },
  },
  PaymentReconciliation: {
    id(parent) { return String(parent._id || parent.id); },
    restaurantId(parent) { return parent.restaurantId ? String(parent.restaurantId) : null; },
    paymentSessionId(parent) { return parent.paymentSessionId ? String(parent.paymentSessionId) : null; },
    bankTransactionId(parent) { return parent.bankTransactionId ? String(parent.bankTransactionId) : null; },
    resolvedBy(parent) { return parent.resolvedBy ? String(parent.resolvedBy) : null; },
    candidatePaymentSessionIds(parent) { return (parent.candidatePaymentSessionIds || []).map(String); },
    candidatePaymentTransactionIds(parent) { return (parent.candidatePaymentTransactionIds || []).map(String); },
  },
  SupplierPayable: {
    id(parent) { return String(parent._id || parent.id); },
    restaurantId(parent) { return parent.restaurantId ? String(parent.restaurantId) : null; },
    supplierId(parent) { return parent.supplierId ? String(parent.supplierId) : null; },
    sourceId(parent) { return parent.sourceId ? String(parent.sourceId) : null; },
    createdBy(parent) { return parent.createdBy ? String(parent.createdBy) : null; },
    paidBy(parent) { return parent.paidBy ? String(parent.paidBy) : null; },
    cashflowIds(parent) { return (parent.cashflowIds || []).map(String); },
  },
  PaymentRefund: {
    id(parent) { return String(parent._id || parent.id); },
    restaurantId(parent) { return String(parent.restaurantId); },
    orderId(parent) { return parent.orderId ? String(parent.orderId) : null; },
    invoiceId(parent) { return parent.invoiceId ? String(parent.invoiceId) : null; },
    paymentTransactionId(parent) { return parent.paymentTransactionId ? String(parent.paymentTransactionId) : null; },
    createdBy(parent) { return parent.createdBy ? String(parent.createdBy) : null; },
    approvedBy(parent) { return parent.approvedBy ? String(parent.approvedBy) : null; },
    processedBy(parent) { return parent.processedBy ? String(parent.processedBy) : null; },
    cashflowId(parent) { return parent.cashflowId ? String(parent.cashflowId) : null; },
  },
};
