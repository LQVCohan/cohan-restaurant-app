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
          restaurantForStaff: "restaurant-other",
        })
      }
    >
      {`${defaultRestaurantId}:${restaurantList.map((item) => item.id).join(",")}`}
    </button>
  ),
}));

describe("AddEmployeeModal business context", () => {
  it("uses the active business while preserving restaurant selection", () => {
    const onSubmit = vi.fn().mockResolvedValue(null);

    render(
      <AddEmployeeModal
        defaultRestaurantId="restaurant-active"
        restaurantList={[
          { id: "restaurant-active", brandId: "brand-active" },
          { id: "restaurant-other", brandId: "brand-active" },
          { id: "restaurant-foreign", brandId: "brand-foreign" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "restaurant-active:restaurant-active,restaurant-other",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: "Nhân viên mới",
      staffBusinessContext: {
        brandId: "brand-active",
        restaurantId: "restaurant-other",
      },
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("restaurantForStaff");
  });
});
