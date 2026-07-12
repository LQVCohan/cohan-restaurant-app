import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANAGER_MENU_SELECTION_EVENT } from "@/utils/managerMenuSelection";
import ManagerMenuSelectionSync from "./ManagerMenuSelectionSync";

const mocks = vi.hoisted(() => {
  const itemRefetch = vi.fn().mockResolvedValue({});
  const categoryRefetch = vi.fn().mockResolvedValue({});
  const otherRestaurantRefetch = vi.fn().mockResolvedValue({});
  const refetchQueries = vi.fn(({ onQueryUpdated }) => {
    const results = [
      onQueryUpdated({
        variables: {
          limit: 20,
          cursor: "old-cursor",
          filter: {
            restaurantId: "restaurant-1",
            timeSlot: "dinner",
            categoryId: null,
          },
        },
        refetch: itemRefetch,
      }),
      onQueryUpdated({
        variables: {
          restaurantId: "restaurant-1",
          timeSlot: "dinner",
        },
        refetch: categoryRefetch,
      }),
      onQueryUpdated({
        variables: {
          restaurantId: "restaurant-2",
          timeSlot: "dinner",
        },
        refetch: otherRestaurantRefetch,
      }),
    ];

    return Promise.all(results.filter((result) => result && result !== false));
  });

  return {
    itemRefetch,
    categoryRefetch,
    otherRestaurantRefetch,
    refetchQueries,
  };
});

vi.mock("@apollo/client", () => ({
  useApolloClient: () => ({ refetchQueries: mocks.refetchQueries }),
}));

describe("ManagerMenuSelectionSync", () => {
  beforeEach(() => {
    mocks.itemRefetch.mockClear();
    mocks.categoryRefetch.mockClear();
    mocks.otherRestaurantRefetch.mockClear();
    mocks.refetchQueries.mockClear();
  });

  it("refetches active item and category queries with the exact selected menu", async () => {
    render(<ManagerMenuSelectionSync />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(MANAGER_MENU_SELECTION_EVENT, {
          detail: {
            restaurantId: "restaurant-1",
            menuId: "menu-casual",
            timeSlot: "dinner",
          },
        }),
      );
    });

    await waitFor(() => expect(mocks.itemRefetch).toHaveBeenCalledTimes(1));

    expect(mocks.refetchQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        include: [
          "MenuItemsConnection",
          "GetCategories",
          "TopCategoriesByRestaurant",
        ],
      }),
    );
    expect(mocks.itemRefetch).toHaveBeenCalledWith({
      limit: 20,
      cursor: null,
      filter: {
        restaurantId: "restaurant-1",
        timeSlot: "dinner",
        categoryId: null,
        menuId: "menu-casual",
      },
    });
    expect(mocks.categoryRefetch).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      timeSlot: "dinner",
      menuId: "menu-casual",
    });
    expect(mocks.otherRestaurantRefetch).not.toHaveBeenCalled();
  });
});
