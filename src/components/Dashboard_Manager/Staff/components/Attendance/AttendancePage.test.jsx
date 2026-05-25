import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttendancePage, { getAttendanceActionErrorMessage } from "./AttendancePage";
const useAttendanceManagementMock = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  AuthContext: React.createContext({ user: { restaurantForStaff: "r1" } }),
}));

vi.mock("./OvertimePanel", () => ({
  default: () => <div>Overtime Panel</div>,
}));

vi.mock("@/hooks/useAttendanceManagement", () => ({
  default: (...args) => useAttendanceManagementMock(...args),
  toAttendanceIsoStartOfDay: vi.fn(),
}));

beforeEach(() => {
  useAttendanceManagementMock.mockReturnValue({
    employees: [],
    records: [],
    correctionRequests: [],
    stats: {},
    correctionStats: {},
    loading: false,
    error: "",
    correctionsLoading: false,
    correctionsError: "",
    refetch: vi.fn(),
    refreshAttendanceViews: vi.fn(),
    mutateQuickAttendance: vi.fn(),
    mutationState: { loading: false },
    createAttendanceCorrectionRequest: vi.fn(),
    approveAttendanceCorrectionRequest: vi.fn(),
    rejectAttendanceCorrectionRequest: vi.fn(),
    cancelAttendanceCorrectionRequest: vi.fn(),
    createCorrectionState: { loading: false },
    approveCorrectionState: { loading: false },
    rejectCorrectionState: { loading: false },
    cancelCorrectionState: { loading: false },
  });
});

describe("getAttendanceActionErrorMessage", () => {
  it("returns permission message for FORBIDDEN", () => {
    const error = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    expect(getAttendanceActionErrorMessage(error, "fallback")).toBe(
      "Bạn không có quyền thực hiện thao tác chấm công/chỉnh công này.",
    );
  });

  it("returns session message for UNAUTHENTICATED", () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: "UNAUTHENTICATED" } }] },
      },
    };
    expect(getAttendanceActionErrorMessage(error, "fallback")).toBe(
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
    );
  });

  it("returns fallback for non-auth errors", () => {
    const error = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getAttendanceActionErrorMessage(error, "fallback")).toBe("fallback");
  });
});

describe("AttendancePage readiness navigation", () => {
  it("updates active view when manager:navigation-query is received", async () => {
    render(<AttendancePage />);

    window.history.replaceState(
      null,
      "",
      "/manager?staffPage=attendance&attendanceTab=overtime&employeeId=e01#staff",
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: {
            page: "staff",
            query: { staffPage: "attendance", attendanceTab: "overtime" },
          },
        }),
      );
    });

    expect(await screen.findByText("Overtime Panel")).toBeInTheDocument();
  });

  it("routes off-schedule readiness to attendance table instead of overtime", async () => {
    render(<AttendancePage />);

    window.history.replaceState(
      null,
      "",
      "/manager?staffPage=attendance&attendanceTab=off_schedule&employeeId=e01#staff",
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: {
            page: "staff",
            query: {
              staffPage: "attendance",
              attendanceTab: "off_schedule",
              employeeId: "e01",
            },
          },
        }),
      );
    });

    expect(screen.getByText("Bảng công")).toBeInTheDocument();
    expect(screen.getByText("Ngoài lịch")).toBeInTheDocument();
    expect(screen.queryByText("Overtime Panel")).not.toBeInTheDocument();
  });

  it("shows schedule deep-link banner and applies initial attendance filters from query", async () => {
    window.history.replaceState(
      null,
      "",
      "/manager?staffPage=attendance&date=2026-05-03&employeeId=e01&restaurantId=r2#staff",
    );

    render(<AttendancePage />);

    expect(await screen.findByText("Đang xem chấm công từ lịch làm việc")).toBeInTheDocument();
    expect(screen.getByText(/Ngày: 2026-05-03/)).toBeInTheDocument();
    expect(screen.getByText(/Nhân viên: e01/)).toBeInTheDocument();
    expect(screen.getByText(/Nhà hàng: r2/)).toBeInTheDocument();

    expect(useAttendanceManagementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDate: "2026-05-03",
        search: "e01",
        restaurantId: "r2",
      }),
    );
  });

  it("clears schedule deep-link filters without leaving attendance page", async () => {
    window.history.replaceState(
      null,
      "",
      "/manager?staffPage=attendance&date=2026-05-03&employeeId=e01&restaurantId=r2#staff",
    );

    render(<AttendancePage />);

    const clearButton = await screen.findByRole("button", {
      name: "Xoá bộ lọc từ lịch",
    });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText("Đang xem chấm công từ lịch làm việc")).not.toBeInTheDocument();
    });

    const url = new URL(window.location.href);
    expect(url.searchParams.get("date")).toBeNull();
    expect(url.searchParams.get("employeeId")).toBeNull();
    expect(url.searchParams.get("restaurantId")).toBeNull();
    expect(url.searchParams.get("staffPage")).toBe("attendance");
    expect(url.hash).toBe("#staff");

    expect(useAttendanceManagementMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: "",
        restaurantId: "r1",
      }),
    );
  });
});
