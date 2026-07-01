import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StorageManagement from "./StorageManagement";
import { AuthContext } from "../../../context/AuthContext";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(() => [vi.fn(async () => ({ data: {} })), {}]),
    useQuery: vi.fn((query) => {
      const opName = query?.definitions?.find((def) => def.kind === "OperationDefinition")?.name?.value;
      const refetch = vi.fn(async () => ({ data: {} }));
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
          data: { warehouses: [{ id: "wh-1", name: "Kho chính" }] },
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

const renderPage = () =>
  render(
    <AuthContext.Provider
      value={{
        user: {
          id: "manager-1",
          permissions: ["inventory.write", "stock.write"],
        },
        restaurants: [{ id: "res-1", name: "Cơm nhà Cohan" }],
        restaurantsLoading: false,
      }}
    >
      <StorageManagement />
    </AuthContext.Provider>,
  );

const lowStockKpi = () => screen.getByText("Sắp hết").closest(".sm-kpi-card");

describe("StorageManagement operations UI", () => {
  it("renders storage title, tabs, KPI cards, and empty ingredient state", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Quản lý kho" })).toBeInTheDocument();
    expect(screen.getByText("Chọn phạm vi dữ liệu, xử lý nhập/xuất và theo dõi tồn kho trong một màn hình.")).toBeInTheDocument();
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
});
