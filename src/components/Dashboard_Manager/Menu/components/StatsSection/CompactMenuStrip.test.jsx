import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompactMenuStrip from "./CompactMenuStrip";

vi.mock("../AuditLogModal/AuditLogModal", () => ({
  default: () => null,
}));

const breakfastMenu = {
  id: "menu-breakfast",
  restaurantId: "restaurant-1",
  timeSlot: "breakfast",
  name: "Thực đơn buổi sáng",
  description: "Các món phục vụ buổi sáng",
  isActive: true,
  itemCount: 4,
};

const openMenuList = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Xem danh sách thực đơn" }),
  );
  return screen.getByRole("dialog", { name: "Danh sách thực đơn" });
};

describe("CompactMenuStrip", () => {
  it("shows a clear launcher and opens all four management time slots in a modal", () => {
    render(<CompactMenuStrip menus={[breakfastMenu]} />);

    expect(
      screen.getByRole("heading", { name: "Danh sách thực đơn" }),
    ).toBeInTheDocument();

    const dialog = openMenuList();
    expect(within(dialog).getByText("Thực đơn buổi sáng")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "Chọn Bữa trưa, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "Chọn Bữa tối, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "Chọn Bữa khuya, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
  });

  it("selects an empty time slot from the modal", () => {
    const onTimeSlotChange = vi.fn();
    render(
      <CompactMenuStrip
        menus={[breakfastMenu]}
        onTimeSlotChange={onTimeSlotChange}
      />,
    );

    const dialog = openMenuList();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Chọn Bữa trưa, chưa có thực đơn",
      }),
    );

    expect(onTimeSlotChange).toHaveBeenCalledWith("lunch");
  });

  it("keeps an inactive menu visible and exposes the restore action in the modal", () => {
    const onToggleMenuActive = vi.fn();
    const inactiveMenu = {
      ...breakfastMenu,
      id: "menu-dinner",
      timeSlot: "dinner",
      name: "Thực đơn buổi tối",
      isActive: false,
    };

    render(
      <CompactMenuStrip
        menus={[inactiveMenu]}
        onToggleMenuActive={onToggleMenuActive}
      />,
    );

    const dialog = openMenuList();
    expect(within(dialog).getByText("Thực đơn buổi tối")).toBeInTheDocument();
    expect(within(dialog).getByText("Đang ẩn với khách")).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Hiển thị lại thực đơn Thực đơn buổi tối",
      }),
    );

    expect(onToggleMenuActive).toHaveBeenCalledWith(inactiveMenu);
  });
});
