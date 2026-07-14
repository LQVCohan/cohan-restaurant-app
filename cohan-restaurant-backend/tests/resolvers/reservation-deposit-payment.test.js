import { describe, expect, it } from "vitest";
import { reservationDepositPaymentInternals } from "../../graphql/resolvers/payment/reservationDepositPaymentMutation.js";

const {
  allocateDepositCredit,
  availableDeposit,
  isTableDepositCreditEligible,
  selectionCoversAllActiveOrders,
} = reservationDepositPaymentInternals;

describe("reservation deposit POS allocation", () => {
  it("subtracts both table and menu deposits when the guest arrived on time", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          orderCode: "RSV-001",
          depositAmount: 150000,
          tableDepositAmount: 100000,
          menuDepositAmount: 50000,
          linkedMenuSubtotal: 100000,
          depositAppliedAmount: 0,
          tableDepositRefundEligible: true,
        },
      ],
      500000,
    );

    expect(allocation.totalCredit).toBe(150000);
    expect(allocation.breakdown[0]).toMatchObject({
      tableDepositEligible: true,
      tableDepositApplied: 100000,
      menuDepositApplied: 50000,
      tableDepositRetained: 0,
      appliedAmount: 150000,
    });
  });

  it("always subtracts the 50 percent menu deposit but retains a late-arrival table deposit", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          orderCode: "RSV-001",
          depositAmount: 150000,
          tableDepositAmount: 100000,
          menuDepositAmount: 50000,
          tableDepositRefundEligible: false,
        },
      ],
      500000,
    );

    expect(allocation.totalCredit).toBe(50000);
    expect(allocation.totalTableDepositRetained).toBe(100000);
    expect(allocation.breakdown[0]).toMatchObject({
      tableDepositEligible: false,
      tableDepositApplied: 0,
      menuDepositApplied: 50000,
      tableDepositRetained: 100000,
      appliedAmount: 50000,
    });
  });

  it("settles a retained table-only deposit even when no credit is applied", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          depositAmount: 100000,
          tableDepositAmount: 100000,
          menuDepositAmount: 0,
          tableDepositRefundEligible: false,
        },
      ],
      500000,
    );

    expect(allocation.totalCredit).toBe(0);
    expect(allocation.breakdown).toHaveLength(1);
    expect(allocation.breakdown[0].tableDepositRetained).toBe(100000);
  });

  it("caps the deposit credit at the invoice gross total while prioritizing menu prepayment", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          depositAmount: 150000,
          tableDepositAmount: 100000,
          menuDepositAmount: 50000,
          depositAppliedAmount: 0,
          tableDepositRefundEligible: true,
        },
      ],
      120000,
    );

    expect(allocation.totalCredit).toBe(120000);
    expect(allocation.breakdown[0]).toMatchObject({
      tableDepositApplied: 70000,
      menuDepositApplied: 50000,
    });
  });

  it("never reuses an amount that was already applied", () => {
    expect(
      availableDeposit({ depositAmount: 150000, depositAppliedAmount: 150000 }),
    ).toBe(0);
    expect(
      availableDeposit({ depositAmount: 150000, depositAppliedAmount: 40000 }),
    ).toBe(110000);
  });

  it("derives punctual table-deposit eligibility from the existing grace window", () => {
    const reservation = {
      timeTo: "2026-07-14T10:00:00.000Z",
      checkedInAt: "2026-07-14T10:15:00.000Z",
    };
    expect(isTableDepositCreditEligible(reservation)).toBe(true);
    expect(
      isTableDepositCreditEligible({
        ...reservation,
        checkedInAt: "2026-07-14T10:15:00.001Z",
      }),
    ).toBe(false);
  });

  it("allocates multiple reservation credits only until the invoice is covered", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          depositAmount: 100000,
          tableDepositAmount: 100000,
          menuDepositAmount: 0,
        },
        {
          _id: "64b000000000000000000002",
          depositAmount: 80000,
          tableDepositAmount: 30000,
          menuDepositAmount: 50000,
        },
      ],
      130000,
    );

    expect(allocation.totalCredit).toBe(130000);
    expect(allocation.breakdown).toHaveLength(2);
    expect(allocation.breakdown[1].appliedAmount).toBe(30000);
  });

  it("defers deposit when only some active order batches are selected", () => {
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

  it("applies deposit when the selected batches are the final active batches", () => {
    expect(
      selectionCoversAllActiveOrders(
        [
          "64b000000000000000000002",
          "64b000000000000000000003",
        ],
        [
          "64b000000000000000000002",
          "64b000000000000000000003",
        ],
      ),
    ).toBe(true);
  });
});
