import { describe, expect, it } from "vitest";
import { orderCoreRecoveryInternals } from "../../graphql/resolvers/order/queryCoreRecovery.js";

const { filterActiveOrders, isDetachedReservationPreorder } =
  orderCoreRecoveryInternals;

describe("POS reservation preorder visibility", () => {
  it("does not treat an unattached future reservation preorder as an active table order", () => {
    const preorder = {
      reservationId: "64b000000000000000000001",
      parentOrderId: null,
      rootOrderId: null,
      currentStatus: "confirmed",
    };
    expect(isDetachedReservationPreorder(preorder)).toBe(true);
    expect(filterActiveOrders([preorder])).toEqual([]);
  });

  it("shows the same preorder after check-in attaches it to the table session", () => {
    const checkedInOrder = {
      reservationId: "64b000000000000000000001",
      parentOrderId: "64b000000000000000000010",
      rootOrderId: "64b000000000000000000010",
      currentStatus: "confirmed",
    };
    expect(isDetachedReservationPreorder(checkedInOrder)).toBe(false);
    expect(filterActiveOrders([checkedInOrder])).toEqual([checkedInOrder]);
  });
});
