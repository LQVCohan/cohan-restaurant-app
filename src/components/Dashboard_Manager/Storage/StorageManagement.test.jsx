import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StorageManagement from "./StorageManagement";
import { AuthContext } from "../../../context/AuthContext";

const apolloMocks = vi.hoisted(() => ({
  warehouses: [{ id: "wh-1", name: "Kho chính", code: "MAIN", isActive: true }],
  createWarehouse: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  const operationName = (document) => document?.definitions?.find(
    (definition) => definition.kind === "OperationDefinition",
  )?.name?.value;

  return {
    ...actual,
    useMutation: vi.fn((mutation) => {
      if (operationName(mutation) === "CreateWarehouse") {
        return [apolloMocks.createWarehouse, { loading: false }];
      }
      return [vi.fn(async () => ({ data: {} })), {}];
    }),
    useQuery: vi.fn((query) => {
      const opName = operationName(query);
      const refetch = vi.fn(async () => ({
        data: opName === "Warehouses"
          ? { warehouses: apolloMocks.warehouses }
          : {},
      }));
      if (opName === "ScopedRestaurants") {
        return {
          data: {
            scopedRestaurants: {
              edges: [{ node: { id: "res-1", name: "Cơm nhà Cohan" } }],
            },
          },
          loading: false,
          error: null,
          refetch,
        };
      }
      if (opName === "Ingredients") {
        return {
          data: {
            ingredients: [
              { id: "ing-1", name: "Gạo ST25", baseUnit: "kg", minStock: 5 },
            ],
          },
          loading: false,
          error: null,
          refetch,
        };
      }
      if (opName === "Warehouses") {
        return {
          data: { warehouses: apolloMocks.warehouses },
          loading: false,
          error: null,
          refetch,
        };
      }
      if (opName === "StockItems") {
        return {
          data: { stockItems: [{ id: "stock-1", ingredientId: "ing-1", onHand: 2, reserved: 0 }] },
          loading: false,
          error: null,
          refetch,
        };
      }
      if (opName === "StockMovements") {
        return { data: { stockMovements: [] }, loading: false, error: null, refetch };
      }
      return { data: {}, loading: false, error: null, refetch };
    }),
  };
});

vi.mock("@/hooks/useRestaurantCurrency", () => ({
  useRestaurantCurrency: () => ({
    loading: false,
    activeCurrency: "VND",
    setActiveCurrency: vi.fn(),
    usdToVndRate: 26000,
    manualUsdToVndRate: 26000,
    persistSettings: vi.fn(async () => ({})),
  }),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("@/hooks/useRecipes", () => ({
  useRecipes: () => ({
    recipes: [],
    loading: false,
    error: null,
    pageInfo: { hasNextPage: false },
    total: 0,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    addRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  }),
}));

vi.mock("./components/ingredients/IngredientList", () => ({
  default: () => (
    <section aria-label="Danh sách nguyên liệu mock">
      <h2>Danh sách nguyên liệu</h2>
      <p>Không có nguyên liệu phù hợp với bộ lọc hiện tại.</p>
    </section>
  ),
}));

vi.mock("./components/supplies/SupplyList", () => ({
  default: () => <section>Vật tư đang hiển thị</section>,
}));

vi.mock("./components/recipes/RecipeList", () => ({
  default: () => <section>Công thức đang hiển thị</section>,
}));

vi.mock("./components/inventory/InventoryAuditTab", () => ({
  default: () => <section>Kiểm kê đang hiển thị</section>,
}));

vi.mock("./components/ingredients/QuickStockModal", () => ({
  default: () => null,
}));

const writableUser = {
  id: "manager-1",
  permissions: ["inventory.write", "stock.write"],
};

const renderPage = (user = writableUser) =>
  render(
    <AuthContext.Provider
      value={{
        user,
        restaurants: [{ id: "res-1", name: "Cơm nhà Cohan" }],
        restaurantsLoading: false,
      }}
    >
      <StorageManagement />
    </AuthContext.Provider>,
  );

const lowStockKpi = () => screen.getByText("Sắp hết").closest(".sm-kpi-card");

beforeEach(() => {
  apolloMocks.warehouses = [
    { id: "wh-1", name: "Kho chính", code: "MAIN", isActive: true },
  ];
  apolloMocks.createWarehouse.mockReset();
  apolloMocks.createWarehouse.mockImplementation(async ({ variables }) => {
    const createdWarehouse = {
      id: "wh-created",
      ...variables.input,
    };
    apolloMocks.warehouses = [createdWarehouse];
    return { data: { createWarehouse: createdWarehouse } };
  });
});

describe("StorageManagement operations UI", () => {
  it("renders storage title, tabs, KPI cards, and empty ingredient state", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Quản lý kho" })).toBeInTheDocument();
    expect(
      screen.getByText("Theo dõi nguyên liệu, nhập xuất và kiểm kê trong kho mặc định của nhà hàng."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nhà hàng")).toBeInTheDocument();
    expect(screen.queryByLabelText("Kho hàng")).not.toBeInTheDocument();
    expect(screen.getByText("Tổng nguyên liệu")).toBeInTheDocument();
    expect(screen.getByText("Sắp hết")).toBeInTheDocument();
    expect(within(lowStockKpi()).getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Vật tư & Khác/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Công thức/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Kiểm kê/i })).toBeInTheDocument();
    expect(screen.getByText("Không có nguyên liệu phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
  });

  it("keeps stock KPI values when switching to the recipes tab", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: /Công thức/i }));

    expect(screen.getByText("Công thức đang hiển thị")).toBeInTheDocument();
    expect(within(lowStockKpi()).getByText("1")).toBeInTheDocument();
  });

  it("switches tab content when the inventory tab is clicked", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: /Kiểm kê/i }));

    expect(screen.getByText("Kiểm kê đang hiển thị")).toBeInTheDocument();
  });

  it("offers Kho chính setup when a legacy restaurant has no warehouse", async () => {
    apolloMocks.warehouses = [];
    renderPage();

    expect(await screen.findByRole("heading", { name: "Nhà hàng chưa có kho" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Nguyên liệu/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo Kho chính" }));

    await waitFor(() => {
      expect(apolloMocks.createWarehouse).toHaveBeenCalledWith({
        variables: {
          input: {
            restaurantId: "res-1",
            name: "Kho chính",
            code: "MAIN",
            isActive: true,
          },
        },
      });
    });
  });

  it("does not show warehouse creation action to a read-only user", async () => {
    apolloMocks.warehouses = [];
    renderPage({ id: "viewer-1", permissions: ["inventory.read"] });

    expect(await screen.findByRole("heading", { name: "Nhà hàng chưa có kho" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo Kho chính" })).not.toBeInTheDocument();
    expect(screen.getByText(/cần quyền quản lý kho/i)).toBeInTheDocument();
  });
});
