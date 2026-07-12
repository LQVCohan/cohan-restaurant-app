import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import { AuthContext } from "../../../../context/AuthContext";
import MenuDetailView from "./MenuDetailView";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("../../../../hooks/useFoodPreferences", () => ({
  default: () => ({ preferences: null }),
}));

vi.mock("../../../../hooks/useActiveMenuPromotions", async () => {
  const actual = await vi.importActual(
    "../../../../hooks/useActiveMenuPromotions",
  );
  return {
    ...actual,
    useActiveMenuPromotions: () => ({
      getPromotionForMenuItem: () => null,
      getPromotionLabel: () => "",
    }),
  };
});

const menus = [
  {
    id: "menu-breakfast",
    restaurantId: "restaurant-1",
    timeSlot: "breakfast",
    name: "Menu sáng",
    description: "Món nhẹ đầu ngày",
    isActive: true,
  },
  {
    id: "menu-lunch",
    restaurantId: "restaurant-1",
    timeSlot: "lunch",
    name: "Menu trưa",
    description: "Cơm trưa",
    isActive: true,
  },
  {
    id: "menu-vip",
    restaurantId: "restaurant-1",
    timeSlot: "dinner",
    name: "Menu VIP",
    description: "Món cao cấp",
    isActive: true,
  },
  {
    id: "menu-casual",
    restaurantId: "restaurant-1",
    timeSlot: "dinner",
    name: "Menu ăn chơi",
    description: "Món chia sẻ",
    isActive: true,
  },
];

const dishesByMenu = {
  "menu-breakfast": [],
  "menu-lunch": [],
  "menu-vip": [
    {
      id: "dish-vip",
      restaurantId: "restaurant-1",
      menuId: "menu-vip",
      categoryId: "category-vip",
      name: "Bò sốt vang VIP",
      description: "Món của menu VIP",
      basePrice: 320000,
      status: "available",
      inventoryStatus: "IN_STOCK",
      maxAvailable: 10,
      servingVariants: [],
    },
  ],
  "menu-casual": [
    {
      id: "dish-casual",
      restaurantId: "restaurant-1",
      menuId: "menu-casual",
      categoryId: "category-casual",
      name: "Khoai tây ăn chơi",
      description: "Món chia sẻ",
      basePrice: 65000,
      status: "available",
      inventoryStatus: "IN_STOCK",
      maxAvailable: 10,
      servingVariants: [],
    },
  ],
};

const operationName = (query) =>
  query?.definitions?.find((definition) => definition?.name?.value)?.name?.value;

const renderMenu = (props = {}) =>
  render(
    <MemoryRouter initialEntries={["/cus-menu?restaurantId=restaurant-1"]}>
      <AuthContext.Provider value={{ isAuthenticated: false }}>
        <MenuDetailView
          restaurant={{
            id: "restaurant-1",
            name: "Cohan Test",
            canOrder: true,
            openingStatus: "open",
          }}
          canOrder
          initialTimeSlot="breakfast"
          onBack={vi.fn()}
          onOpenFoodDetail={vi.fn()}
          {...props}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("customer MenuDetailView menu boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockImplementation((query, options = {}) => {
      const name = operationName(query);
      if (name === "GetCustomerMenusForMenuDetail") {
        return {
          data: { customerMenus: menus },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }

      if (name === "GetCategoriesForCustomerMenu") {
        const menuId = options.variables?.menuId;
        return {
          data: {
            customerMenuCategories: menuId
              ? [
                  {
                    id: `category-${menuId}`,
                    name: `Danh mục ${menuId}`,
                    order: 1,
                    isActive: true,
                  },
                ]
              : [],
          },
          loading: false,
          error: null,
        };
      }

      const menuId = options.variables?.filter?.menuId;
      const items = dishesByMenu[menuId] || [];
      return {
        data: {
          menuItemsConnection: {
            edges: items.map((node) => ({ cursor: node.id, node })),
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
        loading: false,
        error: null,
        fetchMore: vi.fn(),
        refetch: vi.fn(),
      };
    });
  });

  it("allows normal remote ordering to switch meal periods with active menus", async () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /Bữa trưa/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Bữa trưa/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      screen.queryByText("Món không thuộc khung giờ đặt bàn."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Menu trưa/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a booking add-on locked to the reservation meal period", async () => {
    renderMenu({ lockedTimeSlot: "breakfast" });

    fireEvent.click(screen.getByRole("button", { name: /Bữa tối/ }));

    expect(
      await screen.findByText("Món không thuộc khung giờ đặt bàn."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lịch của bạn dùng thực đơn Bữa sáng",
    );
  });

  it("switches dishes and categories between sibling menus in one time slot", async () => {
    renderMenu({ initialTimeSlot: "dinner", initialMenuId: "menu-vip" });

    expect(await screen.findByText("Bò sốt vang VIP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Menu VIP/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /Menu ăn chơi/ }));

    expect(await screen.findByText("Khoai tây ăn chơi")).toBeInTheDocument();
    expect(screen.queryByText("Bò sốt vang VIP")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Menu ăn chơi/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const itemQueryCalls = useQuery.mock.calls.filter(
      ([, options]) => options?.variables?.filter,
    );
    expect(itemQueryCalls.at(-1)[1].variables.filter).toMatchObject({
      restaurantId: "restaurant-1",
      timeSlot: "dinner",
      menuId: "menu-casual",
    });

    const categoryQueryCalls = useQuery.mock.calls.filter(
      ([query]) => operationName(query) === "GetCategoriesForCustomerMenu",
    );
    expect(categoryQueryCalls.at(-1)[1].variables.menuId).toBe("menu-casual");
  });

  it("disables service slots that have no active menu", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: /Ăn đêm/ })).toBeDisabled();
  });
});
