import tableQueries from "./query.js";
import tableMutations from "./mutation.js";
import { CustomerPublicTableMutation } from "./publicCustomer.js";
import TableAccessQrMutation from "./tableAccessQr.js";

import { TableCustomerQuery, TableCustomerMutation } from "./tableCustomer.js";

export default {
  Query: {
    ...tableQueries,

    ...TableCustomerQuery, // ✅ thêm
  },
  Mutation: {
    ...tableMutations,
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