import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";

const resolvers = {
  Query: {
    ...staffQuery,
    ...payrollReadinessQuery,
  },
  Mutation: {
    ...staffMutation,
    ...payrollFinalizeReadinessMutation,
  },
};

export default resolvers;
