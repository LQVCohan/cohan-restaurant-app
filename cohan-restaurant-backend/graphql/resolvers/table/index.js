import tableQueries from "./query.js";
import tableMutations from "./mutation.js";
import { TableDraftQuery, TableDraftMutation } from "./tableDraft.js";
export default {
  Query: {
    ...tableQueries,
    ...TableDraftQuery,
  },
  Mutation: {
    ...tableMutations,
    ...TableDraftMutation,
  },
};
