import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toFiniteInteger = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
};

const resolvers = {
  Query: {
    ...staffQuery,
    ...payrollReadinessQuery,
  },
  Mutation: {
    ...staffMutation,
    ...payrollFinalizeReadinessMutation,
  },
  PayrollStats: {
    totalPayroll: (source) => toFiniteNumber(source?.totalPayroll),
    paidAmount: (source) => toFiniteNumber(source?.paidAmount),
    remaining: (source) => toFiniteNumber(source?.remaining),
    progress: (source) => toFiniteInteger(source?.progress),
  },
};

export default resolvers;
