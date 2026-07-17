import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FullTimeScheduleWorkspace from "./FullTimeScheduleWorkspace";

vi.mock("lucide-react", () => ({
  BriefcaseBusiness: () => <span aria-hidden="true" />,
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
  it("renders the compact full-time shell and keeps registration out of the week canvas", () => {
    render(<FullTimeScheduleWorkspace />);

    expect(
      screen.getByRole("heading", { name: /Ca cố định theo ngày làm việc/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("employment-scope")).toHaveAttribute(
      "data-scope",
      "full_time",
    );
    expect(screen.getByTestId("full-time-schedule-core")).toBeInTheDocument();
    expect(
      screen.getByText(/màn hình này chỉ dùng để xếp ca và công bố lịch tuần/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/không trộn với block bán thời gian hoặc ca xoay/i),
    ).not.toBeInTheDocument();
  });
});
