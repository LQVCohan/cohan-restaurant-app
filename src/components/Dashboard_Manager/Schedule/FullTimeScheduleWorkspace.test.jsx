import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FullTimeScheduleWorkspace from "./FullTimeScheduleWorkspace";

vi.mock("lucide-react", () => ({
  CalendarDays: () => <span aria-hidden="true" />,
}));

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
  it("renders the integrated compact full-time workspace shell", () => {
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
    expect(screen.getByTestId("employment-scope")).toHaveAttribute(
      "data-scope",
      "full_time",
    );
    expect(screen.getByTestId("full-time-schedule-core")).toBeInTheDocument();
    expect(
      screen.getByText(/màn hình này tập trung vào xếp ca và công bố lịch tuần/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Toàn thời gian")).not.toBeInTheDocument();
  });
});
