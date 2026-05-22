const ACTIVE_ORDER_SESSION_STATUSES = new Set([
  "occupied",
  "in_use",
  "serving",
  "ordering",
]);

const RESERVATION_STATUSES = new Set(["reserved"]);

export const TABLE_DANGEROUS_TARGET_STATUSES = new Set([
  "cleaning",
  "maintenance",
  "inactive",
  "out_of_service",
]);

export function getTableGuardState(table) {
  const status = String(table?.status || "").toLowerCase();

  if (status === "payment_pending") {
    return {
      hasGuard: true,
      guardType: "unknown_payment",
      reason: "Bàn đang có giao dịch/đặt chỗ đang xử lý.",
      badge: "Đang xử lý thanh toán",
    };
  }

  if (ACTIVE_ORDER_SESSION_STATUSES.has(status)) {
    return {
      hasGuard: true,
      guardType: "active_order",
      reason: "Bàn đang có đơn hàng hoặc phiên hoạt động.",
      badge: "Đang phục vụ",
    };
  }

  if (RESERVATION_STATUSES.has(status)) {
    return {
      hasGuard: true,
      guardType: "reservation",
      reason: "Bàn đang có đặt chỗ hoặc thanh toán đặt chỗ.",
      badge: "Có đặt chỗ",
    };
  }

  return {
    hasGuard: false,
    guardType: null,
    reason: "",
    badge: "",
  };
}

export function getTableActionDisabledReason(table, action, targetStatus = "") {
  const guard = getTableGuardState(table);
  if (!guard.hasGuard) return "";

  if (action === "delete") {
    return "Không thể thao tác vì bàn đang có đặt chỗ/đơn hàng hoạt động.";
  }

  if (action === "set_status") {
    const normalizedTarget = String(targetStatus || "").toLowerCase();
    // Returning to available is backend-validated by setTableStatus. Do not block it in the UI.
    if (normalizedTarget === "available") return "";
    if (TABLE_DANGEROUS_TARGET_STATUSES.has(normalizedTarget)) {
      return "Không thể thao tác vì bàn đang có đặt chỗ/đơn hàng hoạt động.";
    }
  }

  return "";
}
