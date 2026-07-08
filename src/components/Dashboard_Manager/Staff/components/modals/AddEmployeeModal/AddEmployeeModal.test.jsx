import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddEmployeeModal from "./AddEmployeeModal";

vi.mock("../EmployeeFormModal/EmployeeFormModal", () => ({
  default: ({ onSubmit, restaurantList, defaultRestaurantId }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          fullName: "Nhân viên mới",
          restaurantForStaff: "legacy-restaurant",
        })
      }
    >
      {`${defaultRestaurantId}:${restaurantList.map((item) => item.id).join(",")}`}
    </button>
  ),
}));

describe("AddEmployeeModal business context", () => {
  it("submits the active business scope instead of account fallback data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);

    render(
      <AddEmployeeModal
        businessContext={{ brandId: "brand-active", restaurantId: "restaurant-active" }}
        restaurantList={[
          { id: "restaurant-active", brandId: "brand-active" },
          { id: "restaurant-other", brandId: "brand-active" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "restaurant-active:restaurant-active",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: "Nhân viên mới",
      staffBusinessContext: {
        brandId: "brand-active",
        restaurantId: "restaurant-active",
      },
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("restaurantForStaff");
  });

  it("blocks creation when the active business context is unavailable", async () => {
    const onSubmit = vi.fn();

    render(
      <AddEmployeeModal
        businessContext={{ brandId: "", restaurantId: "" }}
        restaurantList={[]}
        onSubmit={onSubmit}
      />,
    );

    await expect(
      screen.getByRole("button", { name: ":" }).click(),
    ).rejects.toThrow(
      "Chưa xác định được doanh nghiệp và nhà hàng đang hoạt động.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
