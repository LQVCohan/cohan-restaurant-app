import { describe, expect, it } from "vitest";
import { isMeaningfulAuditPayload } from "../../models/audit-log.model.js";

describe("AuditLog meaningful MenuItem update filter", () => {
  it("rejects MenuItem updates whose before and after values are identical", () => {
    expect(
      isMeaningfulAuditPayload({
        entity: "MenuItem",
        action: "update",
        diff: {
          before: { name: "Trứng", status: "available", basePrice: 20000 },
          after: { name: "Trứng", status: "available", basePrice: 20000 },
        },
      }),
    ).toBe(false);
  });

  it("keeps real MenuItem changes and unrelated entity updates", () => {
    expect(
      isMeaningfulAuditPayload({
        entity: "MenuItem",
        action: "update",
        diff: { field: "status", before: "available", after: "unavailable" },
      }),
    ).toBe(true);

    expect(
      isMeaningfulAuditPayload({
        entity: "MenuItem",
        action: "update",
        diff: {
          type: "bulk_price_update",
          basePriceBefore: 20000,
          basePriceAfter: 21000,
        },
      }),
    ).toBe(true);

    expect(
      isMeaningfulAuditPayload({
        entity: "Staff",
        action: "update",
        diff: {},
      }),
    ).toBe(true);
  });
});
