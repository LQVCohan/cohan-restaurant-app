import { describe, expect, it, vi } from "vitest";
import {
  buildModifierSelectionKey,
  calculateModifierPricing,
  getModifierSelectionError,
  findAddedCartLine,
  isBookingAddonFoodDetail,
  shareFoodDetail,
} from "./FoodDetailV2";

const groups = [
  {
    id: "size",
    name: "Kích cỡ",
    selectionType: "single",
    required: true,
    options: [
      {
        id: "large",
        name: "Lớn",
        priceRule: { rule: "DELTA", amount: 20000 },
      },
    ],
  },
  {
    id: "sauce",
    name: "Nước sốt",
    selectionType: "multiple",
    required: false,
    maxSelected: 2,
    options: [
      {
        id: "premium",
        name: "Sốt đặc biệt",
        priceRule: { rule: "SET", amount: 120000 },
      },
      {
        id: "cheese",
        name: "Phô mai",
        priceRule: { rule: "DELTA", amount: 10000 },
      },
    ],
  },
];

describe("FoodDetailV2 helpers", () => {
  it("requires mandatory modifier groups before ordering", () => {
    expect(getModifierSelectionError(groups, {})).toContain("Kích cỡ");
    expect(
      getModifierSelectionError(groups, { size: ["large"], sauce: [] }),
    ).toBe("");
  });

  it("calculates the displayed unit price from SET and DELTA rules", () => {
    const pricing = calculateModifierPricing(90000, groups, {
      size: ["large"],
      sauce: ["premium", "cheese"],
    });

    expect(pricing).toEqual({
      unitPrice: 150000,
      modifiersPrice: 60000,
      setCount: 1,
    });
  });

  it("builds stable cart identity regardless of selection order", () => {
    expect(
      buildModifierSelectionKey([
        { groupId: "b", optionId: "2" },
        { groupId: "a", optionId: "1" },
      ]),
    ).toBe("a:1|b:2");
  });

  it("matches the server line by its resolved serving key", () => {
    const items = [
      {
        id: "cart-item-1",
        menuItemId: "dish-1",
        servingVariantKey: "default",
        note: "",
        modifiers: [],
      },
    ];

    expect(
      findAddedCartLine({
        items,
        menuItemId: "dish-1",
        servingVariantKey: "default",
        note: "",
        modifiers: [],
      })?.id,
    ).toBe("cart-item-1");
    expect(
      findAddedCartLine({
        items,
        menuItemId: "dish-1",
        servingVariantKey: "portion",
        note: "",
        modifiers: [],
      }),
    ).toBeUndefined();
  });

  it("recognizes booking addon context from URL or restored draft", () => {
    expect(
      isBookingAddonFoodDetail({
        search: "?restaurantId=restaurant-1&returnTo=booking",
      }),
    ).toBe(true);
    expect(
      isBookingAddonFoodDetail({
        search: "?restaurantId=restaurant-1&serviceAt=2026-07-11T01%3A00%3A00.000Z",
        state: { bookingDraft: { tableId: "table-1" } },
      }),
    ).toBe(true);
    expect(isBookingAddonFoodDetail({ search: "?restaurantId=restaurant-1" })).toBe(
      false,
    );
  });

  it("uses clipboard when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareFoodDetail({
      title: "Món ăn",
      text: "Xem món ăn",
      url: "https://example.test/food/1",
      navigatorRef: { clipboard: { writeText } },
    });

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.test/food/1");
  });
});
