import tableQueries from "./query.js";
import tableMutations from "./mutation.js";

export default {
  Query: {
    ...tableQueries,
  },
  Mutation: {
    ...tableMutations,
  },
};
