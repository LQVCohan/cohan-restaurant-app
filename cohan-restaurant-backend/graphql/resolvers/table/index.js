import tableQueries from "./query.js";
import tableMutations from "./mutation.js";

import { TableCustomerQuery, TableCustomerMutation } from "./tableCustomer.js";

export default {
  Query: {
    ...tableQueries,

    ...TableCustomerQuery, // ✅ thêm
  },
  Mutation: {
    ...tableMutations,

    ...TableCustomerMutation, // ✅ thêm
  },
};
