import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../../../context/AuthContext";
import MenuItemCard from "./MenuItemCard";

vi.mock("../../../../common/LocalImageView", () => ({
  default: ({ alt }) => <img alt={alt} src="/mock-dish.jpg" />,
}));

vi.mock("../AuditLogModal/AuditLogModal", () => ({
  default: () => null,
}));

const managerUser = {
  roleName: "manager",
  permissions: ["menu.write", "menu.read"],
};

const renderCard = (props = {}) => {
  const item = {
    id: "raw-id-123",
    name: "Bún bò Huế",
    categoryId: "cat-raw-456",
    categoryName: "Món nước",
    status: "available",
    inventoryStatus: "IN_STOCK",
    basePrice: 65000,
    servingVariants: [{ key: "regular", name: "Tô thường", price: 65000 }],
    ...props.item,
  };

  return render(
    <AuthContext.Provider value={{ user: managerUser }}>
      <MenuItemCard item={item} canUpdateItem {...props} />
    </AuthContext.Provider>,
  );
};

describe("MenuItemCard", () => {
  it("renders scannable dish details without exposing raw ids", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Bún bò Huế" })).toBeInTheDocument();
    expect(screen.getByText("Món nước")).toBeInTheDocument();
    expect(screen.getAllByText(/65.000/).length).toBeGreaterThan(0);
    expect(screen.getByText("Đang bán")).toBeInTheDocument();
    expect(screen.queryByText("cat-raw-456")).not.toBeInTheDocument();
    expect(screen.queryByText("raw-id-123")).not.toBeInTheDocument();
  });

  it("calls status handler from the quick status menu", () => {
    const onStatusChange = vi.fn();
    renderCard({ onStatusChange });

    fireEvent.click(screen.getByRole("button", { name: "Mở danh sách trạng thái bán" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Tạm ngưng bán" }));

    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Bún bò Huế" }), "unavailable");
  });
});
