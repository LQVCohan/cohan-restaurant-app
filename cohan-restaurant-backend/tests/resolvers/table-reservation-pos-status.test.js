import { describe, expect, it } from "vitest";
import { GraphQLError } from "graphql";
import { resolveManagerTableStatus } from "../../graphql/resolvers/table/query.js";
import { assertReservationAwareOccupiedTransition } from "../../graphql/resolvers/table/reservationStatusGuard.js";

describe("reservation-aware POS table status", () => {
  it("repairs a stale occupied status before the reservation window when no session exists", () => {
    expect(
      resolveManagerTableStatus({
        storedStatus: "occupied",
        reservationPhase: "upcoming",
        hasActiveSession: false,
      }),
    ).toBe("available");
  });

  it("shows the table as reserved when the guest is in the arrival window", () => {
    expect(
      resolveManagerTableStatus({
        storedStatus: "occupied",
        reservationPhase: "waiting",
        hasActiveSession: false,
      }),
    ).toBe("reserved");
  });

  it("keeps occupied when a real table session is active", () => {
    expect(
      resolveManagerTableStatus({
        storedStatus: "occupied",
        reservationPhase: "upcoming",
        hasActiveSession: true,
      }),
    ).toBe("occupied");
  });

  it("blocks direct occupied mutations for confirmed reservations", () => {
    expect(() =>
      assertReservationAwareOccupiedTransition({
        reservationId: "64b000000000000000000001",
        reservationStatus: "confirmed",
        reservationCanCheckIn: false,
      }),
    ).toThrow(GraphQLError);
  });
});
