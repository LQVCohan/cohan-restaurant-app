import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import CompactMenuStrip from "./CompactMenuStrip";

const refetchQueries = vi.fn().mockResolvedValue(undefined);
const mutation = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@/apollo/client", () => ({
  apolloClient: {
    refetchQueries,
    mutate: mutation,
  },
}));

const dinnerMenus = [
  {
    id: "menu-vip",
    name: "Menu VIP",
    timeSlot: "dinner",
    isActive: true,
  },
  {
    id: "menu-casual",
    name: "Menu ăn chơi",
    timeSlot: "dinner",
    isActive: false,
  },
];

const renderStrip = (props = {}) =>
  render(
    <AuthContext.Provider
      value={{
        user: { id: "manager-1", roleName: "manager" },
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

describe("CompactMenuStrip", () => {
  beforeEach(() => {
    refetchQueries.mockClear();
    mutation.mockClear();
    window.sessionStorage.clear();
  });

  it("shows every named menu grouped inside the same service time slot", async () => {
    renderStrip();

    const heading = screen.getByRole("heading", { name: "Danh sách thực đơn" });
    expect(heading).toBeInTheDocument();
    expect(heading.parentElement).toHaveTextContent(
      /2\s*thực đơn trong 4 mốc giờ/i,
    );

    const dialog = openMenuList();
    expect(within(dialog).getByText("Menu VIP")).toBeInTheDocument();
    expect(within(dialog).getByText("Menu ăn chơi")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa sáng" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa trưa" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa tối" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Bữa khuya" })).toBeInTheDocument();

    await waitFor(() => expect(refetchQueries).toHaveBeenCalled());
  });

  it("selects an exact sibling menu without leaving its time slot", async () => {
    const onTimeSlotChange = vi.fn();
    renderStrip({ onTimeSlotChange });

    const dialog = openMenuList();
    const casualCard = within(dialog)
      .getByRole("heading", { name: "Menu ăn chơi" })
      .closest("article");
    fireEvent.click(within(casualCard).getByRole("button", { pressed: false }));

    await waitFor(() =>
      expect(onTimeSlotChange).toHaveBeenCalledWith("dinner", "menu-casual"),
    );
  });
});
