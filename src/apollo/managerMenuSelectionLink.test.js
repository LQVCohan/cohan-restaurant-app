import { describe, expect, it } from "vitest";
import { applyManagerMenuSelection } from "./managerMenuSelectionLink";

const selection = {
  restaurantId: "restaurant-1",
  menuId: "menu-vip",
  timeSlot: "dinner",
};

describe("applyManagerMenuSelection", () => {
  it("adds the selected menu to item queries and mutations", () => {
    expect(
      applyManagerMenuSelection(
        "MenuItemsConnection",
        {
          filter: {
            restaurantId: "restaurant-1",
            timeSlot: "dinner",
          },
        },
        selection,
      ),
    ).toEqual({
      filter: {
        restaurantId: "restaurant-1",
        timeSlot: "dinner",
        menuId: "menu-vip",
      },
    });

    expect(
      applyManagerMenuSelection(
        "CreateMenuItem",
        {
          input: {
            restaurantId: "restaurant-1",
            timeSlot: "dinner",
            name: "Bò sốt vang",
          },
        },
        selection,
      ).input.menuId,
    ).toBe("menu-vip");
  });

  it("does not route another restaurant or time slot into the selected menu", () => {
    const variables = {
      input: {
        restaurantId: "restaurant-2",
        timeSlot: "dinner",
      },
    };

    expect(
      applyManagerMenuSelection(
        "SyncMenuItemInventoryStatuses",
        variables,
        selection,
      ),
    ).toBe(variables);
  });

  it("keeps create and copy operations on the manager-selected restaurant", () => {
    expect(
      applyManagerMenuSelection(
        "EnsureMenu",
        {
          input: {
            restaurantId: "stale-restaurant",
            timeSlot: "lunch",
            name: "Menu ăn chơi",
          },
        },
        null,
        "restaurant-2",
      ).input.restaurantId,
    ).toBe("restaurant-2");
  });
});
