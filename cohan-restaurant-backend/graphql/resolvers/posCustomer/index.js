import { PosCustomerQuery } from "./query.js";
import { PosCustomerMutation } from "./mutation.js";

const PosCustomerResolvers = {
  Query: {
    ...(PosCustomerQuery || {}),
  },
  Mutation: {
    ...(PosCustomerMutation || {}),
  },
};

export default PosCustomerResolvers;
