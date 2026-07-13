import { describe, expect, it } from "vitest";
import { reservationDepositPaymentInternals } from "../../graphql/resolvers/payment/reservationDepositPaymentMutation.js";

const {
  allocateDepositCredit,
  availableDeposit,
  selectionCoversAllActiveOrders,
} = reservationDepositPaymentInternals;

describe("reservation deposit POS allocation", () => {
  it("subtracts both table and menu deposits from the gross order total", () => {
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
        },
      ],
      500000,
    );

    expect(allocation.totalCredit).toBe(150000);
    expect(allocation.breakdown[0]).toMatchObject({
      tableDepositApplied: 100000,
      menuDepositApplied: 50000,
      appliedAmount: 150000,
    });
  });

  it("caps the deposit credit at the invoice gross total", () => {
    const allocation = allocateDepositCredit(
      [
        {
          _id: "64b000000000000000000001",
          depositAmount: 150000,
          tableDepositAmount: 100000,
          menuDepositAmount: 50000,
          depositAppliedAmount: 0,
        },
      ],
      120000,
    );

    expect(allocation.totalCredit).toBe(120000);
    expect(allocation.breakdown[0]).toMatchObject({
      tableDepositApplied: 100000,
      menuDepositApplied: 20000,
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
