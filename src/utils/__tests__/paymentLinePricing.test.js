import { describe, expect, it } from "vitest";

import {
  getAuthoritativeLineTotal,
  getAuthoritativeUnitPrice,
  normalizeLegacyPaymentDisplayItem,
} from "../paymentLinePricing";

describe("paymentLinePricing", () => {
  it("uses stored lineSubtotal as the authoritative amount", () => {
    const item = {
      quantity: 1,
      unitPrice: 430000,
      modifiersPrice: 430000,
      lineSubtotal: 430000,
    };

    expect(getAuthoritativeLineTotal(item)).toBe(430000);
    expect(getAuthoritativeUnitPrice(item)).toBe(430000);
  });

  it("does not add modifiers twice when unitPrice is already final", () => {
    const normalized = normalizeLegacyPaymentDisplayItem({
      quantity: 1,
      baseUnitPrice: 0,
      unitPrice: 430000,
      modifiersPricePerUnit: 430000,
      modifiersPrice: 430000,
      lineSubtotal: 430000,
    });

    expect(normalized.price + normalized.modifiersPrice).toBe(430000);
    expect(normalized.lineSubtotal).toBe(430000);
  });

  it("falls back to base plus modifier pricing for legacy records", () => {
    const item = {
      quantity: 2,
      basePrice: 100000,
      modifiersPrice: 25000,
    };

    expect(getAuthoritativeUnitPrice(item)).toBe(125000);
    expect(getAuthoritativeLineTotal(item)).toBe(250000);
  });
});
