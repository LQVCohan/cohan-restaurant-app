import { describe, expect, it, vi } from "vitest";

vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
    this.toString = () => this.value;
  }
  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
    },
  };
});

vi.mock("../../models/index.js", () => ({
  AuditLog: {},
  BrandMembership: {},
  CashierShiftReconciliation: {},
  Invoice: {},
  Order: {},
  PaymentRefund: {},
  PaymentTransaction: {},
  Shift: {},
  Staff: {},
  StaffPerformanceSnapshot: {},
  Timesheet: {},
}));

vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => ({
    resolveUserRoles: vi.fn(() => ["MANAGER"]),
    userCanAccessRestaurant: vi.fn(async () => true),
  }),
);

describe("cashier shift reconciliation calculations", () => {
  it("derives expected cash and variance from immutable source groups", async () => {
    const { calculateCashierReconciliationAmounts } = await import(
      "../../src/services/staffPerformance/cashierShiftReconciliation.service.js"
    );

    const result = calculateCashierReconciliationAmounts({
      openingCash: 1_000_000,
      cashSalesAmount: 3_000_000,
      cashRefundAmount: 200_000,
      movements: [
        { type: "CASH_IN", amount: 100_000 },
        { type: "CASH_OUT", amount: 300_000 },
      ],
      managerAdjustmentAmount: 50_000,
      actualCash: 3_600_000,
    });

    expect(result).toEqual({
      movementNetAmount: -200_000,
      expectedCash: 3_650_000,
      varianceAmount: -50_000,
      varianceRate: 50_000 / 3_650_000,
    });
  });

  it("does not create a variance before counted cash is submitted", async () => {
    const { calculateCashierReconciliationAmounts } = await import(
      "../../src/services/staffPerformance/cashierShiftReconciliation.service.js"
    );

    expect(
      calculateCashierReconciliationAmounts({
        openingCash: 500_000,
        cashSalesAmount: 1_000_000,
        actualCash: null,
      }),
    ).toMatchObject({
      expectedCash: 1_500_000,
      varianceAmount: 0,
      varianceRate: 0,
    });
  });

  it("keeps cashier operational penalties capped and reproducible", async () => {
    const { calculateCashierOperationalPenalty } = await import(
      "../../src/services/staffPerformance/cashierShiftReconciliation.service.js"
    );

    expect(
      calculateCashierOperationalPenalty({
        wrongBillRate: 0.1,
        paymentErrorRate: 0.05,
        cashierRefundRate: 0.02,
        cashVarianceRate: 0.01,
        latePaymentRequestRate: 0.1,
        unauthorizedDiscountRate: 0.02,
      }),
    ).toBe(2);

    expect(
      calculateCashierOperationalPenalty({
        wrongBillRate: 1,
        paymentErrorRate: 1,
        cashierRefundRate: 1,
        cashVarianceRate: 1,
        latePaymentRequestRate: 1,
        unauthorizedDiscountRate: 1,
      }),
    ).toBe(15);
  });

  it("treats only reviewed decisions as terminal", async () => {
    const { isTerminalCashierReconciliationStatus } = await import(
      "../../src/services/staffPerformance/cashierShiftReconciliation.service.js"
    );

    expect(isTerminalCashierReconciliationStatus("OPEN")).toBe(false);
    expect(isTerminalCashierReconciliationStatus("SUBMITTED")).toBe(false);
    expect(isTerminalCashierReconciliationStatus("APPROVED")).toBe(true);
    expect(isTerminalCashierReconciliationStatus("WAIVED")).toBe(true);
    expect(isTerminalCashierReconciliationStatus("REJECTED")).toBe(true);
  });
});
