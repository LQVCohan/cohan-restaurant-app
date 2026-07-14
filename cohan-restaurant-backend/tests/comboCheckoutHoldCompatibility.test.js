import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getSyntheticComboHoldExpiry,
  isComboCheckoutItem,
  normalizeComboCheckoutItem,
  withComboCheckoutHoldCompatibility,
} from "../graphql/resolvers/order/comboCheckoutHoldCompatibility.js";

describe("combo checkout cart-hold compatibility", () => {
  it("recognizes combo checkout lines", () => {
    expect(isComboCheckoutItem({ itemType: "COMBO" })).toBe(true);
    expect(isComboCheckoutItem({ comboId: "combo-1" })).toBe(true);
    expect(isComboCheckoutItem({ itemType: "MENU_ITEM" })).toBe(false);
  });

  it("creates a short compatibility expiry for combo lines without inventory holds", () => {
    const now = new Date("2026-07-14T00:00:00.000Z");
    expect(getSyntheticComboHoldExpiry(now).toISOString()).toBe(
      "2026-07-14T00:05:00.000Z",
    );
  });

  it("builds a schema-valid order snapshot for a combo cart item", () => {
    const normalized = normalizeComboCheckoutItem(
      {
        itemType: "COMBO",
        comboId: "507f1f77bcf86cd799439011",
        restaurantId: "507f1f77bcf86cd799439012",
        quantity: 1,
      },
      {
        itemType: "COMBO",
        comboId: "507f1f77bcf86cd799439011",
        restaurantId: "507f1f77bcf86cd799439012",
        menuItemId: "507f191e810c19729de860ea",
        name: "Combo sáng",
        price: 89000,
        quantity: 1,
        comboSnapshot: {
          comboPrice: 89000,
          items: [{ menuItemId: "507f191e810c19729de860ea" }],
        },
      },
      {
        cartId: "507f1f77bcf86cd799439013",
        cartItemId: "507f1f77bcf86cd799439014",
      },
      {
        _id: "507f191e810c19729de860ea",
        categoryId: "507f1f77bcf86cd799439015",
      },
    );

    expect(normalized.categoryId).toBe("507f1f77bcf86cd799439015");
    expect(normalized.basePrice).toBe(89000);
    expect(normalized.servingVariant).toEqual({
      key: "portion",
      name: "Combo",
      mode: "PORTION",
      price: 89000,
      sellQty: 1,
      sellUnit: "portion",
    });
  });

  it("does not touch the database for a checkout containing only regular menu items", async () => {
    const createCheckoutOrders = vi.fn(async (_parent, args) => args.input);
    const wrapped = withComboCheckoutHoldCompatibility({ createCheckoutOrders });
    const input = {
      orderType: "delivery",
      items: [
        {
          itemType: "MENU_ITEM",
          restaurantId: "507f1f77bcf86cd799439011",
          dishId: "507f191e810c19729de860ea",
          cartId: "507f1f77bcf86cd799439012",
          cartItemId: "507f1f77bcf86cd799439013",
          name: "Bún bò",
          servingKey: "portion",
          quantity: 1,
        },
      ],
    };

    const result = await wrapped.createCheckoutOrders(
      null,
      { input },
      { user: { id: "507f1f77bcf86cd799439014" } },
      null,
    );

    expect(result).toEqual(input);
    expect(createCheckoutOrders).toHaveBeenCalledTimes(1);
  });

  it("is wired before the canonical checkout resolver and restores compatibility state on failure", () => {
    const source = readFileSync(
      "graphql/resolvers/order/comboCheckoutHoldCompatibility.js",
      "utf8",
    );
    const resolverIndex = readFileSync(
      "graphql/resolvers/order/index.js",
      "utf8",
    );

    expect(source).toContain(
      "cartItem.holdExpiresAt = getSyntheticComboHoldExpiry(now)",
    );
    expect(source).toContain(
      "comboSnapshot: cloneSnapshot(cartItem.comboSnapshot)",
    );
    expect(source).toContain("categoryId: String(categoryId)");
    expect(source).toContain("servingVariant: {");
    expect(source).toContain("await restoreComboHoldExpiries(prepared)");
    expect(resolverIndex).toContain(
      "withComboCheckoutHoldCompatibility(CanonicalCheckoutOrderMutation)",
    );
  });
});
