import { describe, expect, it } from "vitest";
import {
  buildCustomerCartPayload,
  buildMenuItemServingOptions,
  normalizeCartNote,
} from "./customerCartPayload";

describe("customerCartPayload", () => {
  it("normalizes notes and serving variants with sellQty/sellUnit metadata", () => {
    expect(normalizeCartNote("  ít cay  ")).toBe("ít cay");

    const options = buildMenuItemServingOptions({
      basePrice: 50000,
      servingVariants: [
        { key: "large", mode: "PORTION", sellQty: 1, sellUnit: "portion", name: "Phần lớn", price: 65000 },
      ],
    });

    expect(options).toEqual([
      expect.objectContaining({
        key: "large",
        mode: "PORTION",
        sellQty: 1,
        sellUnit: "portion",
        name: "Phần lớn",
        price: 65000,
      }),
    ]);
  });

  it("builds a local cart line without leaking FOR YOU analytics fields", () => {
    const payload = buildCustomerCartPayload({
      item: {
        id: "dish-1",
        restaurantId: "restaurant-1",
        menuId: "menu-1",
        categoryId: "category-1",
        name: "Phở bò",
        basePrice: 70000,
        thumbImage: "/pho.jpg",
        forYouScore: 99,
        analytics: { source: "for_you" },
      },
      restaurant: { id: "restaurant-1", name: "Cohan Smoke Bistro" },
      selectedVariant: { key: "large", name: "Tô lớn", price: 90000 },
      quantity: 2,
      note: "  không hành  ",
      backendCartId: "cart-1",
      backendCartItemId: "cart-item-1",
      holdExpiresAt: "2026-06-03T12:10:00.000Z",
      holdStatus: "active",
    });

    expect(payload).toEqual(
      expect.objectContaining({
        id: "dish-1_large",
        dishId: "dish-1",
        restaurantId: "restaurant-1",
        menuId: "menu-1",
        categoryId: "category-1",
        servingVariantKey: "large",
        price: 90000,
        quantity: 2,
        restaurantName: "Cohan Smoke Bistro",
        backendCartId: "cart-1",
        backendCartItemId: "cart-item-1",
        note: "không hành",
      }),
    );
    expect(payload).not.toHaveProperty("analytics");
    expect(payload).not.toHaveProperty("forYouScore");
  });
});
