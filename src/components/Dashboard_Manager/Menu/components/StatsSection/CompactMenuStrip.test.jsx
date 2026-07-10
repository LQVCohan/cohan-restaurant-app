import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

describe("CompactMenuStrip", () => {
  it("always shows all four management time slots", () => {
    render(<CompactMenuStrip isCollapsed menus={[breakfastMenu]} />);

    expect(
      screen.getByRole("heading", {
        name: "Quản lý thực đơn theo khung giờ",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thực đơn buổi sáng")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Chọn Bữa trưa, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Chọn Bữa tối, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Chọn Bữa khuya, chưa có thực đơn",
      }),
    ).toBeInTheDocument();
  });

  it("selects an empty time slot without hiding the other slots", () => {
    const onTimeSlotChange = vi.fn();
    render(
      <CompactMenuStrip
        menus={[breakfastMenu]}
        onTimeSlotChange={onTimeSlotChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn Bữa trưa, chưa có thực đơn",
      }),
    );

    expect(onTimeSlotChange).toHaveBeenCalledWith("lunch");
    expect(screen.getByText("Thực đơn buổi sáng")).toBeInTheDocument();
  });

  it("keeps an inactive menu visible and exposes the restore action", () => {
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

    expect(screen.getByText("Thực đơn buổi tối")).toBeInTheDocument();
    expect(screen.getByText("Đang ẩn với khách")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Hiển thị lại thực đơn Thực đơn buổi tối",
      }),
    );

    expect(onToggleMenuActive).toHaveBeenCalledWith(inactiveMenu);
  });
});
