import { describe, expect, it } from "vitest";
import { orderCoreRecoveryInternals } from "../../graphql/resolvers/order/queryCoreRecovery.js";

const {
  classifyOrdersByReservationSchedule,
  filterActiveOrders,
  isDetachedReservationPreorder,
  isFutureReservationOrder,
} = orderCoreRecoveryInternals;

const NOW = new Date("2026-07-14T09:00:00.000Z");

function reservationMap(reservation) {
  return new Map([[String(reservation._id), reservation]]);
}

describe("POS reservation preorder visibility", () => {
  it("does not treat an unattached reservation preorder as an active table order", () => {
    const preorder = {
      reservationId: "64b000000000000000000001",
      parentOrderId: null,
      rootOrderId: null,
      currentStatus: "confirmed",
    };
    expect(isDetachedReservationPreorder(preorder)).toBe(true);
    expect(filterActiveOrders([preorder])).toEqual([]);
  });

  it("keeps a future preorder out of POS even when legacy data attached it early", () => {
    const order = {
      id: "order-future",
      reservationId: "64b000000000000000000001",
      parentOrderId: "64b000000000000000000010",
      rootOrderId: "64b000000000000000000010",
      currentStatus: "confirmed",
    };
    const reservation = {
      _id: order.reservationId,
      status: "confirmed",
      timeTo: new Date("2026-07-14T11:00:00.000Z"),
      customerName: "Khách đặt trước",
      partySize: 4,
    };

    expect(isFutureReservationOrder(order, reservation, NOW)).toBe(true);
    const result = classifyOrdersByReservationSchedule(
      [order],
      reservationMap(reservation),
      NOW,
    );

    expect(result.activeOrders).toEqual([]);
    expect(result.futureOrders).toHaveLength(1);
    expect(result.futureOrders[0].customerInfo).toMatchObject({
      name: "Khách đặt trước",
      partySize: 4,
      timeTo: "2026-07-14T11:00:00.000Z",
    });
  });

  it("loads the preorder into active POS when its reservation time arrives", () => {
    const order = {
      id: "order-due",
      reservationId: "64b000000000000000000002",
      currentStatus: "confirmed",
    };
    const reservation = {
      _id: order.reservationId,
      status: "confirmed",
      timeTo: new Date("2026-07-14T09:00:00.000Z"),
    };

    const result = classifyOrdersByReservationSchedule(
      [order],
      reservationMap(reservation),
      NOW,
    );
    expect(result.futureOrders).toEqual([]);
    expect(result.activeOrders).toHaveLength(1);
  });

  it("shows an early preorder immediately after staff check-in", () => {
    const order = {
      id: "order-seated",
      reservationId: "64b000000000000000000003",
      currentStatus: "confirmed",
    };
    const reservation = {
      _id: order.reservationId,
      status: "seated",
      timeTo: new Date("2026-07-14T12:00:00.000Z"),
    };

    const result = classifyOrdersByReservationSchedule(
      [order],
      reservationMap(reservation),
      NOW,
    );
    expect(result.futureOrders).toEqual([]);
    expect(result.activeOrders).toHaveLength(1);
  });

  it("does not release an unpaid preorder into POS when the scheduled time passes", () => {
    const order = {
      id: "order-unpaid",
      reservationId: "64b000000000000000000004",
      currentStatus: "confirmed",
    };
    const reservation = {
      _id: order.reservationId,
      status: "pending_payment",
      timeTo: new Date("2026-07-14T08:30:00.000Z"),
    };

    const result = classifyOrdersByReservationSchedule(
      [order],
      reservationMap(reservation),
      NOW,
    );
    expect(result.activeOrders).toEqual([]);
    expect(result.futureOrders).toEqual([]);
  });
});
