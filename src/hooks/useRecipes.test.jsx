import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecipes } from "./useRecipes";

const apolloMocks = vi.hoisted(() => {
  const listData = {
    menuItemsWithRecipes: {
      items: [
        {
          menuItem: {
            id: "menu-1",
            restaurantId: "res-1",
            name: "Phở bò",
            description: "",
            categoryId: null,
            basePrice: 50000,
            thumbImage: null,
            status: "available",
          },
          recipe: {
            id: "recipe-1",
            restaurantId: "res-1",
            menuItemId: "menu-1",
            notes: "",
            isActive: true,
            servingVariants: [],
          },
        },
      ],
      total: 1,
      pageInfo: { endCursor: "menu-1", hasNextPage: false },
    },
  };

  return {
    listData,
    fetchList: vi.fn(async () => ({ data: listData })),
    fetchRecipeDetail: vi.fn(async () => ({ data: { recipe: null } })),
    listState: {
      data: listData,
      loading: false,
      error: null,
      fetchMore: vi.fn(),
    },
  };
});

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  const operationName = (document) =>
    document?.definitions?.find(
      (definition) => definition.kind === "OperationDefinition",
    )?.name?.value;

  return {
    ...actual,
    useLazyQuery: vi.fn((document) => {
      if (operationName(document) === "MenuItemsWithRecipes") {
        return [apolloMocks.fetchList, apolloMocks.listState];
      }
      return [apolloMocks.fetchRecipeDetail, { loading: false, error: null }];
    }),
    useMutation: vi.fn(() => [vi.fn(async () => ({ data: {} })), { loading: false }]),
  };
});

describe("useRecipes list synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apolloMocks.fetchList.mockImplementation(async () => ({ data: apolloMocks.listData }));
  });

  it("restores rows when the same Apollo data object is reused after returning to the tab", async () => {
    const { result, rerender } = renderHook(
      ({ restaurantId }) => useRecipes(restaurantId),
      { initialProps: { restaurantId: "res-1" } },
    );

    await waitFor(() => expect(result.current.recipes).toHaveLength(1));

    rerender({ restaurantId: null });
    await waitFor(() => expect(result.current.recipes).toHaveLength(0));

    rerender({ restaurantId: "res-1" });

    await waitFor(() => expect(apolloMocks.fetchList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.recipes).toHaveLength(1));
    expect(result.current.recipes[0]).toMatchObject({
      id: "menu-1",
      name: "Phở bò",
    });
  });
});
