import { describe, expect, it } from "vitest";
import {
  getReservationEarliestCheckInAt,
  isReservationCheckInOpen,
} from "../../src/services/reservationTableTiming.service.js";
import { assertReservationArrivalWindow } from "../../graphql/resolvers/reservation/checkIn.js";

describe("reservation arrival window", () => {
  const reservation = {
    status: "confirmed",
    timeTo: new Date("2026-07-14T10:00:00.000Z"),
  };

  it("opens exactly 15 minutes before the reservation", () => {
    expect(getReservationEarliestCheckInAt(reservation).toISOString()).toBe(
      "2026-07-14T09:45:00.000Z",
    );
    expect(
      isReservationCheckInOpen(
        reservation,
        new Date("2026-07-14T09:45:00.000Z"),
      ),
    ).toBe(true);
    expect(() =>
      assertReservationArrivalWindow(
        reservation,
        new Date("2026-07-14T09:45:00.000Z"),
      ),
    ).not.toThrow();
  });

  it("blocks a manual or QR check-in before the 15 minute window", () => {
    expect(
      isReservationCheckInOpen(
        reservation,
        new Date("2026-07-14T09:44:59.999Z"),
      ),
    ).toBe(false);

    try {
      assertReservationArrivalWindow(
        reservation,
        new Date("2026-07-14T09:44:59.999Z"),
      );
      throw new Error("Expected check-in to be rejected");
    } catch (error) {
      expect(error.extensions?.code).toBe("RESERVATION_CHECK_IN_TOO_EARLY");
      expect(error.extensions?.earliestCheckInAt).toBe(
        "2026-07-14T09:45:00.000Z",
      );
    }
  });

  it("keeps an already seated reservation idempotent", () => {
    expect(() =>
      assertReservationArrivalWindow(
        { ...reservation, status: "seated" },
        new Date("2026-07-14T08:00:00.000Z"),
      ),
    ).not.toThrow();
  });
});
