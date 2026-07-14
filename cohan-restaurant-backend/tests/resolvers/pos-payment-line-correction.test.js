import { describe, expect, it } from "vitest";

import {
  buildAuthoritativeInvoiceSnapshot,
  hasRuntimePaymentDiscount,
  normalizeAuthoritativeInvoiceLine,
} from "../../src/services/payment/posPaymentLineCorrection.service.js";

describe("POS payment line correction", () => {
  it("does not count modifier price twice when unitPrice is already final", () => {
    const normalized = normalizeAuthoritativeInvoiceLine({
      dishId: "dish-1",
      menuId: "menu-1",
      categoryId: "category-1",
      name: "Cua Cà Mau sốt me",
      unit: "portion",
      servingKey: "default",
      quantity: 1,
      baseUnitPrice: 0,
      unitPrice: 430000,
      modifiersPricePerUnit: 430000,
      lineSubtotal: 430000,
      modifiers: [],
    });

    expect(normalized.subtotal).toBe(430000);
    expect(normalized.line.price + normalized.line.modifiersPrice).toBe(430000);
    expect(normalized.line.totals).toBe(430000);
  });

  it("builds the invoice total from stored order line subtotals", () => {
    const snapshot = buildAuthoritativeInvoiceSnapshot([
      {
        items: [
          {
            dishId: "dish-1",
            menuId: "menu-1",
            categoryId: "category-1",
            name: "Phở bò đặc biệt",
            quantity: 1,
            unitPrice: 97000,
            modifiersPricePerUnit: 0,
            lineSubtotal: 97000,
            status: "served",
          },
        ],
        totals: { subtotal: 97000, grandTotal: 97000 },
      },
      {
        items: [
          {
            dishId: "dish-2",
            menuId: "menu-2",
            categoryId: "category-2",
            name: "Cua Cà Mau sốt me",
            quantity: 1,
            baseUnitPrice: 0,
            unitPrice: 430000,
            modifiersPricePerUnit: 430000,
            lineSubtotal: 430000,
            status: "served",
          },
        ],
        totals: { subtotal: 430000, grandTotal: 430000 },
      },
    ]);

    expect(snapshot.totals.subtotal).toBe(527000);
    expect(snapshot.totals.grandTotal).toBe(527000);
    expect(snapshot.lines).toHaveLength(2);
    expect(snapshot.lines[1].totals).toBe(430000);
  });

  it("skips compatibility correction for runtime coupon/promotion totals", () => {
    expect(hasRuntimePaymentDiscount({})).toBe(false);
    expect(
      hasRuntimePaymentDiscount({ pricing: { voucherCode: "COHAN10" } }),
    ).toBe(true);
    expect(hasRuntimePaymentDiscount({ promotionIds: ["promotion-1"] })).toBe(
      true,
    );
  });
});
