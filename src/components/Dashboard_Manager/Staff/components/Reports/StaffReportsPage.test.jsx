import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffReportsPage from "./StaffReportsPage";

const mockUseStaffReports = vi.fn();
const downloadXlsxWorkbook = vi.fn();

vi.mock("@/hooks/useStaffReports", async () => {
  const actual = await vi.importActual("@/hooks/useStaffReports");
  return {
    ...actual,
    default: (...args) => mockUseStaffReports(...args),
  };
});

vi.mock("@/utils/xlsxWorkbook", () => ({
  downloadXlsxWorkbook: (...args) => downloadXlsxWorkbook(...args),
}));

vi.mock("recharts", () => {
  const MockChart = ({ children }) => <div>{children}</div>;
  const MockLeaf = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    LineChart: MockChart,
    Line: MockLeaf,
    CartesianGrid: MockLeaf,
    XAxis: MockLeaf,
    YAxis: MockLeaf,
    Tooltip: MockLeaf,
    Legend: MockLeaf,
    PieChart: MockChart,
    Pie: MockLeaf,
    Cell: MockLeaf,
    BarChart: MockChart,
    Bar: MockLeaf,
  };
});

const reportFixture = {
  summary: {
    activeEmployees: 12,
    terminatedEmployees: 1,
    joinedEmployees: 2,
    leftEmployees: 0,
    presentCount: 24,
    absentCount: 3,
    lateCount: 2,
    earlyLeaveCount: 1,
    leaveTotal: 4,
    leaveDaysUsed: 6,
    remainingLeaveBalanceDays: 18,
  },
  comparison: [
    { metric: "activeEmployees", current: 12, previous: 10, delta: 2, deltaPct: 20 },
    { metric: "presentCount", current: 24, previous: 22, delta: 2, deltaPct: 9.09 },
  ],
  attendanceTrend: [{ date: "2026-04-01", present: 10, absent: 1, late: 1, earlyLeave: 0 }],
  leaveByType: [{ leaveType: "ANNUAL", count: 3, days: 5 }],
  leaveStatusDistribution: [{ label: "approved", count: 2 }],
  workforceStatusDistribution: [{ label: "Đang hoạt động", count: 12 }],
  attendanceIssueDistribution: [{ label: "Đi muộn", count: 2 }],
  attendanceByShift: [{ shiftType: "morning", records: 10, present: 8, absent: 1 }],
  attendanceDetails: [
    {
      employeeId: "staff-1",
      employeeName: "Lan Manager",
      employeeCode: "NV001",
      date: "2026-04-01",
      shiftType: "morning",
      status: "completed",
      workedMinutes: 480,
      lateMinutes: 5,
      earlyLeaveMinutes: 0,
    },
  ],
  leaveDetails: [
    {
      requestId: "leave-1",
      employeeName: "Lan Manager",
      employeeCode: "NV001",
      leaveType: "ANNUAL",
      status: "approved",
      startDate: "2026-04-02T00:00:00.000Z",
      endDate: "2026-04-03T00:00:00.000Z",
      requestedDays: 2,
      reason: "Vacation",
    },
  ],
};

describe("StaffReportsPage", () => {
  beforeEach(() => {
    mockUseStaffReports.mockReset();
    downloadXlsxWorkbook.mockReset();
  });

  it("renders report content from the real hook contract and exports xlsx", () => {
    mockUseStaffReports.mockReturnValue({
      report: reportFixture,
      loading: false,
      error: null,
    });

    render(<StaffReportsPage />);

    expect(screen.getByText("Nhân sự đang làm / đã nghỉ")).toBeInTheDocument();
    expect(screen.getByText("Xu hướng chấm công theo ngày")).toBeInTheDocument();
    expect(screen.getByText("Chi tiết chấm công")).toBeInTheDocument();
    expect(screen.getByText("Chi tiết nghỉ phép")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/i }));

    expect(downloadXlsxWorkbook).toHaveBeenCalledTimes(1);
    const [sheets, filename] = downloadXlsxWorkbook.mock.calls[0];
    expect(filename).toMatch(/^staff-reports-.*\.xlsx$/);
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "TongQuan",
      "XuHuongChamCong",
      "ChiTietChamCong",
      "ChiTietNghiPhep",
    ]);
  });

  it("shows custom compare inputs only in custom compare mode", () => {
    mockUseStaffReports.mockReturnValue({
      report: reportFixture,
      loading: false,
      error: null,
    });

    const { container } = render(<StaffReportsPage />);

    expect(container.querySelectorAll('input[type="date"]').length).toBe(2);

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "custom" },
    });

    expect(container.querySelectorAll('input[type="date"]').length).toBe(4);
  });
});
