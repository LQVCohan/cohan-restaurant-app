import { describe, expect, it } from "vitest";

import {
  filterKitchenVisibleOrders,
  isStaffKitchenWorkspacePath,
  isTableQrOrderAwaitingStaffConfirmation,
  requiresOrderItemProofImage,
} from "./kitchenOrderVisibility";

const weightedItem = {
  id: "weighted-item",
  status: "pending",
  unit: "kg",
  servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
};

const regularItem = {
  id: "regular-item",
  status: "pending",
  unit: "phần",
  servingVariant: { mode: "FIXED", sellUnit: "phần" },
};

describe("kitchenOrderVisibility", () => {
  it("marks a pending table QR order with proof-required items as waiting for staff", () => {
    const order = {
      id: "qr-proof-pending",
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [weightedItem],
    };

    expect(requiresOrderItemProofImage(weightedItem)).toBe(true);
    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(true);
    expect(filterKitchenVisibleOrders([order])).toEqual([order]);
  });

  it("lets the kitchen receive a pending table QR order without proof-required items", () => {
    const order = {
      id: "qr-regular-pending",
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [regularItem],
    };

    expect(requiresOrderItemProofImage(regularItem)).toBe(false);
    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(false);
    expect(filterKitchenVisibleOrders([order])).toEqual([order]);
  });

  it("stops waiting after staff confirmation", () => {
    const order = {
      id: "qr-confirmed",
      currentStatus: "confirmed",
      clientMeta: { source: "customer_table_qr" },
      items: [weightedItem],
    };

    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(false);
  });

  it("does not gate other pending order sources", () => {
    const order = {
      id: "staff-order",
      currentStatus: "pending",
      clientMeta: { source: "staff_assisted" },
      items: [weightedItem],
    };

    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(false);
  });

  it("ignores cancelled proof-required items", () => {
    const order = {
      id: "qr-cancelled-weighted",
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [{ ...weightedItem, status: "cancelled" }],
    };

    expect(isTableQrOrderAwaitingStaffConfirmation(order)).toBe(false);
  });

  it("recognizes the staff kitchen route including nested paths", () => {
    expect(isStaffKitchenWorkspacePath("/staff/kitchen")).toBe(true);
    expect(isStaffKitchenWorkspacePath("/staff/kitchen/bar")).toBe(true);
    expect(isStaffKitchenWorkspacePath("/staff/orders")).toBe(false);
  });
});
