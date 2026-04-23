import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("keeps the staff schedule tab in read-only mode", () => {
    const { container } = render(<ScheduleManagement readOnly />);

    expect(screen.getByText("Thông Tin Ca Làm Việc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất bản/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Ca Sáng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chia ca tự động/i })).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".shift-card"));

    expect(screen.getByDisplayValue("Ca quản lý đầu tuần")).toBeDisabled();
    expect(screen.queryByText("Thêm nhân sự")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa Ca/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lưu ghi chú/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng/i })).toBeInTheDocument();
  });

  it("creates a real shift payload from the add-shift modal", async () => {
    mockShiftsData = { staffShifts: [] };

    render(<ScheduleManagement />);

    fireEvent.click(screen.getAllByRole("button", { name: /\+ Ca Sáng/i })[0]);
    const modal = document.body.querySelector(".modal-container");
    fireEvent.click(within(modal).getByText("Lan Manager"));
    fireEvent.click(within(modal).getByRole("button", { name: /Lưu & Tạo Lịch/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    const createCall = mutationSpy.mock.calls[0][0];

    expect(createCall.variables.input.employeeId).toBe("staff-1");
    expect(createCall.variables.input.restaurantId).toBe("restaurant-1");
    expect(createCall.variables.input.shiftType).toBe("MORNING");
    expect(createCall.variables.input.status).toBe("scheduled");
    expect(new Date(createCall.variables.input.startTime).toString()).not.toBe("Invalid Date");
    expect(new Date(createCall.variables.input.endTime).toString()).not.toBe("Invalid Date");
  });

  it("deletes a shift group through the detail modal", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<ScheduleManagement />);

    fireEvent.click(container.querySelector(".shift-card"));
    fireEvent.click(screen.getByRole("button", { name: /Xóa Ca/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalled();
    expect(mutationSpy.mock.calls[0][0]).toEqual({
      variables: { shiftId: "shift-row-1" },
    });
  });

  it("updates start and end time for the whole grouped shift", async () => {
    const { container } = render(<ScheduleManagement />);

    fireEvent.click(container.querySelector(".shift-card"));
    const modal = document.body.querySelector(".modal-container");
    fireEvent.change(within(modal).getByLabelText(/Bắt đầu/i), { target: { value: "07:30" } });
    fireEvent.change(within(modal).getByLabelText(/Kết thúc/i), { target: { value: "15:30" } });
    fireEvent.click(within(modal).getByRole("button", { name: /Lưu thời gian/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    const updateCall = mutationSpy.mock.calls[0][0];

    expect(updateCall.variables.shiftId).toBe("shift-row-1");
    expect(updateCall.variables.input).toEqual(
      expect.objectContaining({
        startTime: expect.any(String),
        endTime: expect.any(String),
      })
    );
    expect(new Date(updateCall.variables.input.endTime).getTime()).toBeGreaterThan(
      new Date(updateCall.variables.input.startTime).getTime()
    );
  });

  it("shows a validation message when start and end time are identical", async () => {
    const { container } = render(<ScheduleManagement />);

    fireEvent.click(container.querySelector(".shift-card"));
    const modal = document.body.querySelector(".modal-container");
    fireEvent.change(within(modal).getByLabelText(/Bắt đầu/i), { target: { value: "09:00" } });
    fireEvent.change(within(modal).getByLabelText(/Kết thúc/i), { target: { value: "09:00" } });
    fireEvent.click(within(modal).getByRole("button", { name: /Lưu thời gian/i }));

    expect(await screen.findByText("Giờ kết thúc phải khác giờ bắt đầu.")).toBeInTheDocument();
    expect(mutationSpy).not.toHaveBeenCalled();
  });
});
