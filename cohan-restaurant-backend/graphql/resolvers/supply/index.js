import supplyQueries from "./query.js";
import supplyMutations from "./mutation.js";

export default {
  Query: {
    ...supplyQueries,
  },
  Mutation: {
    ...supplyMutations,
  },
};
