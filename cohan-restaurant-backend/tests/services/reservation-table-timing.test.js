import { afterEach, describe, expect, it, vi } from "vitest";

import { Order, Reservation, Table } from "../../models/index.js";
import {
  getReservationTimingPhase,
  getTableReservationSnapshot,
  synchronizeReservationOwnedTableState,
} from "../../src/services/reservationTableTiming.service.js";

const RESTAURANT_ID = "507f1f77bcf86cd799439011";
const TABLE_ID = "507f1f77bcf86cd799439012";
const RESERVATION_ID = "507f1f77bcf86cd799439013";

const chain = (result) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(result),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reservation table timing", () => {
  it("classifies future, waiting and expired reservations around the 15 minute grace", () => {
    const arrival = new Date("2026-08-01T11:00:00.000Z");
    const reservation = { timeTo: arrival };

    expect(
      getReservationTimingPhase(
        reservation,
        new Date("2026-08-01T10:59:59.000Z"),
      ),
    ).toBe("upcoming");
    expect(
      getReservationTimingPhase(
        reservation,
        new Date("2026-08-01T11:10:00.000Z"),
      ),
    ).toBe("waiting");
    expect(
      getReservationTimingPhase(
        reservation,
        new Date("2026-08-01T11:15:01.000Z"),
      ),
    ).toBe("expired");
  });

  it("returns the staff-facing customer and countdown snapshot", async () => {
    vi.spyOn(Reservation, "findOne").mockReturnValue(
      chain({
        _id: RESERVATION_ID,
        orderCode: "RSV-001",
        timeTo: "2099-08-01T18:00:00.000Z",
        status: "confirmed",
        customerName: "Nguyễn An",
        customerPhone: "0900000000",
        customerEmail: "an@example.test",
        partySize: 4,
      }),
    );

    const snapshot = await getTableReservationSnapshot(
      { _id: TABLE_ID, restaurantId: RESTAURANT_ID },
      { user: { id: "staff-1" } },
      new Date("2099-08-01T11:00:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      reservationId: RESERVATION_ID,
      reservationOrderCode: "RSV-001",
      reservationPhase: "upcoming",
      reservationCustomerName: "Nguyễn An",
      reservationCustomerPhone: "0900000000",
      reservationCustomerEmail: "an@example.test",
      reservationPartySize: 4,
    });
    expect(snapshot.reservationGraceEndsAt.toISOString()).toBe(
      "2099-08-01T18:15:00.000Z",
    );
  });

  it("releases a table that was locked early by a future reservation", async () => {
    vi.spyOn(Table, "findOne").mockReturnValue(
      chain({
        _id: TABLE_ID,
        restaurantId: RESTAURANT_ID,
        code: "T201",
        status: "reserved",
      }),
    );
    vi.spyOn(Order, "findOne").mockReturnValue(chain(null));
    vi.spyOn(Reservation, "findOne").mockReturnValue(chain(null));
    const updateOne = vi.spyOn(Table, "updateOne").mockResolvedValue({});

    await synchronizeReservationOwnedTableState({
      _id: RESERVATION_ID,
      restaurantId: RESTAURANT_ID,
      tableId: TABLE_ID,
      timeTo: "2099-08-01T18:00:00.000Z",
      status: "confirmed",
    });

    expect(updateOne).toHaveBeenCalledWith(
      {
        _id: TABLE_ID,
        status: { $in: ["reserved", "payment_pending"] },
      },
      { $set: { status: "available" } },
    );
  });

  it("marks the table reserved only during the arrival grace window", async () => {
    vi.spyOn(Table, "findOne").mockReturnValue(
      chain({
        _id: TABLE_ID,
        restaurantId: RESTAURANT_ID,
        code: "T201",
        status: "available",
      }),
    );
    vi.spyOn(Order, "findOne").mockReturnValue(chain(null));
    vi.spyOn(Reservation, "findOne").mockReturnValue(
      chain({ _id: RESERVATION_ID, timeTo: new Date() }),
    );
    const updateOne = vi.spyOn(Table, "updateOne").mockResolvedValue({});

    await synchronizeReservationOwnedTableState({
      _id: RESERVATION_ID,
      restaurantId: RESTAURANT_ID,
      tableId: TABLE_ID,
      status: "confirmed",
    });

    expect(updateOne).toHaveBeenCalledWith(
      { _id: TABLE_ID },
      { $set: { status: "reserved" } },
    );
  });
});
