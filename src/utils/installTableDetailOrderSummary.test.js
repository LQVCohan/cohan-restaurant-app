import { describe, expect, it } from "vitest";
import {
  filterActiveTableOrders,
  summarizeTableOrders,
} from "./installTableDetailOrderSummary";

const order = (overrides = {}) => ({
  id: overrides.id || overrides.orderCode,
  orderCode: "ORD-001",
  tableCode: "T101",
  orderType: "dine_in",
  currentStatus: "preparing",
  payment: { status: "unpaid" },
  totals: { grandTotal: 100000 },
  ...overrides,
});

describe("table detail active order summary", () => {
  it("keeps every active order for the selected table instead of only the first one", () => {
    const result = filterActiveTableOrders(
      [
        order({ id: "1", orderCode: "ORD-001" }),
        order({ id: "2", orderCode: "ORD-002", currentStatus: "served" }),
        order({ id: "3", orderCode: "ORD-003", tableCode: "T102" }),
      ],
      "T101",
    );

    expect(result.map((item) => item.orderCode)).toEqual([
      "ORD-001",
      "ORD-002",
    ]);
  });

  it("removes completed, cancelled and off-premise orders", () => {
    const result = filterActiveTableOrders(
      [
        order({ id: "1", orderCode: "ACTIVE" }),
        order({ id: "2", orderCode: "DONE", currentStatus: "completed" }),
        order({ id: "3", orderCode: "CANCELLED", currentStatus: "cancelled" }),
        order({ id: "4", orderCode: "SHIP", orderType: "delivery" }),
      ],
      "T101",
    );

    expect(result).toHaveLength(1);
    expect(result[0].orderCode).toBe("ACTIVE");
  });

  it("prioritizes payment requests and calculates the combined amount", () => {
    const orders = filterActiveTableOrders(
      [
        order({
          id: "1",
          orderCode: "ORD-010",
          payment: { status: "unpaid" },
          totals: { grandTotal: 120000 },
        }),
        order({
          id: "2",
          orderCode: "ORD-020",
          payment: { status: "payment_requested" },
          totals: { grandTotal: 80000 },
        }),
      ],
      "T101",
    );

    expect(orders[0].orderCode).toBe("ORD-020");
    expect(summarizeTableOrders(orders)).toEqual({
      orderCount: 2,
      paymentRequestedCount: 1,
      paidCount: 0,
      totalAmount: 200000,
    });
  });

  it("deduplicates repeated rows returned for the same order", () => {
    const result = filterActiveTableOrders(
      [
        order({ id: "same", orderCode: "ORD-001" }),
        order({ id: "same", orderCode: "ORD-001" }),
      ],
      "T101",
    );

    expect(result).toHaveLength(1);
  });
});
