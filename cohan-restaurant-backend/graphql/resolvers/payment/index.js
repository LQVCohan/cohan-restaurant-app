import { PaymentQuery } from "./query.js";
import PaymentMutation from "./mutation.js";
import TransferPaymentMutation from "./transferMutation.js";
import { PaymentResolvers } from "./types.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";

export default {
  Query: {
    ...PaymentQuery,
  },
  Mutation: {
    ...PaymentMutation,
    ...TransferPaymentMutation,
    ...publicTablePaymentMutation,
  },
  ...PaymentResolvers,
};
