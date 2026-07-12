import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANAGER_MENU_SELECTION_EVENT } from "@/utils/managerMenuSelection";
import ManagerMenuSelectionSync from "./ManagerMenuSelectionSync";

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

vi.mock("@apollo/client", () => ({
  useApolloClient: () => ({ refetchQueries }),
}));

describe("ManagerMenuSelectionSync", () => {
  beforeEach(() => {
    itemRefetch.mockClear();
    categoryRefetch.mockClear();
    otherRestaurantRefetch.mockClear();
    refetchQueries.mockClear();
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

    await waitFor(() => expect(itemRefetch).toHaveBeenCalledTimes(1));

    expect(refetchQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        include: [
          "MenuItemsConnection",
          "GetCategories",
          "TopCategoriesByRestaurant",
        ],
      }),
    );
    expect(itemRefetch).toHaveBeenCalledWith({
      limit: 20,
      cursor: null,
      filter: {
        restaurantId: "restaurant-1",
        timeSlot: "dinner",
        categoryId: null,
        menuId: "menu-casual",
      },
    });
    expect(categoryRefetch).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      timeSlot: "dinner",
      menuId: "menu-casual",
    });
    expect(otherRestaurantRefetch).not.toHaveBeenCalled();
  });
});
