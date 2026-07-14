import { describe, expect, it } from "vitest";

import {
  filterKitchenVisibleOrders,
  isStaffKitchenWorkspacePath,
  isTableQrOrderAwaitingStaffConfirmation,
} from "./kitchenOrderVisibility";

describe("kitchenOrderVisibility", () => {
  it("keeps a pending table QR order out of the kitchen queue", () => {
    const order = {
      id: "qr-pending",
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
    };

    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(true);
    expect(filterKitchenVisibleOrders([order])).toEqual([]);
  });

  it("shows the table QR order after staff confirmation", () => {
    const order = {
      id: "qr-confirmed",
      currentStatus: "confirmed",
      clientMeta: { source: "customer_table_qr" },
    };

    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(false);
    expect(filterKitchenVisibleOrders([order])).toEqual([order]);
  });

  it("does not hide other pending order sources", () => {
    const order = {
      id: "staff-order",
      currentStatus: "pending",
      clientMeta: { source: "staff_assisted" },
    };

    expect(filterKitchenVisibleOrders([order])).toEqual([order]);
  });

  it("recognizes the staff kitchen route including nested paths", () => {
    expect(isStaffKitchenWorkspacePath("/staff/kitchen")).toBe(true);
    expect(isStaffKitchenWorkspacePath("/staff/kitchen/bar")).toBe(true);
    expect(isStaffKitchenWorkspacePath("/staff/orders")).toBe(false);
  });
});
