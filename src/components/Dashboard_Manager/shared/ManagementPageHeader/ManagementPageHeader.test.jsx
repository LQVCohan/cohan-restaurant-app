import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagementPageHeader from "./ManagementPageHeader";

const restaurants = [
  { id: "restaurant-1", name: "Chi nhánh 1" },
  { id: "restaurant-2", name: "Chi nhánh 2" },
];

const renderHeader = (props = {}) => {
  const onRestaurantChange = props.onRestaurantChange || vi.fn();
  render(
    <ManagementPageHeader
      title="Quản lý bàn"
      showTimeWidget={false}
      selectedRestaurant="restaurant-1"
      onRestaurantChange={onRestaurantChange}
      restaurantList={restaurants}
      {...props}
    />,
  );
  return { onRestaurantChange };
};

describe("ManagementPageHeader restaurant scope", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the persisted manager branch when a legacy page opens", async () => {
    localStorage.setItem("manager.selectedRestaurantId", "restaurant-2");
    const { onRestaurantChange } = renderHeader();

    await waitFor(() =>
      expect(onRestaurantChange).toHaveBeenCalledWith("restaurant-2"),
    );
  });

  it("updates the page when the global manager selector changes", async () => {
    const { onRestaurantChange } = renderHeader();

    window.dispatchEvent(
      new CustomEvent("manager:scope-selection", {
        detail: {
          key: "manager.selectedRestaurantId",
          value: "restaurant-2",
        },
      }),
    );

    await waitFor(() =>
      expect(onRestaurantChange).toHaveBeenCalledWith("restaurant-2"),
    );
  });

  it("publishes page-level branch changes back to the shared manager scope", async () => {
    const scopeListener = vi.fn();
    window.addEventListener("manager:scope-selection", scopeListener);
    const { onRestaurantChange } = renderHeader();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "restaurant-2" },
    });

    await waitFor(() =>
      expect(onRestaurantChange).toHaveBeenCalledWith("restaurant-2"),
    );
    expect(localStorage.getItem("manager.selectedRestaurantId")).toBe(
      "restaurant-2",
    );
    expect(scopeListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          key: "manager.selectedRestaurantId",
          value: "restaurant-2",
          source: "management-page-header",
        }),
      }),
    );

    window.removeEventListener("manager:scope-selection", scopeListener);
  });

  it("ignores a manager branch that is not available on the page", async () => {
    const { onRestaurantChange } = renderHeader();

    window.dispatchEvent(
      new CustomEvent("manager:scope-selection", {
        detail: {
          key: "manager.selectedRestaurantId",
          value: "restaurant-outside-scope",
        },
      }),
    );

    await Promise.resolve();
    expect(onRestaurantChange).not.toHaveBeenCalled();
  });
});
