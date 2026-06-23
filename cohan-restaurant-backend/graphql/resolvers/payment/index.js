import { PaymentQuery } from "./query.js";
import { BankTransferPaymentQuery } from "./bankTransferQuery.js";
import PaymentMutation from "./mutation.js";
import ReconciliationPaymentConfirmationMutation from "./reconciliationPaymentConfirmationMutation.js";
import FinanceOperationGuardMutation from "./financeOperationGuardMutation.js";
import StrictOrderPaymentMutation from "./strictOrderPaymentMutation.js";
import TransferPaymentMutation from "./transferMutation.js";
import { PaymentResolvers } from "./types.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";

export default {
  Query: {
    ...PaymentQuery,
    ...BankTransferPaymentQuery,
  },
  Mutation: {
    ...PaymentMutation,
    ...ReconciliationPaymentConfirmationMutation,
    ...FinanceOperationGuardMutation,
    ...StrictOrderPaymentMutation,
    ...TransferPaymentMutation,
    ...publicTablePaymentMutation,
  },
  ...PaymentResolvers,
};
