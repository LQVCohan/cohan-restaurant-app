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
import ReservationPaymentMutation from "./reservationPaymentMutation.js";
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

const paymentMutation = {
  ...PaymentMutation,
  ...ReconciliationPaymentConfirmationMutation,
  ...FinanceOperationGuardMutation,
  ...StrictOrderPaymentMutation,
  ...TransferPaymentMutation,
  ...publicTablePaymentMutation,
  ...PublicTableAccessGuardMutation,
  ...(wallet.Mutation || {}),
  ...MergedTablePaymentMutation,
  ...PaymentCredentialMutation,
  ...TransactionManagementGuardMutation,
  // Keep customer-owned provider flows last so the focused ownership/request context wins.
  ...ReservationPaymentMutation,
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
