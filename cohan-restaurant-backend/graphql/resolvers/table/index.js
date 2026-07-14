import tableQueries from "./query.js";
import tableMutations from "./mutation.js";
import tableIntegrityMutations from "./integrityMutations.js";
import mergeTableMutations from "./mergeTables.js";
import { resolveTableMergeDetails } from "./mergeDetails.js";
import moveTable from "./moveTable.js";
import { CustomerPublicTableMutation } from "./publicCustomer.js";
import TableAccessQrMutation, { TableAccessQrQuery } from "./tableAccessQr.js";
import { withReservationAwareTableStatus } from "./reservationStatusGuard.js";

import { TableCustomerQuery, TableCustomerMutation } from "./tableCustomer.js";

const reservationAwareTableMutations =
  withReservationAwareTableStatus(tableMutations);

export default {
  Query: {
    ...tableQueries,
    ...TableAccessQrQuery,

    ...TableCustomerQuery, // ✅ thêm
  },
  Mutation: {
    ...reservationAwareTableMutations,
    ...tableIntegrityMutations,
    ...mergeTableMutations,
    moveTable,
    ...TableAccessQrMutation,

    ...TableCustomerMutation, // ✅ thêm
    ...CustomerPublicTableMutation,
  },
  Table: {
    deposit: (p) => {
      const amount = Number(p?.deposit || 0);
      return amount === 1 ? 0 : Math.max(0, Number.isFinite(amount) ? amount : 0);
    },
    viewLockUserId: (p) => p?.viewLock?.userId || null,
    viewLockExpiresAt: (p) => p?.viewLock?.expiresAt || null,
    viewLockViewerName: (p) => p?.viewLock?.viewerName || null,
    mergeDetails: (p, _args, ctx) => resolveTableMergeDetails(p, ctx),
    isViewingLocked: (p) => {
      const exp = p?.viewLock?.expiresAt ? new Date(p.viewLock.expiresAt) : null;
      return !!(exp && exp > new Date());
    },
  },
};
