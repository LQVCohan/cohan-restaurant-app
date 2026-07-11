import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRequestedTransactionRestaurantId,
  selectAccessibleTransactionRestaurant,
  toGraphqlDateTime,
  toLocalDateInputValue,
} from "./useTransactions";

const source = readFileSync(
  join(process.cwd(), "src/hooks/useTransactions.js"),
  "utf8",
);

describe("useTransactions safety contracts", () => {
  it("queries only masked/last4 bank account fields and not raw bankAccountNumber", () => {
    const bankFields = source.match(/const BANK_FIELDS = `([\s\S]*?)`;/)?.[1] || "";

    expect(bankFields).toContain("bankAccountNumberMasked");
    expect(bankFields).toContain("bankAccountNumberLast4");
    expect(bankFields).not.toMatch(/^\s*bankAccountNumber\s*$/m);
  });

  it("keeps input dates local before converting them to GraphQL DateTime", () => {
    expect(toLocalDateInputValue(new Date(2026, 5, 1))).toBe("2026-06-01");
    expect(toGraphqlDateTime("2026-05-31")).toBe(
      new Date(2026, 4, 31, 0, 0, 0, 0).toISOString(),
    );
    expect(toGraphqlDateTime("2026-06-29", { endOfDay: true })).toBe(
      new Date(2026, 5, 29, 23, 59, 59, 999).toISOString(),
    );
  });

  it("loads receivables from the finance invoice debt contract", () => {
    expect(source).toContain("financeDashboard(input: $dashboardInput)");
    expect(source).toContain("debts { id supplier amount dueDate status }");
    expect(source).toContain("receivables: query.data?.financeDashboard?.debts || []");
  });

  it("never sends direct paidAmount edits for supplier payables", () => {
    expect(source).toContain("paidAmount: 0");
    expect(source).toContain("const { paidAmount: _ignoredPaidAmount, ...safeInput }");
  });

  it("reads the finance drill-down restaurant and rejects out-of-scope ids", () => {
    const restaurants = [
      { id: "restaurant-a", name: "A" },
      { id: "restaurant-b", name: "B" },
    ];
    const requested = getRequestedTransactionRestaurantId(
      "?tab=journal&restaurantId=restaurant-b",
    );

    expect(requested).toBe("restaurant-b");
    expect(selectAccessibleTransactionRestaurant(restaurants, requested)).toBe(
      "restaurant-b",
    );
    expect(
      selectAccessibleTransactionRestaurant(restaurants, "restaurant-foreign"),
    ).toBe("restaurant-a");
  });
});
