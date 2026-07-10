import { describe, expect, it } from "vitest";
import { isMeaningfulAuditPayload } from "../../models/audit-log.model.js";

describe("AuditLog meaningful update filter", () => {
  it("rejects update records whose before and after values are identical", () => {
    expect(
      isMeaningfulAuditPayload({
        action: "update",
        diff: {
          before: { name: "Trứng", status: "available", basePrice: 20000 },
          after: { name: "Trứng", status: "available", basePrice: 20000 },
        },
      }),
    ).toBe(false);
  });

  it("keeps real field and bulk price changes", () => {
    expect(
      isMeaningfulAuditPayload({
        action: "update",
        diff: { field: "status", before: "available", after: "unavailable" },
      }),
    ).toBe(true);

    expect(
      isMeaningfulAuditPayload({
        action: "update",
        diff: {
          type: "bulk_price_update",
          basePriceBefore: 20000,
          basePriceAfter: 21000,
        },
      }),
    ).toBe(true);
  });
});
