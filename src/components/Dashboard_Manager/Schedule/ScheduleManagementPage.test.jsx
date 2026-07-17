import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScheduleManagementPage from "./ScheduleManagementPage";

const {
  fullTimeRenderSpy,
  partTimeRenderSpy,
  rotatingRenderSpy,
} = vi.hoisted(() => ({
  fullTimeRenderSpy: vi.fn(),
  partTimeRenderSpy: vi.fn(),
  rotatingRenderSpy: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  BriefcaseBusiness: () => <span aria-hidden="true" />,
  RefreshCw: () => <span aria-hidden="true" />,
  TimerReset: () => <span aria-hidden="true" />,
}));
vi.mock("@/apollo/client", () => ({ apolloClient: {} }));
vi.mock("@/utils/scheduleApolloPerformancePatch.js", () => ({
  installScheduleApolloPerformancePatch: () => vi.fn(),
}));
vi.mock("@/utils/scheduleManagerDomPolish.js", () => ({
  initScheduleManagerDomPolish: () => vi.fn(),
}));
vi.mock("@/utils/scheduleManagerAdminPolish.js", () => ({
  initScheduleManagerAdminPolish: () => vi.fn(),
}));

vi.mock("./FullTimeScheduleWorkspace", () => ({
  default: () => {
    fullTimeRenderSpy();
    return <div data-testid="full-time-workspace">Full-time workspace</div>;
  },
}));

vi.mock("./PartTimeScheduleWorkspace", () => ({
  default: () => {
    partTimeRenderSpy();
    return <div data-testid="part-time-workspace">Part-time workspace</div>;
  },
}));

vi.mock("./RotatingScheduleWorkspace", () => ({
  default: () => {
    rotatingRenderSpy();
    return <div data-testid="rotating-workspace">Rotating workspace</div>;
  },
}));

vi.mock("./ScheduleEmploymentScope", () => ({
  SCHEDULE_EMPLOYMENT_SCOPES: {
    FULL_TIME: "full_time",
    PART_TIME: "part_time",
    ROTATING: "rotating",
  },
}));

describe("ScheduleManagementPage workspace routing", () => {
  beforeEach(() => {
    fullTimeRenderSpy.mockClear();
    partTimeRenderSpy.mockClear();
    rotatingRenderSpy.mockClear();
    window.history.replaceState({}, "", "/manager/schedules");
  });

  it("renders a distinct component for each schedule type", () => {
    render(<ScheduleManagementPage />);

    expect(screen.getByTestId("full-time-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("part-time-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rotating-workspace")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Lịch bán thời gian/i }));
    expect(screen.getByTestId("part-time-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("full-time-workspace")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Lịch xoay ca/i }));
    expect(screen.getByTestId("rotating-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("full-time-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("part-time-workspace")).not.toBeInTheDocument();
  });

  it("does not reuse the full-time component for rotating schedule", () => {
    render(<ScheduleManagementPage />);
    expect(fullTimeRenderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Lịch xoay ca/i }));

    expect(rotatingRenderSpy).toHaveBeenCalledTimes(1);
    expect(fullTimeRenderSpy).toHaveBeenCalledTimes(1);
  });
});
