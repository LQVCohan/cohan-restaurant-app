import { PaymentQuery } from "./query.js";
import { BankTransferPaymentQuery } from "./bankTransferQuery.js";
import PaymentMutation from "./mutation.js";
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
    ...TransferPaymentMutation,
    ...publicTablePaymentMutation,
  },
  ...PaymentResolvers,
};
