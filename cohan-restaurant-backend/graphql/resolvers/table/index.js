import tableQueries from "./query.js";
import tableMutations from "./mutation.js";
import moveTable from "./moveTable.js";
import { CustomerPublicTableMutation } from "./publicCustomer.js";
import TableAccessQrMutation, { TableAccessQrQuery } from "./tableAccessQr.js";

import { TableCustomerQuery, TableCustomerMutation } from "./tableCustomer.js";

export default {
  Query: {
    ...tableQueries,
    ...TableAccessQrQuery,

    ...TableCustomerQuery, // ✅ thêm
  },
  Mutation: {
    ...tableMutations,
    moveTable,
    ...TableAccessQrMutation,

    ...TableCustomerMutation, // ✅ thêm
    ...CustomerPublicTableMutation,
  },
  Table: {
    viewLockUserId: (p) => p?.viewLock?.userId || null,
    viewLockExpiresAt: (p) => p?.viewLock?.expiresAt || null,
    viewLockViewerName: (p) => p?.viewLock?.viewerName || null,
    isViewingLocked: (p) => {
      const exp = p?.viewLock?.expiresAt ? new Date(p.viewLock.expiresAt) : null;
      return !!(exp && exp > new Date());
    },
  },
};
