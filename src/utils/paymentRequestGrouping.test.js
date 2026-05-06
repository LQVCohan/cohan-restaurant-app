import { describe, expect, it } from "vitest";
import {
  getPaymentRequestGroupKey,
  groupPaymentRequests,
  isRealDineInTableCode,
} from "./paymentRequestGrouping";

describe("paymentRequestGrouping", () => {
  it("groups dine-in requests by real tableCode", () => {
    const grouped = groupPaymentRequests([
      { orderId: "o1", orderCode: "A", orderType: "dine_in", tableCode: "T1", totals: { grandTotal: 100 } },
      { orderId: "o2", orderCode: "B", orderType: "dine_in", tableCode: "T1", totals: { grandTotal: 200 } },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].groupKey).toBe("table:T1");
    expect(grouped[0].totals.grandTotal).toBe(300);
    expect(grouped[0].orderIds).toEqual(["o1", "o2"]);
  });

  it("does not merge takeaway requests by virtual tableCode", () => {
    const grouped = groupPaymentRequests([
      { orderId: "o1", orderCode: "TAKE-1", orderType: "takeaway", tableCode: "TAKEAWAY", totals: { grandTotal: 100 } },
      { orderId: "o2", orderCode: "TAKE-2", orderType: "takeaway", tableCode: "TAKEAWAY", totals: { grandTotal: 200 } },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.groupKey)).toEqual(["order:o1", "order:o2"]);
  });

  it("does not merge delivery requests by virtual tableCode", () => {
    expect(getPaymentRequestGroupKey({ orderType: "delivery", tableCode: "DELIVERY", orderId: "d1" })).toBe("order:d1");
    expect(isRealDineInTableCode("dine_in", "DELIVERY")).toBe(false);
  });
});
