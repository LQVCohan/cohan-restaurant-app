import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagerMenuCatalogModal from "./ManagerMenuCatalogModal";

const useQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal()),
  useQuery: (...args) => useQueryMock(...args),
}));

const connection = (items = [], hasNextPage = false) => ({
  edges: items.map((node) => ({ node })),
  pageInfo: { hasNextPage },
});

const catalogData = {
  menus: [
    {
      id: "menu-breakfast",
      restaurantId: "restaurant-1",
      timeSlot: "breakfast",
      name: "Thực đơn sáng",
      description: "Phục vụ đầu ngày",
      isActive: true,
      itemCount: 2,
    },
    {
      id: "menu-dinner",
      restaurantId: "restaurant-1",
      timeSlot: "dinner",
      name: "Thực đơn tối",
      description: "Phục vụ buổi tối",
      isActive: false,
      itemCount: 1,
    },
  ],
  breakfast: connection([
    { id: "dish-1", menuId: "menu-breakfast", name: "Phở bò", basePrice: 65000, status: "available" },
    { id: "dish-2", menuId: "menu-breakfast", name: "Bánh mì", basePrice: 35000, status: "out_of_stock" },
  ]),
  lunch: connection([]),
  dinner: connection([
    { id: "dish-3", menuId: "menu-dinner", name: "Cơm gà", basePrice: 55000, status: "hidden" },
  ], true),
  lateNight: connection([]),
};

describe("ManagerMenuCatalogModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryMock.mockReturnValue({
      data: catalogData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("groups menus and dishes by service time slot", () => {
    render(
      <ManagerMenuCatalogModal
        isOpen
        onClose={vi.fn()}
        restaurantId="restaurant-1"
        restaurantName="Cohan Quận 1"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Danh sách thực đơn" })).toBeInTheDocument();
    expect(screen.getByText("Cohan Quận 1")).toBeInTheDocument();

    const breakfastCard = screen.getByText("Thực đơn sáng").closest("article");
    expect(within(breakfastCard).getByText("Phở bò")).toBeInTheDocument();
    expect(within(breakfastCard).getByText("Bánh mì")).toBeInTheDocument();
    expect(within(breakfastCard).getByText("65.000đ")).toBeInTheDocument();
    expect(within(breakfastCard).getByText("Hết món")).toBeInTheDocument();

    const dinnerCard = screen.getByText("Thực đơn tối").closest("article");
    expect(within(dinnerCard).getAllByText("Đang ẩn")).toHaveLength(2);
    expect(within(dinnerCard).getByText("Cơm gà")).toBeInTheDocument();
    expect(within(dinnerCard).getByText(/200 món đầu tiên/)).toBeInTheDocument();

    expect(screen.getAllByText("Chưa có thực đơn")).toHaveLength(2);
  });

  it("skips the query and explains that a branch must be selected", () => {
    render(
      <ManagerMenuCatalogModal isOpen onClose={vi.fn()} restaurantId="" />,
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
    expect(screen.getByText("Chưa chọn chi nhánh")).toBeInTheDocument();
  });

  it("shows a retry action for query errors", () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Mất kết nối"),
      refetch,
    });

    render(
      <ManagerMenuCatalogModal
        isOpen
        onClose={vi.fn()}
        restaurantId="restaurant-1"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Mất kết nối");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
