import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";

const resolvers = {
  Query: {
    ...staffQuery,
    ...payrollReadinessQuery,
  },
  Mutation: {
    ...staffMutation,
  },
};

export default resolvers;
