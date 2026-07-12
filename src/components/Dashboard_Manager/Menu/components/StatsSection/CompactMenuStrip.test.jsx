import React from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../../../context/AuthContext";
import CompactMenuStrip from "./CompactMenuStrip";

const refetchQueries = vi.fn().mockResolvedValue([]);
const mutation = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings.join(""),
  useApolloClient: () => ({ refetchQueries }),
  useMutation: () => [mutation],
}));

vi.mock("../AuditLogModal/AuditLogModal", () => ({
  default: () => null,
}));

const dinnerMenus = [
  {
    id: "menu-vip",
    restaurantId: "restaurant-1",
    timeSlot: "dinner",
    name: "Menu VIP",
    description: "Không gian riêng và món cao cấp",
    isActive: true,
    itemCount: 8,
  },
  {
    id: "menu-casual",
    restaurantId: "restaurant-1",
    timeSlot: "dinner",
    name: "Menu ăn chơi",
    description: "Món chia sẻ và đồ uống",
    isActive: true,
    itemCount: 12,
  },
];

const renderStrip = (props = {}) =>
  render(
    <AuthContext.Provider
      value={{
        user: { roleName: "manager" },
        activeRestaurantId: "restaurant-1",
      }}
    >
      <CompactMenuStrip
        menus={dinnerMenus}
        selectedTimeSlot="dinner"
        onTimeSlotChange={vi.fn()}
        {...props}
      />
    </AuthContext.Provider>,
  );

const openMenuList = () => {
  fireEvent.click(screen.getByRole("button", { name: /Quản lý danh sách/i }));
  return screen.getByRole("dialog", {
    name: "Quản lý thực đơn theo khung giờ",
  });
};

const getCompactSummary = () =>
  screen
    .getByRole("heading", { name: "Danh sách thực đơn" })
    .closest(".cms-title-box");

describe("CompactMenuStrip", () => {
  beforeEach(() => {
    refetchQueries.mockClear();
    mutation.mockClear();
    window.sessionStorage.clear();
  });

  it("shows every named menu grouped inside the same service time slot", async () => {
    renderStrip();

    expect(
      screen.getByRole("heading", { name: "Danh sách thực đơn" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(within(getCompactSummary()).getByText("Menu VIP")).toBeInTheDocument();
    });
    expect(within(getCompactSummary()).getByText(/Bữa tối/i)).toBeInTheDocument();

    const dialog = openMenuList();
    expect(within(dialog).getByText("Menu VIP")).toBeInTheDocument();
    expect(within(dialog).getByText("Menu ăn chơi")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa sáng" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa trưa" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa tối" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa khuya" })).toBeInTheDocument();
    expect(refetchQueries).not.toHaveBeenCalled();
  });

  it("selects an exact sibling menu without leaving its time slot", async () => {
    const onTimeSlotChange = vi.fn();
    renderStrip({ onTimeSlotChange });

    const dialog = openMenuList();
    const casualCard = within(dialog)
      .getByRole("heading", { name: "Menu ăn chơi" })
      .closest("article");
    fireEvent.click(within(casualCard).getByRole("button", { pressed: false }));

    await waitFor(() => {
      expect(within(casualCard).getByRole("button", { pressed: true })).toBeInTheDocument();
      expect(
        within(getCompactSummary()).getByText("Menu ăn chơi"),
      ).toBeInTheDocument();
    });
    expect(onTimeSlotChange).toHaveBeenCalledWith("dinner");
    expect(
      JSON.parse(window.sessionStorage.getItem("manager.menu.selection")),
    ).toEqual({
      restaurantId: "restaurant-1",
      menuId: "menu-casual",
      timeSlot: "dinner",
    });
  });

  it("opens a create form for an empty time slot even when another slot has menus", () => {
    renderStrip({ onAddMenu: vi.fn() });

    const dialog = openMenuList();
    const breakfastSection = within(dialog)
      .getByRole("heading", { name: "Bữa sáng" })
      .closest("section");
    fireEvent.click(
      within(breakfastSection).getByRole("button", {
        name: /Tạo menu đầu tiên cho bữa sáng/i,
      }),
    );

    expect(within(dialog).getByText("Tạo thực đơn mới")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Mốc giờ phục vụ")).toHaveValue(
      "breakfast",
    );
  });
});
