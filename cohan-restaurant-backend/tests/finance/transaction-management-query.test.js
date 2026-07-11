import { describe, expect, it } from "vitest";
import {
  buildCashflowFilter,
  resolveBoundary,
} from "../../graphql/resolvers/payment/transactionManagementQuery.js";

const restaurantId = "64b000000000000000000001";

describe("transaction management date boundaries", () => {
  it("preserves explicit ISO timestamps instead of normalizing them again", () => {
    const dateFrom = "2026-05-30T17:00:00.000Z";
    const dateTo = "2026-06-29T16:59:59.999Z";

    expect(resolveBoundary(dateFrom).toISOString()).toBe(dateFrom);
    expect(resolveBoundary(dateTo, { endOfDay: true }).toISOString()).toBe(
      dateTo,
    );

    const { filter } = buildCashflowFilter({
      restaurantId,
      dateFrom,
      dateTo,
    });
    expect(filter.occurredAt.$gte.toISOString()).toBe(dateFrom);
    expect(filter.occurredAt.$lte.toISOString()).toBe(dateTo);
  });

  it("still supports legacy date-only callers with local day boundaries", () => {
    expect(resolveBoundary("2026-06-01").toISOString()).toBe(
      new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
    );
    expect(
      resolveBoundary("2026-06-01", { endOfDay: true }).toISOString(),
    ).toBe(new Date(2026, 5, 1, 23, 59, 59, 999).toISOString());
  });

  it("rejects malformed date boundaries", () => {
    expect(() => resolveBoundary("not-a-date")).toThrow(
      /Invalid transaction date boundary/,
    );
  });
});
