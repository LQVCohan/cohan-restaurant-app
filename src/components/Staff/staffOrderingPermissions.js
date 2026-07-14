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
    canAssignCustomer: isElevated || isServer || isHost,
    canRemoveCustomer: isElevated || isHost,
    // Nhân viên phục vụ đã có quyền tạo/cập nhật order tại nhà hàng thì cũng
    // phải hoàn tất được luồng "lên đơn hộ khách". Chỉ quyền áp dụng ưu đãi
    // cho đơn từ xa vẫn được giữ ở vai trò quản lý.
    canCreateOrder: isRemoteOrder ? isElevated || isServer : canMutateOrder,
    canRequestPayment: canMutateOrder,
    canRemindItems: canMutateOrder,
    canAdjustItemQuantity: canMutateOrder,
    canRequestItemVoid: canMutateOrder,
    canCaptureProof: canMutateOrder,
    canEditPendingItem: canMutateOrder,
    canApplyCoupon: isElevated,
    canMoveOrMerge: isElevated,
    canCheckout: canMutateOrder,
  };
}
