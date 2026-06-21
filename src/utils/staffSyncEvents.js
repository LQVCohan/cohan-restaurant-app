export const STAFF_DATA_CHANGED_EVENT = "manager:staff-data-changed";

export function emitStaffDataChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(STAFF_DATA_CHANGED_EVENT, {
      detail: {
        source: "staff-management",
        changedAt: Date.now(),
        ...detail,
      },
    }),
  );
}

export function isSameRestaurantEvent(event, restaurantId) {
  const eventRestaurantId = String(event?.detail?.restaurantId || "");
  const currentRestaurantId = String(restaurantId || "");
  return !eventRestaurantId || !currentRestaurantId || eventRestaurantId === currentRestaurantId;
}
