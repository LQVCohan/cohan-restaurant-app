import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import RecipeList from "./RecipeList";

const refetchTrash = vi.fn(async () => ({ data: { recipeTrash: [] } }));
const restoreRecipe = vi.fn(async () => ({ data: {} }));
const showNotification = vi.fn();

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { recipeTrash: [] },
      loading: false,
      error: null,
      refetch: refetchTrash,
    })),
    useMutation: vi.fn(() => [restoreRecipe, {}]),
  };
});

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification }),
}));

vi.mock("./RecipeCard", () => ({
  default: ({ recipe, onDelete, onEdit, onViewDetails }) => (
    <article data-testid={`recipe-card-${recipe.id}`}>
      <h3>{recipe.name}</h3>
      <button type="button" onClick={() => onViewDetails(recipe.id)}>Chi tiết</button>
      <button type="button" onClick={() => onEdit(recipe.id)}>Sửa</button>
      <button type="button" onClick={() => onDelete(recipe.id)}>Xóa</button>
    </article>
  ),
}));

vi.mock("./RecipeModal", () => ({
  default: ({ isOpen, onClose }) => (isOpen ? <div role="dialog" aria-label="Modal công thức"><button onClick={onClose}>Đóng</button></div> : null),
}));

vi.mock("./RecipeDetailModal", () => ({
  default: ({ isOpen, onClose }) => (isOpen ? <div role="dialog" aria-label="Chi tiết công thức"><button onClick={onClose}>Đóng chi tiết</button></div> : null),
}));

vi.mock("./RecipeDishPickerModal", () => ({
  default: ({ isOpenPicker, onRequestClose }) => (isOpenPicker ? <div role="dialog" aria-label="Chọn món"><button onClick={onRequestClose}>Đóng chọn món</button></div> : null),
}));

vi.mock("./recipeImportExport", () => ({
  buildRecipeImportPayloads: vi.fn(() => ({ payloads: [], errors: [] })),
  buildRecipeReportFiles: vi.fn(() => []),
  downloadRecipeImportErrors: vi.fn(),
  downloadRecipeReportsZip: vi.fn(),
  downloadRecipeTemplate: vi.fn(),
  exportRecipesFile: vi.fn(),
  parseRecipeImportFile: vi.fn(async () => []),
}));

const baseProps = {
  restaurantId: "res-1",
  recipes: [],
  loading: false,
  error: null,
  pageInfo: { hasNextPage: false },
  total: 0,
  ingredients: [],
  categoryOptions: [],
  activeCurrency: "VND",
  usdToVndRate: 26000,
  onTimeSlotChange: vi.fn(),
  onSearchChange: vi.fn(),
  onCategoryChange: vi.fn(),
  loadMore: vi.fn(),
  onAddRecipe: vi.fn(),
  onUpdateRecipe: vi.fn(),
  onDeleteRecipe: vi.fn(),
  onRecipeRestored: vi.fn(),
  onRegisterActions: vi.fn(),
};

const renderRecipeList = (props = {}) => render(<RecipeList {...baseProps} {...props} />);

describe("RecipeList inventory regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches between active recipe list and trash without losing the correct empty state", () => {
    renderRecipeList();

    expect(screen.getByRole("heading", { name: "Công Thức Món Ăn" })).toBeInTheDocument();
    expect(screen.getByText("0 món")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm món ăn...")).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy công thức")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Thùng rác/i }));

    expect(screen.getByText("0 đã xóa")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm trong thùng rác...")).toBeInTheDocument();
    expect(screen.getByText("Thùng rác công thức đang trống")).toBeInTheDocument();
    expect(screen.getByText("Công thức đã chuyển vào đây sẽ được giữ trong 30 ngày.")).toBeInTheDocument();
    expect(document.querySelector(".rl-empty-state > .rl-empty-icon")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Danh sách/i })).toBeInTheDocument();
  });

  it("asks before moving a recipe to trash and refetches the trash list after delete", async () => {
    const onDeleteRecipe = vi.fn(async () => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderRecipeList({
      recipes: [
        {
          id: "dish-1",
          name: "Bún bò Huế",
          description: "Món có công thức",
          price: 72000,
          servingVariants: [{ name: "Default", ingredients: [] }],
        },
      ],
      total: 1,
      onDeleteRecipe,
    });

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));

    await waitFor(() => expect(onDeleteRecipe).toHaveBeenCalledWith("dish-1"));
    expect(window.confirm).toHaveBeenCalledWith("Chuyển công thức này vào thùng rác? Bạn có thể khôi phục trong 30 ngày.");
    expect(refetchTrash).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalled();
  });
});
