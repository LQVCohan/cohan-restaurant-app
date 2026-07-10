import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Tabs, { getRequestedStorageTab } from "./Tabs";

vi.mock("../../components/common/StorageGridPaginationBridge", () => ({
  default: () => null,
}));

const tabs = [
  { id: "ingredients", label: "Nguyên liệu" },
  { id: "supplies", label: "Vật tư & Khác" },
  { id: "recipes", label: "Công thức" },
  { id: "inventory", label: "Kiểm kê" },
];

beforeEach(() => {
  history.replaceState(null, "", "/manager#inventory");
});

describe("Storage Tabs", () => {
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

  it("accepts only tab ids that exist in the current storage tabs", () => {
    expect(getRequestedStorageTab(tabs, "?tab=recipes")).toBe("recipes");
    expect(getRequestedStorageTab(tabs, "?tab=unknown")).toBe("");
  });

  it("opens the requested tab from the manager URL on mount", async () => {
    history.replaceState(null, "", "/manager?tab=recipes#inventory");
    const onTabChange = vi.fn();

    render(
      <Tabs tabs={tabs} activeTab="ingredients" onTabChange={onTabChange} />,
    );

    await waitFor(() => expect(onTabChange).toHaveBeenCalledWith("recipes"));
  });

  it("switches tab when manager search navigates while inventory is already open", () => {
    const onTabChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeTab="ingredients" onTabChange={onTabChange} />,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: { page: "inventory", query: { tab: "inventory" } },
        }),
      );
    });

    expect(onTabChange).toHaveBeenCalledWith("inventory");
  });

  it("ignores invalid tabs and navigation events for another page", () => {
    const onTabChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeTab="ingredients" onTabChange={onTabChange} />,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: { page: "inventory", query: { tab: "unknown" } },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: { page: "transactions", query: { tab: "recipes" } },
        }),
      );
    });

    expect(onTabChange).not.toHaveBeenCalled();
  });
});
