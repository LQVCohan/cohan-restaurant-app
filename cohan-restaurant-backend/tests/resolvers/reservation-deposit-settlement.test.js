import { describe, expect, it } from "vitest";
import { reservationDepositSettlementInternals } from "../../graphql/resolvers/payment/reservationDepositSettlementMutation.js";

const {
  allocateReservationDepositSettlement,
  isTableDepositRefundEligible,
  selectionCoversAllActiveOrders,
} = reservationDepositSettlementInternals;

const reservation = (overrides = {}) => ({
  _id: "64b000000000000000000001",
  orderCode: "RSV-001",
  depositAmount: 139000,
  tableDepositAmount: 100000,
  menuDepositAmount: 39000,
  linkedMenuSubtotal: 78000,
  depositAppliedAmount: 0,
  tableDepositRefundEligible: true,
  ...overrides,
});

describe("reservation deposit POS settlement", () => {
  it("collects the unpaid half of the pre-order and returns the full table deposit", () => {
    const settlement = allocateReservationDepositSettlement(
      [reservation()],
      78000,
    );

    expect(settlement).toMatchObject({
      menuDepositCredit: 39000,
      amountToCollect: 39000,
      tableDepositRefund: 100000,
      refundAmount: 100000,
      customerPays: 0,
      customerReceives: 61000,
    });
    expect(settlement.breakdown[0]).toMatchObject({
      menuDepositApplied: 39000,
      tableDepositRefunded: 100000,
      tableDepositRetained: 0,
      settledAmount: 139000,
    });
  });

  it("also collects every item ordered later before netting the table-deposit refund", () => {
    const settlement = allocateReservationDepositSettlement(
      [reservation()],
      178000,
    );

    expect(settlement).toMatchObject({
      menuDepositCredit: 39000,
      amountToCollect: 139000,
      tableDepositRefund: 100000,
      customerPays: 39000,
      customerReceives: 0,
    });
  });

  it("does not use an on-time table deposit as food-payment credit", () => {
    const settlement = allocateReservationDepositSettlement(
      [reservation()],
      500000,
    );

    expect(settlement.menuDepositCredit).toBe(39000);
    expect(settlement.amountToCollect).toBe(461000);
    expect(settlement.tableDepositRefund).toBe(100000);
    expect(settlement.customerPays).toBe(361000);
  });

  it("retains the table deposit for an ineligible late arrival but still applies the food prepayment", () => {
    const settlement = allocateReservationDepositSettlement(
      [reservation({ tableDepositRefundEligible: false })],
      78000,
    );

    expect(settlement).toMatchObject({
      menuDepositCredit: 39000,
      amountToCollect: 39000,
      tableDepositRefund: 0,
      tableDepositRetained: 100000,
      customerPays: 39000,
      customerReceives: 0,
    });
  });

  it("refunds a food-prepayment surplus after discounts instead of silently losing it", () => {
    const settlement = allocateReservationDepositSettlement(
      [reservation()],
      20000,
    );

    expect(settlement).toMatchObject({
      menuDepositCredit: 20000,
      menuDepositRefund: 19000,
      tableDepositRefund: 100000,
      amountToCollect: 0,
      customerReceives: 119000,
    });
  });

  it("derives table-deposit eligibility from the configured arrival grace window", () => {
    const base = {
      timeTo: "2026-07-14T10:00:00.000Z",
      checkedInAt: "2026-07-14T10:15:00.000Z",
    };

    expect(isTableDepositRefundEligible(base)).toBe(true);
    expect(
      isTableDepositRefundEligible({
        ...base,
        checkedInAt: "2026-07-14T10:15:00.001Z",
      }),
    ).toBe(false);
  });

  it("defers settlement until all active order batches are selected", () => {
    expect(
      selectionCoversAllActiveOrders(
        ["64b000000000000000000001"],
        [
          "64b000000000000000000001",
          "64b000000000000000000002",
        ],
      ),
    ).toBe(false);
  });
});
