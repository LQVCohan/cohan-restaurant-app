import { PaymentReconciliation } from "../../../models/index.js";
import { PaymentQuery } from "./query.js";
import { BankTransferPaymentQuery } from "./bankTransferQuery.js";
import TransactionManagementQuery from "./transactionManagementQuery.js";
import PaymentMutation from "./mutation.js";
import ReconciliationPaymentConfirmationMutation from "./reconciliationPaymentConfirmationMutation.js";
import FinanceOperationGuardMutation from "./financeOperationGuardMutation.js";
import StrictOrderPaymentMutation from "./strictOrderPaymentMutation.js";
import MergedTablePaymentMutation from "./mergedTablePaymentMutation.js";
import TransferPaymentMutation from "./transferMutation.js";
import CustomerOrderPaymentMutation from "./customerOrderPaymentMutation.js";
import TransactionManagementGuardMutation from "./transactionManagementGuards.js";
import { PaymentResolvers } from "./types.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";
import PublicTableAccessGuardMutation from "./publicTableAccessGuardMutation.js";
import withPaymentIdempotency from "./paymentIdempotencyMutation.js";
import withWalletMoneyIdempotency from "./walletMoneyIdempotencyMutation.js";
import {
  PaymentCredentialMutation,
  PaymentCredentialQuery,
} from "./paymentCredential.js";
import wallet from "../wallet/index.js";
import { createPreSessionTableStaffCall } from "../order/tableCustomerRequestBridge.js";
import {
  includeResolvedReconciliationCount,
  normalizeFinanceDashboardResult,
  prepareFinanceDashboardRequest,
} from "../../../src/services/finance/financeDashboardRange.service.js";

const financeDashboard = async (parent, { input }, ctx, info) => {
  const request = prepareFinanceDashboardRequest(input);
  const result = await PaymentQuery.financeDashboard(
    parent,
    { input: request.input },
    ctx,
    info,
  );
  const resolvedCount = await PaymentReconciliation.countDocuments({
    restaurantId: request.input.restaurantId,
    status: "resolved",
  });
  return includeResolvedReconciliationCount(
    normalizeFinanceDashboardResult(result, request),
    resolvedCount,
  );
};

const publicTablePaymentWithPreSessionCall = {
  ...publicTablePaymentMutation,
  async publicCallStaffForTable(parent, { input }, ctx, info) {
    const result = await publicTablePaymentMutation.publicCallStaffForTable(
      parent,
      { input },
      ctx,
      info,
    );
    if (result?.ok) return result;
    const request = await createPreSessionTableStaffCall({
      restaurantId: input?.restaurantId,
      tableId: input?.tableId,
      message: input?.note,
      ctx,
    });
    if (!request) return result;
    return {
      ok: true,
      message: "Đã gọi nhân viên. Vui lòng chờ trong giây lát.",
      requestId: request.requestId,
      status: request.status,
      requestedAt: request.createdAt,
    };
  },
};

const paymentMutation = {
  ...PaymentMutation,
  ...ReconciliationPaymentConfirmationMutation,
  ...FinanceOperationGuardMutation,
  ...StrictOrderPaymentMutation,
  ...TransferPaymentMutation,
  ...publicTablePaymentWithPreSessionCall,
  ...PublicTableAccessGuardMutation,
  ...(wallet.Mutation || {}),
  ...MergedTablePaymentMutation,
  ...PaymentCredentialMutation,
  ...TransactionManagementGuardMutation,
  ...CustomerOrderPaymentMutation,
};

export default {
  Query: {
    ...PaymentQuery,
    ...BankTransferPaymentQuery,
    ...(wallet.Query || {}),
    ...PaymentCredentialQuery,
    ...TransactionManagementQuery,
    financeDashboard,
  },
  Mutation: withWalletMoneyIdempotency(
    withPaymentIdempotency(paymentMutation),
  ),
  ...PaymentResolvers,
};
