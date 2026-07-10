import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompactMenuStrip from "./CompactMenuStrip";

vi.mock("../AuditLogModal/AuditLogModal", () => ({
  default: () => null,
}));

describe("CompactMenuStrip", () => {
  it("keeps the restaurant menu list visible even when a legacy collapsed prop is passed", () => {
    render(
      <CompactMenuStrip
        isCollapsed
        menus={[
          {
            id: "menu-breakfast",
            restaurantId: "restaurant-1",
            timeSlot: "breakfast",
            name: "Thực đơn buổi sáng",
            description: "Các món phục vụ buổi sáng",
            isActive: true,
            itemCount: 4,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Các thực đơn của nhà hàng" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thực đơn buổi sáng")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /thu gọn danh sách thực đơn/i }),
    ).not.toBeInTheDocument();
  });
});
