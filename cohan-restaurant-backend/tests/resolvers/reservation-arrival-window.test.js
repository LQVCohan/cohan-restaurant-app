import { describe, expect, it } from "vitest";
import {
  getReservationEarliestCheckInAt,
  isReservationCheckInOpen,
} from "../../src/services/reservationTableTiming.service.js";
import { assertReservationArrivalWindow } from "../../graphql/resolvers/reservation/checkIn.js";
import { isOnTimeReservationArrival } from "../../graphql/resolvers/reservation/arrivalAudit.js";

describe("reservation arrival window", () => {
  const reservation = {
    status: "confirmed",
    orderCode: "RSV-001",
    customerName: "Nguyễn Minh Anh",
    tableCode: "T101",
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

  it("returns early-arrival details before the normal 15 minute window", () => {
    expect(
      isReservationCheckInOpen(
        reservation,
        new Date("2026-07-14T09:30:00.000Z"),
      ),
    ).toBe(false);

    try {
      assertReservationArrivalWindow(
        reservation,
        new Date("2026-07-14T09:30:00.000Z"),
      );
      throw new Error("Expected early arrival confirmation to be required");
    } catch (error) {
      expect(error.extensions?.code).toBe("RESERVATION_CHECK_IN_TOO_EARLY");
      expect(error.extensions?.earliestCheckInAt).toBe(
        "2026-07-14T09:45:00.000Z",
      );
      expect(error.extensions?.reservationTime).toBe(
        "2026-07-14T10:00:00.000Z",
      );
      expect(error.extensions?.minutesBeforeReservation).toBe(30);
      expect(error.extensions?.requiresStaffConfirmation).toBe(true);
      expect(error.extensions?.orderCode).toBe("RSV-001");
      expect(error.extensions?.customerName).toBe("Nguyễn Minh Anh");
      expect(error.extensions?.tableCode).toBe("T101");
    }
  });

  it("allows an early check-in only after explicit staff confirmation", () => {
    expect(() =>
      assertReservationArrivalWindow(
        reservation,
        new Date("2026-07-14T09:30:00.000Z"),
        { confirmEarlyArrival: true },
      ),
    ).not.toThrow();
  });

  it("marks arrival through the 15 minute grace boundary as on time", () => {
    expect(
      isOnTimeReservationArrival(
        reservation,
        new Date("2026-07-14T10:15:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isOnTimeReservationArrival(
        reservation,
        new Date("2026-07-14T10:15:00.001Z"),
      ),
    ).toBe(false);
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
