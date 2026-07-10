import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@apollo/client", () => ({
  gql: (parts) => parts,
  useQuery: () => ({ data: {}, loading: false, error: null }),
}));

vi.mock("../../../../../hooks/useStaffPerformance", () => ({
  default: () => ({
    snapshots: [],
    loading: false,
    error: null,
    upsertStaffPerformanceReview: vi.fn(),
    recalculateStaffPerformanceSnapshots: vi.fn(),
    reviewState: { loading: false },
    recalculateState: { loading: false },
  }),
}));

import StaffPerformancePage from "./StaffPerformancePage";

describe("StaffPerformancePage action layout", () => {
  it("removes the duplicate hero and places actions in their task context", () => {
    const { container } = render(
      <StaffPerformancePage
        employees={[]}
        selectedRestaurant="restaurant-1"
        restaurantList={[{ id: "restaurant-1", name: "Cơ sở trung tâm" }]}
      />,
    );

    expect(container.querySelector(".performance-hero")).not.toBeInTheDocument();

    const periodControls = container.querySelector(".period-controls");
    expect(periodControls).not.toBeNull();
    expect(
      within(periodControls).getByRole("button", { name: "Kỳ hiện tại" }),
    ).toBeInTheDocument();

    const tableActions = container.querySelector(".table-header-actions");
    expect(tableActions).not.toBeNull();
    expect(
      within(tableActions).getByRole("button", { name: "Xuất CSV" }),
    ).toBeInTheDocument();
    expect(
      within(tableActions).getByRole("button", {
        name: "Tính lại hiệu suất kỳ này",
      }),
    ).toBeInTheDocument();
  });

  it("keeps data actions disabled until a restaurant is selected", () => {
    const { container } = render(
      <StaffPerformancePage employees={[]} selectedRestaurant="all" />,
    );

    expect(container.querySelector(".performance-hero")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xuất CSV" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tính lại hiệu suất kỳ này" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("Vui lòng chọn một nhà hàng cụ thể");
  });
});
