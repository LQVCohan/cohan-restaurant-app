import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendancePage, {
  getAttendanceActionErrorMessage,
  resolveAttendanceRestaurantId,
} from "./AttendancePage";
const useAttendanceManagementMock = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const createAttendanceHookData = (overrides = {}) => ({
  employees: [],
  records: [],
  correctionRequests: [],
  stats: { total: 0, present: 0, lateOrEarly: 0 },
  correctionStats: { pending: 0, total: 0, applied: 0, rejected: 0, cancelled: 0 },
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
  ...overrides,
});

vi.mock("@/context/AuthContext", () => ({
  AuthContext: React.createContext({ user: {} }),
}));

vi.mock("./OvertimePanel", () => ({
  default: () => <div>Overtime Panel</div>,
}));

vi.mock("@/hooks/useAttendanceManagement", () => ({
  default: function useAttendanceManagement(...args) {
    return useAttendanceManagementMock(...args);
  },
  toAttendanceIsoStartOfDay: vi.fn(),
}));

beforeEach(() => {
  useAttendanceManagementMock.mockReturnValue(createAttendanceHookData());
  Element.prototype.scrollIntoView = vi.fn();
  window.requestAnimationFrame = (callback) => {
    callback();
    return 0;
  };
});

afterEach(() => {
  if (originalScrollIntoView) {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete Element.prototype.scrollIntoView;
  }
  if (originalRequestAnimationFrame) {
    window.requestAnimationFrame = originalRequestAnimationFrame;
  } else {
    delete window.requestAnimationFrame;
  }
});

describe("resolveAttendanceRestaurantId", () => {
  it("prioritizes a focused schedule restaurant over the page default", () => {
    expect(
      resolveAttendanceRestaurantId({
        queryRestaurantId: "restaurant-focused",
        userRestaurantId: "restaurant-default",
        records: [{ restaurantId: "restaurant-record" }],
      }),
    ).toBe("restaurant-focused");
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

    expect(await screen.findByText("Đang xử lý bất thường từ lịch làm việc")).toBeInTheDocument();
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
      expect(screen.queryByText("Đang xử lý bất thường từ lịch làm việc")).not.toBeInTheDocument();
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
        restaurantId: null,
      }),
    );
  });

  it("renders context panel details and highlights focused attendance row", async () => {
    useAttendanceManagementMock.mockReturnValue({
      ...createAttendanceHookData(),
      records: [
        { id: "a1", employeeId: "e01", employeeName: "Lan Manager", employeeCode: "L01", employeeRole: "Manager", source: "system" },
        { id: "a2", employeeId: "e02", employeeName: "Minh Server", employeeCode: "M02", employeeRole: "Server", source: "system" },
      ],
      correctionRequests: [],
    });
    window.history.replaceState(null, "", "/manager?staffPage=attendance&date=2026-05-03&employeeId=e01&restaurantId=r2#staff");
    render(<AttendancePage />);

    expect(await screen.findByText("Đang xử lý bất thường từ lịch làm việc")).toBeInTheDocument();
    expect(screen.getByText(/Ngày: 2026-05-03/)).toBeInTheDocument();
    expect(screen.getByText(/Nhân viên: e01/)).toBeInTheDocument();
    expect(screen.getByText(/Nhà hàng: r2/)).toBeInTheDocument();
    expect(screen.getByText(/Số bản ghi khớp: 1/)).toBeInTheDocument();
    expect(screen.getByText("Từ lịch")).toBeInTheDocument();

    const lanRow = screen.getByText("Lan Manager").closest("tr");
    expect(lanRow).toHaveClass("focused-attendance-row");
    expect(lanRow).toHaveAttribute("data-focused-attendance-row", "true");
    const minhRow = screen.getByText("Minh Server").closest("tr");
    expect(minhRow).not.toHaveClass("focused-attendance-row");
  });

  it("opens existing correction modal from context action when exactly one record matches", async () => {
    useAttendanceManagementMock.mockReturnValue({
      ...createAttendanceHookData(),
      records: [
        { id: "a1", employeeId: "e01", employeeName: "Lan Manager", employeeCode: "L01", employeeRole: "Manager", source: "system", workDate: "2026-05-03T00:00:00.000Z" },
      ],
      correctionRequests: [],
    });
    window.history.replaceState(null, "", "/manager?staffPage=attendance&date=2026-05-03&employeeId=e01&restaurantId=r2#staff");
    render(<AttendancePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tạo yêu cầu chỉnh công" }));
    expect(
      await screen.findByText((_content, element) =>
        element?.id === "attendance-correction-desc" &&
        element.textContent.includes("Lan Manager") &&
        element.textContent.includes("Kiểm tra giờ đề xuất trước khi gửi duyệt"),
      ),
    ).toBeInTheDocument();
    const evidenceSummary = screen.getByText("Thêm bằng chứng (không bắt buộc)");
    expect(evidenceSummary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(evidenceSummary);
    expect(evidenceSummary.closest("details")).toHaveAttribute("open");
  });

  it("shows pending correction summary and opens correction view from context action", async () => {
    useAttendanceManagementMock.mockReturnValue({
      ...createAttendanceHookData({ correctionStats: { pending: 1, total: 1, applied: 0, rejected: 0, cancelled: 0 } }),
      records: [
        { id: "a1", employeeId: "e01", employeeName: "Lan Manager", employeeCode: "L01", employeeRole: "Manager", source: "system" },
      ],
      correctionRequests: [{ id: "c1", employeeId: "e01", status: "pending", employeeName: "Lan Manager", workDate: "2026-05-03T00:00:00.000Z" }],
    });
    window.history.replaceState(null, "", "/manager?staffPage=attendance&date=2026-05-03&employeeId=e01&restaurantId=r2#staff");
    render(<AttendancePage />);
    expect(await screen.findByText("Đã có 1 yêu cầu chỉnh công chờ duyệt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem yêu cầu chỉnh công" }));
    const activeCorrectionButton = screen.getByRole("button", { name: /Chờ duyệt chỉnh công/i });
    expect(activeCorrectionButton).toHaveClass("active");
    expect(screen.getByText("Lan Manager")).toBeInTheDocument();
  });
});
