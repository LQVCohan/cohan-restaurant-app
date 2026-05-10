import { resolveUserRoleName } from "@/utils/frontendRoleAccess";

const ELEVATED_ROLES = new Set(["admin", "manager", "supervisor"]);

export function getStaffOrderingPermissions(
  user,
  { isRemoteOrder = false } = {},
) {
  const role = resolveUserRoleName(user);
  const isElevated = ELEVATED_ROLES.has(role);
  const isServer = role === "server";
  const isHost = role === "host";
  const isCashier = role === "cashier";
  const canMutateOrder = isElevated || isServer;

  return {
    role,
    isReadOnlyRole: isHost || isCashier,
    canViewMenu: canMutateOrder,
    canAddItems: canMutateOrder,
    canRemoveCustomer: isElevated,
    canCreateOrder: isRemoteOrder ? isElevated : canMutateOrder,
    canRequestPayment: canMutateOrder,
    canRemindItems: canMutateOrder,
    canAdjustItemQuantity: canMutateOrder,
    canRequestItemVoid: canMutateOrder,
    canCaptureProof: canMutateOrder,
    canEditPendingItem: canMutateOrder,
    canApplyVoucher: canMutateOrder,
    canMoveOrMerge: isElevated,
    canCheckout: canMutateOrder,
  };
}
