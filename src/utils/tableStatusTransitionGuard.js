export const POS_MANAGED_STATUS_TRANSITIONS_STRICT = new Set([
  "available->occupied",
  "reserved->occupied",
  "occupied->payment_pending",
  "payment_pending->cleaning",
  "occupied->cleaning",
  "reserved->cleaning",
]);

export const BACKEND_VALIDATED_STATUS_TRANSITIONS = new Set([
  "occupied->available",
  "payment_pending->available",
  "cleaning->available",
]);

export const normalizeTableStatus = (status) =>
  String(status || "").trim().toLowerCase();

export const isPosManagedStatusTransition = (currentStatus, nextStatus) =>
  POS_MANAGED_STATUS_TRANSITIONS_STRICT.has(
    `${normalizeTableStatus(currentStatus)}->${normalizeTableStatus(nextStatus)}`
  );

export const isBackendValidatedStatusTransition = (currentStatus, nextStatus) =>
  BACKEND_VALIDATED_STATUS_TRANSITIONS.has(
    `${normalizeTableStatus(currentStatus)}->${normalizeTableStatus(nextStatus)}`
  );

export const POS_MANAGED_STATUS_TRANSITION_MESSAGE =
  "Vui lòng thao tác nhận khách, thanh toán hoặc dọn bàn tại POS để đồng bộ order và phiên bàn.";

export const POS_MANAGED_STATUS_TRANSITION_TITLE =
  "Vui lòng thao tác tại POS để đồng bộ order và phiên bàn.";
