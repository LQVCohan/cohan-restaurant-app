import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComboManagement from "./ComboManagement";

const apolloState = vi.hoisted(() => ({
  combos: [],
  menuItems: [],
  comboLoading: false,
  menuLoading: false,
  comboError: null,
  menuError: null,
}));

const apolloMocks = vi.hoisted(() => ({
  refetch: vi.fn(async () => ({ data: {} })),
  createCombo: vi.fn(async () => ({ data: { createCombo: { id: "c-new" } } })),
  updateCombo: vi.fn(async () => ({ data: { updateCombo: { id: "c1" } } })),
  deleteCombo: vi.fn(async () => ({ data: { deleteCombo: true } })),
  toggleCombo: vi.fn(async () => ({ data: { toggleComboStatus: { id: "c1", isActive: false } } })),
}));

const showNotification = vi.hoisted(() => vi.fn());

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  const operationName = (document) => document?.definitions?.find((definition) => definition?.name)?.name?.value;
  return {
    ...actual,
    useQuery: vi.fn((document) => {
      const name = operationName(document);
      if (name === "ManagerCombos") {
        return {
          data: { managerCombos: apolloState.combos },
          loading: apolloState.comboLoading,
          error: apolloState.comboError,
          refetch: apolloMocks.refetch,
        };
      }
      return {
        data: { menuItems: apolloState.menuItems },
        loading: apolloState.menuLoading,
        error: apolloState.menuError,
      };
    }),
    useMutation: vi.fn((document) => {
      const name = operationName(document);
      const mutationByName = {
        CreateCombo: apolloMocks.createCombo,
        UpdateCombo: apolloMocks.updateCombo,
        DeleteCombo: apolloMocks.deleteCombo,
        ToggleCombo: apolloMocks.toggleCombo,
      };
      return [mutationByName[name] || vi.fn(), { loading: false }];
    }),
  };
});

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal();
  const TestIcon = (props) => <svg aria-hidden="true" {...props} />;
  return {
    ...actual,
    BadgeDollarSign: actual.BadgeDollarSign || actual.DollarSign || TestIcon,
  };
});

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    selectedRestaurantId: "r1",
    restaurantOptions: [{ id: "r1", name: "Cohan" }],
    setSelectedRestaurantId: vi.fn(),
    hasRestaurants: true,
  }),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification }),
}));

const renderPage = () => render(<ComboManagement />);

const activeCombo = {
  id: "c1",
  restaurantId: "r1",
  restaurantName: "Cohan",
  name: "Combo sáng",
  description: "Bữa sáng nhanh",
  imageUrl: "",
  price: 45000,
  originalPrice: 55000,
  isActive: true,
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T01:00:00.000Z",
  items: [{ menuItemId: "m1", name: "Phở bò", qty: 1, price: 55000, imageUrl: "" }],
};

const availableMenuItems = [
  { id: "m1", name: "Phở bò", basePrice: 55000, thumbImage: "", status: "available", restaurantId: "r1" },
  { id: "m2", name: "Cà phê sữa", basePrice: 25000, thumbImage: "", status: "available", restaurantId: "r1" },
];

describe("ComboManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apolloState.combos = [];
    apolloState.menuItems = availableMenuItems;
    apolloState.comboLoading = false;
    apolloState.menuLoading = false;
    apolloState.comboError = null;
    apolloState.menuError = null;
  });

  it("renders the manager heading and create action", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Quản lý combo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo combo" })).toBeInTheDocument();
    expect(screen.getByText("Bộ món bán cố định")).toBeInTheDocument();
  });

  it("opens the wide editor and closes it with Escape", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo combo" });

    expect(within(dialog).getByText("Xem trước")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Cohan" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tạo combo" })).not.toBeInTheDocument());
  });

  it("adds each menu item once and disables add when all items are selected", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo combo" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm món" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm món" }));

    const selectors = within(dialog).getAllByRole("combobox", { name: /Chọn món/ });
    expect(selectors).toHaveLength(2);
    expect(selectors[0]).toHaveValue("m1");
    expect(selectors[1]).toHaveValue("m2");
    expect(within(dialog).getByRole("button", { name: "Đã chọn hết món" })).toBeDisabled();
  });

  it("creates a combo with normalized integer quantities", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo combo" });

    fireEvent.change(within(dialog).getByLabelText("Tên combo"), { target: { value: "Combo trưa" } });
    fireEvent.change(within(dialog).getByLabelText("Giá bán combo"), { target: { value: "70000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm món" }));
    fireEvent.change(within(dialog).getByLabelText("Số lượng món 1"), { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo combo" }));

    await waitFor(() => {
      expect(apolloMocks.createCombo).toHaveBeenCalledWith({
        variables: {
          input: {
            restaurantId: "r1",
            name: "Combo trưa",
            description: "",
            imageUrl: "",
            price: 70000,
            isActive: true,
            items: [{ menuItemId: "m1", qty: 2 }],
          },
        },
      });
    });
    expect(apolloMocks.refetch).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith("Đã tạo combo.", "success");
  });

  it("preserves an existing item snapshot when the item is no longer returned by the menu query", () => {
    apolloState.combos = [{
      ...activeCombo,
      items: [{ menuItemId: "old-item", name: "Món cũ", qty: 2, price: 20000, imageUrl: "" }],
    }];
    apolloState.menuItems = [];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sửa Combo sáng" }));
    const dialog = screen.getByRole("dialog", { name: "Cập nhật combo" });

    expect(within(dialog).getByRole("option", { name: "Món cũ · Không còn trong danh sách bán" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("40.000đ").length).toBeGreaterThan(0);
  });

  it("toggles and deletes a combo through the scoped mutations", async () => {
    apolloState.combos = [activeCombo];
    apolloState.menuItems = availableMenuItems;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Tắt Combo sáng" }));
    await waitFor(() => expect(apolloMocks.toggleCombo).toHaveBeenCalledWith({ variables: { id: "c1", isActive: false } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Xóa Combo sáng" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Xóa Combo sáng" }));
    await waitFor(() => expect(apolloMocks.deleteCombo).toHaveBeenCalledWith({ variables: { id: "c1" } }));
    expect(window.confirm).toHaveBeenCalledWith("Xóa combo “Combo sáng”?");
  });
});
