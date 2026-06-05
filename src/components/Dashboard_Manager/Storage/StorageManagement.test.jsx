import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
      if (opName === "ManagerRestaurants") {
        return {
          data: {
            restaurantsByManager: {
              edges: [{ node: { id: "res-1", name: "Cơm nhà Cohan" } }],
            },
          },
          loading: false,
          error: null,
          refetch,
        };
      }
      if (opName === "Ingredients") {
        return { data: { ingredients: [] }, loading: false, error: null, refetch };
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
        return { data: { stockItems: [] }, loading: false, error: null, refetch };
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
      }}
    >
      <StorageManagement />
    </AuthContext.Provider>,
  );

describe("StorageManagement operations UI", () => {
  it("renders storage title, tabs, KPI cards, and empty ingredient state", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Quản lý kho" })).toBeInTheDocument();
    expect(screen.getByText("Theo dõi nguyên liệu, vật tư, công thức và kiểm kê kho.")).toBeInTheDocument();
    expect(screen.getByText("Tổng nguyên liệu")).toBeInTheDocument();
    expect(screen.getByText("Sắp hết")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vật tư & Khác/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Công thức/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kiểm kê/i })).toBeInTheDocument();
    expect(screen.getByText("Không có nguyên liệu phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
  });

  it("switches tab content when the inventory tab is clicked", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Kiểm kê/i }));

    expect(screen.getByText("Kiểm kê đang hiển thị")).toBeInTheDocument();
  });
});
