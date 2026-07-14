import { describe, expect, it } from "vitest";
import {
  buildFutureReservationNotice,
  getTableReservationTime,
  hasFutureTableReservation,
} from "./posReservationSchedule";

const NOW = new Date("2026-07-14T09:00:00.000Z");

describe("POS reservation schedule helpers", () => {
  it("recognizes a confirmed reservation in the future", () => {
    const table = {
      code: "T108",
      reservationStatus: "confirmed",
      nextReservationAt: "2026-07-14T10:30:00.000Z",
    };

    expect(getTableReservationTime(table)?.toISOString()).toBe(
      "2026-07-14T10:30:00.000Z",
    );
    expect(hasFutureTableReservation(table, NOW)).toBe(true);
  });

  it("does not treat seated or expired reservations as future", () => {
    expect(
      hasFutureTableReservation(
        {
          reservationStatus: "seated",
          nextReservationAt: "2026-07-14T10:30:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      hasFutureTableReservation(
        {
          reservationStatus: "confirmed",
          nextReservationAt: "2026-07-14T08:30:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("explains that preorder dishes remain available in Order trước", () => {
    const notice = buildFutureReservationNotice({
      code: "T108",
      reservationStatus: "confirmed",
      nextReservationAt: "2026-07-14T10:30:00.000Z",
    });

    expect(notice).toContain("Bàn T108");
    expect(notice).toContain("sẽ tự tải khi tới giờ");
    expect(notice).toContain("Order trước");
  });
});
