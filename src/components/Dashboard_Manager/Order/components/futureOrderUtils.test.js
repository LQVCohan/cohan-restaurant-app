import { describe, expect, it } from "vitest";
import {
  getFutureOrderItemCount,
  getFutureOrderSchedule,
  sortFutureOrders,
} from "./futureOrderUtils";

describe("future order presentation helpers", () => {
  it("sorts preorder rows by reservation serving time", () => {
    const later = {
      id: "later",
      customerInfo: { timeTo: "2026-07-14T12:00:00.000Z" },
    };
    const sooner = {
      id: "sooner",
      clientMeta: { reservationTimeTo: "2026-07-14T10:00:00.000Z" },
    };

    expect(sortFutureOrders([later, sooner])).toEqual([sooner, later]);
  });

  it("reads the schedule from customer info before metadata fallback", () => {
    const order = {
      customerInfo: { timeTo: "2026-07-14T11:00:00.000Z" },
      clientMeta: { reservationTimeTo: "2026-07-14T12:00:00.000Z" },
    };

    expect(getFutureOrderSchedule(order)?.toISOString()).toBe(
      "2026-07-14T11:00:00.000Z",
    );
  });

  it("counts the total quantity of dishes in an advance order", () => {
    expect(
      getFutureOrderItemCount({
        items: [{ quantity: 2 }, { quantity: 1.5 }, { quantity: 0 }],
      }),
    ).toBe(3.5);
  });
});
