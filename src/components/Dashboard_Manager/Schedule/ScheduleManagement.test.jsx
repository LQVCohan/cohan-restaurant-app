import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScheduleManagement from "./ScheduleManagement";

let mockMeData;
let mockRestaurantData;
let mockStaffData;
let mockShiftsData;
let mutationSpy;
let lazyQuerySpy;

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");

  return {
    ...actual,
    useQuery: vi.fn((query) => {
      const body = query?.loc?.source?.body || "";

      if (body.includes("query Me")) {
        return { data: mockMeData, loading: false, error: null };
      }

      if (body.includes("query AllRestaurants")) {
        return { data: mockRestaurantData, loading: false, error: null };
      }

      if (body.includes("query StaffList")) {
        return { data: mockStaffData, loading: false, error: null };
      }

      if (body.includes("query StaffShifts")) {
        return {
          data: mockShiftsData,
          loading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }

      return { data: null, loading: false, error: null };
    }),
    useLazyQuery: vi.fn(() => [lazyQuerySpy, { loading: false, error: null, data: null }]),
    useMutation: vi.fn(() => [mutationSpy]),
  };
});

describe("ScheduleManagement", () => {
  beforeEach(() => {
    lazyQuerySpy = vi.fn().mockResolvedValue({ data: null });
    mutationSpy = vi.fn().mockResolvedValue({});
    mockMeData = {
      me: {
        id: "manager-1",
        roleName: "manager",
        restaurantForStaff: "restaurant-1",
        refRestaurants: [{ id: "restaurant-1", name: "Chi nhánh A" }],
      },
    };
    mockRestaurantData = null;
    mockStaffData = {
      staffList: [
        {
          id: "staff-1",
          fullName: "Lan Manager",
          employeeCode: "MN001",
          department: "management",
          employmentStatus: "working",
          workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          baseSalary: 13000000,
        },
        {
          id: "staff-2",
          fullName: "Minh Server",
          employeeCode: "SV001",
          department: "service",
          employmentStatus: "working",
          workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          baseSalary: 8000000,
        },
      ],
    };
    mockShiftsData = {
      staffShifts: [
        {
          id: "shift-row-1",
          employeeId: "staff-1",
          employeeName: "Lan Manager",
          restaurantId: "restaurant-1",
          shiftType: "morning",
          startTime: "2026-04-20T06:00:00.000Z",
          endTime: "2026-04-20T14:00:00.000Z",
          status: "scheduled",
          notes: "Ca quản lý đầu tuần",
        },
      ],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the staff schedule tab in read-only mode", () => {
    const { container } = render(<ScheduleManagement readOnly />);

    expect(screen.getByText("Thông Tin Ca Làm Việc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất bản/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Ca sáng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chia ca tự động/i })).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".shift-card"));

    expect(screen.getByDisplayValue("Ca quản lý đầu tuần")).toBeDisabled();
    expect(screen.queryByText("Thêm nhân sự")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa Ca/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lưu ghi chú/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng/i })).toBeInTheDocument();
  });

  it("keeps manual actions and exposes auto scheduling in the dedicated schedule module", () => {
    mockShiftsData = { staffShifts: [] };

    render(<ScheduleManagement />);

    expect(screen.getByText("Quản Lý Lịch Làm Việc")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /\+ Ca sáng/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Chia ca tự động/i })).toBeInTheDocument();
  });

  it("opens the auto scheduling preview modal from the schedule toolbar", () => {
    render(<ScheduleManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Chia ca tự động/i }));

    expect(screen.getByText("Scheduling assistant dùng dữ liệu thật từ backend")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Phân tích & tạo preview/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
  });
});
