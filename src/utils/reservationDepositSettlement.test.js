import { describe, expect, it } from "vitest";
import {
  calculateReservationDepositSettlement,
  getReservationDepositAvailability,
} from "./reservationDepositSettlement";

describe("reservation deposit settlement UI calculator", () => {
  it("uses only the food deposit as invoice credit and returns the table deposit", () => {
    const availability = getReservationDepositAvailability({
      depositAmount: 139000,
      tableDepositAmount: 100000,
      menuDepositAmount: 39000,
      depositAppliedAmount: 0,
      tableDepositRefundEligible: true,
    });
    const settlement = calculateReservationDepositSettlement({
      grossTotal: 78000,
      ...availability,
    });

    expect(settlement).toMatchObject({
      menuDepositCredit: 39000,
      amountToCollect: 39000,
      tableDepositRefund: 100000,
      customerPays: 0,
      customerReceives: 61000,
    });
  });

  it("adds later orders before calculating the customer-facing difference", () => {
    const settlement = calculateReservationDepositSettlement({
      grossTotal: 178000,
      menuDepositAvailable: 39000,
      tableDepositRefundAmount: 100000,
    });

    expect(settlement).toMatchObject({
      amountToCollect: 139000,
      customerPays: 39000,
      customerReceives: 0,
    });
  });

  it("does not return an ineligible late-arrival table deposit", () => {
    const availability = getReservationDepositAvailability({
      depositAmount: 139000,
      tableDepositAmount: 100000,
      menuDepositAmount: 39000,
      tableDepositRefundEligible: false,
    });

    expect(availability).toMatchObject({
      menuDepositAvailable: 39000,
      tableDepositRefundAmount: 0,
      tableDepositRetainedAmount: 100000,
    });
  });
});
