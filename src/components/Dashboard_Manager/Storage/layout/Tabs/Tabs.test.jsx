import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Tabs from "./Tabs";

vi.mock("../../components/common/StorageGridPaginationBridge", () => ({
  default: () => null,
}));

const tabs = [
  { id: "ingredients", label: "Nguyên liệu" },
  { id: "supplies", label: "Vật tư & Khác" },
  { id: "recipes", label: "Công thức" },
  { id: "inventory", label: "Kiểm kê" },
];

describe("Storage Tabs view mode", () => {
  it("defaults to cards and keeps horizontal list selected between catalog tabs", () => {
    const onTabChange = vi.fn();
    const { container, rerender } = render(
      <Tabs tabs={tabs} activeTab="ingredients" onTabChange={onTabChange} />,
    );

    expect(screen.getByRole("radio", { name: "Thẻ" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Danh sách" }));
    expect(screen.getByRole("radio", { name: "Danh sách" })).toBeChecked();

    rerender(<Tabs tabs={tabs} activeTab="supplies" onTabChange={onTabChange} />);
    expect(screen.getByRole("radio", { name: "Danh sách" })).toBeChecked();
    expect(container.querySelector(".sm-view-toggle")).not.toHaveClass("is-hidden");

    rerender(<Tabs tabs={tabs} activeTab="recipes" onTabChange={onTabChange} />);
    expect(screen.getByRole("radio", { name: "Danh sách" })).toBeChecked();
    expect(container.querySelector(".sm-view-toggle")).not.toHaveClass("is-hidden");

    rerender(<Tabs tabs={tabs} activeTab="inventory" onTabChange={onTabChange} />);
    expect(container.querySelector(".sm-view-toggle")).toHaveClass("is-hidden");
  });
});
