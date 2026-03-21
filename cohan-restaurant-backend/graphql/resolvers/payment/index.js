import { PaymentQuery } from "./query.js";
import PaymentMutation from "./mutation.js";
import { PaymentResolvers } from "./types.js";

export default {
  Query: {
    ...PaymentQuery,
  },
  Mutation: {
    ...PaymentMutation,
  },
  ...PaymentResolvers,
};
