import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SmartOccupancyHeatmap from "./SmartOccupancyHeatmap";
import StaffPerformance from "./StaffPerformance";

const WEEK_POINTS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(
  (dayLabel, index) => ({
    dayLabel,
    hourLabel: "10:00",
    occupancyRate: index === 0 ? 0.4 : 0.2,
    staffRequired: index === 0 ? 2 : 1,
  }),
);

describe("SmartOccupancyHeatmap", () => {
  it("uses the actual hour count instead of a fixed seven-column layout", () => {
    const { container } = render(
      <SmartOccupancyHeatmap points={WEEK_POINTS} loading={false} />,
    );

    const grid = screen.getByTestId("occupancy-heatmap-grid");
    expect(grid.style.getPropertyValue("--heatmap-columns")).toBe("1");
    expect(container.querySelectorAll(".header-hour")).toHaveLength(1);
    expect(container.querySelectorAll(".row-label")).toHaveLength(7);
    expect(
      screen.getByLabelText(
        "T2, 10:00: mật độ 40 phần trăm, cần 2 nhân viên",
      ),
    ).toHaveTextContent("40%");
  });

  it("keeps a compact action state when occupancy data is unavailable", () => {
    render(<SmartOccupancyHeatmap points={[]} loading={false} />);

    expect(screen.getByText("Chưa đủ dữ liệu mật độ")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xem đơn hàng" }),
    ).toBeInTheDocument();
  });
});

describe("StaffPerformance", () => {
  it("hides filters when no real performance data exists", () => {
    render(<StaffPerformance staffList={[]} loading={false} />);

    expect(screen.queryByRole("button", { name: "Tất cả" })).toBeNull();
    expect(screen.getByText("Chưa có dữ liệu hiệu suất")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xem nhân viên" }),
    ).toBeInTheDocument();
  });

  it("shows a filtered empty state and clamps efficiency progress", () => {
    render(
      <StaffPerformance
        loading={false}
        staffList={[
          {
            staffId: "staff-1",
            fullName: "Phương Anh",
            role: "Nhân viên phục vụ",
            status: "WORKING",
            ordersHandled: 12,
            efficiency: 140,
          },
        ]}
      />,
    );

    const progress = screen.getByRole("progressbar", {
      name: "Hiệu suất của Phương Anh",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress.firstElementChild).toHaveStyle({ width: "100%" });

    fireEvent.click(screen.getByRole("button", { name: "Nghỉ" }));
    expect(
      screen.getByText("Không có nhân viên phù hợp với bộ lọc này."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nghỉ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
