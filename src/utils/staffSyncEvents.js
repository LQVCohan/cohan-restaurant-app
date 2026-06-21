export const STAFF_DATA_CHANGED_EVENT = "manager:staff-data-changed";
export const DASHBOARD_RESTAURANT_CHANGED_EVENT =
  "manager:dashboard-restaurant-changed";
export const DASHBOARD_RESTAURANT_STORAGE_KEY =
  "manager.dashboard.selectedRestaurantId";

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

export function emitDashboardRestaurantChanged(restaurantId) {
  if (typeof window === "undefined") return;
  const normalizedRestaurantId = String(restaurantId || "");
  if (normalizedRestaurantId) {
    localStorage.setItem(
      DASHBOARD_RESTAURANT_STORAGE_KEY,
      normalizedRestaurantId,
    );
  } else {
    localStorage.removeItem(DASHBOARD_RESTAURANT_STORAGE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_RESTAURANT_CHANGED_EVENT, {
      detail: {
        restaurantId: normalizedRestaurantId,
        changedAt: Date.now(),
      },
    }),
  );
}

export function readDashboardRestaurantId() {
  if (typeof window === "undefined") return "";
  return String(
    localStorage.getItem(DASHBOARD_RESTAURANT_STORAGE_KEY) || "",
  );
}

export function isSameRestaurantEvent(event, restaurantId) {
  const eventRestaurantId = String(event?.detail?.restaurantId || "");
  const currentRestaurantId = String(restaurantId || "");
  return (
    !eventRestaurantId ||
    !currentRestaurantId ||
    eventRestaurantId === currentRestaurantId
  );
}
