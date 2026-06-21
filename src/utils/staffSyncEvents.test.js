import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_RESTAURANT_CHANGED_EVENT,
  DASHBOARD_RESTAURANT_STORAGE_KEY,
  STAFF_DATA_CHANGED_EVENT,
  emitDashboardRestaurantChanged,
  emitStaffDataChanged,
  isSameRestaurantEvent,
  readDashboardRestaurantId,
} from "./staffSyncEvents";

afterEach(() => {
  localStorage.removeItem(DASHBOARD_RESTAURANT_STORAGE_KEY);
  vi.restoreAllMocks();
});

describe("staff dashboard synchronization events", () => {
  it("broadcasts staff changes with restaurant scope", () => {
    const listener = vi.fn();
    window.addEventListener(STAFF_DATA_CHANGED_EVENT, listener);

    emitStaffDataChanged({
      action: "avatar-updated",
      employeeId: "staff-1",
      restaurantId: "restaurant-1",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      action: "avatar-updated",
      employeeId: "staff-1",
      restaurantId: "restaurant-1",
    });
    window.removeEventListener(STAFF_DATA_CHANGED_EVENT, listener);
  });

  it("persists and broadcasts the selected dashboard restaurant", () => {
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_RESTAURANT_CHANGED_EVENT, listener);

    emitDashboardRestaurantChanged("restaurant-2");

    expect(readDashboardRestaurantId()).toBe("restaurant-2");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.restaurantId).toBe("restaurant-2");
    window.removeEventListener(DASHBOARD_RESTAURANT_CHANGED_EVENT, listener);
  });

  it("matches only the dashboard restaurant affected by an event", () => {
    const matchingEvent = {
      detail: { restaurantId: "restaurant-1" },
    };

    expect(isSameRestaurantEvent(matchingEvent, "restaurant-1")).toBe(true);
    expect(isSameRestaurantEvent(matchingEvent, "restaurant-2")).toBe(false);
    expect(isSameRestaurantEvent({ detail: {} }, "restaurant-2")).toBe(true);
  });
});
