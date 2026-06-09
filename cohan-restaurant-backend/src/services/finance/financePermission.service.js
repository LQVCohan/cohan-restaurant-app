import { requireRestaurantAccess } from "../../../graphql/guards.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireAnyPermission } from "../auth/authorization.service.js";

async function requireRestaurantAnyPermission(ctx, restaurantId, permissionCodes = []) {
  await requireRestaurantAccess(ctx, restaurantId);
  await requireAnyPermission(ctx, permissionCodes);
  return true;
}

export const UC18_PERMISSIONS = Object.freeze({
  financeRead: [PERMISSIONS.FINANCE_READ, PERMISSIONS.PAYMENT_READ],
  financeWrite: [PERMISSIONS.FINANCE_WRITE, PERMISSIONS.PAYMENT_WRITE],
  financeExport: [PERMISSIONS.FINANCE_EXPORT, PERMISSIONS.REPORT_EXPORT, PERMISSIONS.PAYMENT_READ],
  transactionRead: [PERMISSIONS.TRANSACTION_READ, PERMISSIONS.FINANCE_READ, PERMISSIONS.PAYMENT_READ],
  transactionWrite: [PERMISSIONS.TRANSACTION_WRITE, PERMISSIONS.FINANCE_WRITE, PERMISSIONS.PAYMENT_WRITE],
  reconciliationRead: [PERMISSIONS.RECONCILIATION_READ, PERMISSIONS.PAYMENT_READ],
  reconciliationWrite: [PERMISSIONS.RECONCILIATION_WRITE, PERMISSIONS.PAYMENT_WRITE],
  refundRead: [PERMISSIONS.REFUND_READ, PERMISSIONS.PAYMENT_READ],
  refundWrite: [PERMISSIONS.REFUND_WRITE, PERMISSIONS.PAYMENT_WRITE],
});

export const requireFinanceRead = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.financeRead);
export const requireFinanceWrite = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.financeWrite);
export const requireFinanceExport = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.financeExport);
export const requireTransactionRead = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.transactionRead);
export const requireTransactionWrite = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.transactionWrite);
export const requireReconciliationRead = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.reconciliationRead);
export const requireReconciliationWrite = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.reconciliationWrite);
export const requireRefundRead = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.refundRead);
export const requireRefundWrite = (ctx, restaurantId) =>
  requireRestaurantAnyPermission(ctx, restaurantId, UC18_PERMISSIONS.refundWrite);
