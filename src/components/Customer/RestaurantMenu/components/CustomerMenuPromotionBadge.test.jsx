import fs from "node:fs";
import path from "node:path";
import React from "react";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveMenuPromotions } from "../../../../hooks/useActiveMenuPromotions";
import MenuDetailView, {
  GET_CATEGORIES,
  GET_MENU_ITEMS_FOR_CUSTOMER_MENU,
} from "./MenuDetailView";
import MenuItemCard from "./MenuItemCard";

vi.mock("../../../../hooks/useActiveMenuPromotions", () => ({
  useActiveMenuPromotions: vi.fn(),
}));

const readRepoFile = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Customer menu promotion badge wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps MenuDetailView wired to useActiveMenuPromotions and renders promotion badge content", async () => {
    const menuDetailViewSource = readRepoFile(
      "src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx",
    );

    expect(menuDetailViewSource).toContain("useActiveMenuPromotions");
    expect(menuDetailViewSource).toContain("promotionLabel");

    useActiveMenuPromotions.mockReturnValue({
      promotions: [],
      promotionByItemId: {},
      promotionByCategoryId: {},
      getPromotionForMenuItem: (item) =>
        item?.id === "lunch_02" ? { name: "Ưu đãi mùa hè" } : null,
      getPromotionLabel: (promotion) => (promotion ? "-5%" : ""),
      loading: false,
      error: null,
    });

    const apolloMocks = [
      {
        request: {
          query: GET_CATEGORIES,
          variables: {
            restaurantId: "res_01",
            timeSlot: "lunch",
          },
        },
        result: {
          data: {
            categories: [
              {
                id: "cat_01",
                name: "Món chính",
                order: 1,
                isActive: true,
                __typename: "Category",
              },
            ],
          },
        },
      },
      {
        request: {
          query: GET_MENU_ITEMS_FOR_CUSTOMER_MENU,
          variables: {
            filter: {
              restaurantId: "res_01",
              timeSlot: "lunch",
            },
            limit: 100,
            cursor: null,
          },
        },
        result: {
          data: {
            menuItemsConnection: {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                __typename: "PageInfo",
              },
              edges: [
                {
                  node: {
                    id: "lunch_02",
                    restaurantId: "res_01",
                    menuId: "menu_lunch_01",
                    categoryId: "cat_01",
                    name: "Cơm gà",
                    description: "Cơm gà test",
                    basePrice: 55000,
                    byWeight: false,
                    thumbImage: "https://example.com/com-ga.jpg",
                    status: "available",
                    avgPrepTimeMin: 15,
                    inventoryStatus: "IN_STOCK",
                    stockWarnings: [],
                    servingVariants: [],
                    __typename: "MenuItem",
                  },
                  __typename: "MenuItemEdge",
                },
              ],
              __typename: "MenuItemConnection",
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={apolloMocks}>
        <MenuDetailView
          restaurant={{ id: "res_01", name: "Cơm Niêu Sài Gòn" }}
          onBack={vi.fn()}
          onOpenFoodDetail={vi.fn()}
        />
      </MockedProvider>,
    );

    expect(useActiveMenuPromotions).toHaveBeenCalledWith("res_01");
    expect(await screen.findByText("-5%")).toBeInTheDocument();
    expect(await screen.findByText("Ưu đãi mùa hè")).toBeInTheDocument();
  });

  it("renders promotion label and promotion name in MenuItemCard", () => {
    render(
      <MenuItemCard
        item={{
          id: "item-1",
          name: "Kem dừa",
          description: "Kem dừa mát lạnh",
          basePrice: 45000,
          thumbImage: "https://example.com/kem-dua.jpg",
          status: "active",
          servingVariants: [],
          promotionLabel: "-5%",
          promotion: { name: "Ưu đãi mùa hè" },
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("-5%")).toBeInTheDocument();
    expect(screen.getByText("Ưu đãi mùa hè")).toBeInTheDocument();
  });

  it("keeps promo badge and promo name selectors in SCSS", () => {
    const scssSource = readRepoFile(
      "src/components/Customer/RestaurantMenu/styles/MenuItemCard.scss",
    );

    expect(scssSource).toContain(".menu-item-card__promo-badge");
    expect(scssSource).toContain(".menu-item-card__promo-name");
  });
});
