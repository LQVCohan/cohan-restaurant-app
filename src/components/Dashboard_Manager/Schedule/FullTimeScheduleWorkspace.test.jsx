import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FullTimeScheduleWorkspace from "./FullTimeScheduleWorkspace";

vi.mock("./ScheduleManagement", () => ({
  default: () => <div data-testid="full-time-schedule-core">Schedule core</div>,
}));

vi.mock("./ScheduleEmploymentScope", () => ({
  SCHEDULE_EMPLOYMENT_SCOPES: {
    FULL_TIME: "full_time",
  },
  ScheduleEmploymentScopeProvider: ({ scope, children }) => (
    <div data-testid="employment-scope" data-scope={scope}>
      {children}
    </div>
  ),
}));

describe("FullTimeScheduleWorkspace", () => {
  it("renders only the essential full-time workspace content", () => {
    render(<FullTimeScheduleWorkspace />);

    const heading = screen.getByRole("heading", {
      name: /Ca cố định theo ngày làm việc/i,
    });
    const workspace = heading.closest("section");

    expect(workspace).toHaveAttribute(
      "data-layout",
      "integrated-header-compact-toolbar",
    );
    expect(workspace).toHaveAttribute("data-visual-density", "compact");
    expect(workspace).toHaveAttribute("data-content", "essential-only");
    expect(screen.getByTestId("employment-scope")).toHaveAttribute(
      "data-scope",
      "full_time",
    );
    expect(screen.getByTestId("full-time-schedule-core")).toBeInTheDocument();

    expect(screen.queryByText("Lịch toàn thời gian")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Xếp ca cố định theo tuần, kiểm tra phân công/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Đăng ký lịch được quản lý tại Trung tâm xử lý/i),
    ).not.toBeInTheDocument();
  });
});
