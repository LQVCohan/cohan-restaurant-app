import { PaymentQuery } from "./query.js";
import PaymentMutation from "./mutation.js";
import { PaymentResolvers } from "./types.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";

export default {
  Query: {
    ...PaymentQuery,
  },
  Mutation: {
    ...PaymentMutation,
    ...publicTablePaymentMutation,
  },
  ...PaymentResolvers,
};
