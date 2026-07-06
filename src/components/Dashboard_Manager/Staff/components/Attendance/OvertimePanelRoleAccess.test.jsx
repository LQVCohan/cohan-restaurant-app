import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";
import OvertimePanel from "./OvertimePanel";

vi.mock("@/hooks/useAttendanceManagement");
vi.mock("@/hooks/useOvertimeManagement");

const restaurantId = "64f000000000000000000001";
const pendingRequest = {
  id: "ot-request-1",
  employeeName: "Demo Server",
  employeeCode: "PERF-SRV-01",
  employeeRole: "Phục vụ",
  workDate: "2026-07-06T00:00:00.000Z",
  plannedStartTime: "2026-07-06T13:00:00.000Z",
  plannedEndTime: "2026-07-06T14:00:00.000Z",
  plannedOvertimeMinutes: 60,
  overtimeType: "weekday",
  reason: "Hỗ trợ đóng ca",
  status: "pending_approval",
  requestedAt: "2026-07-06T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAttendanceManagement.mockReturnValue({
    records: [],
    loading: false,
    error: null,
    refreshAttendanceViews: vi.fn(),
    approveAttendanceOvertime: vi.fn(),
    rejectAttendanceOvertime: vi.fn(),
    approveOvertimeState: { loading: false },
    rejectOvertimeState: { loading: false },
  });
  useOvertimeManagement.mockReturnValue({
    overtimeRequests: [pendingRequest],
    loading: false,
    error: null,
    createOvertimeRequest: vi.fn(),
    approveOvertimeRequest: vi.fn(),
    rejectOvertimeRequest: vi.fn(),
    completeOvertimeRequest: vi.fn(),
    createState: { loading: false },
    approveState: { loading: false },
    rejectState: { loading: false },
    completeState: { loading: false },
  });
});

describe("OvertimePanel role actions", () => {
  it("allows manager review/create actions", () => {
    render(
      <OvertimePanel
        user={{ roleName: "manager", userType: "MANAGER", restaurantId }}
        selectedDate="2026-07-06"
        searchQuery=""
        restaurantId={restaurantId}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Tạo yêu cầu tăng ca" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Duyệt yêu cầu tăng ca")).toBeInTheDocument();
  });

  it("keeps accountant read-only", () => {
    render(
      <OvertimePanel
        user={{ roleName: "accountant", userType: "ACCOUNTANT", restaurantId }}
        selectedDate="2026-07-06"
        searchQuery=""
        restaurantId={restaurantId}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Tạo yêu cầu tăng ca" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("Duyệt yêu cầu tăng ca")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Từ chối yêu cầu tăng ca")).not.toBeInTheDocument();
  });
});
