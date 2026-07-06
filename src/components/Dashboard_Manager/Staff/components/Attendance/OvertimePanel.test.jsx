import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OvertimePanel, { getOvertimeActionErrorMessage } from "./OvertimePanel";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";

vi.mock("@/hooks/useAttendanceManagement");
vi.mock("@/hooks/useOvertimeManagement");

const createOvertimeRequest = vi.fn();
const approveOvertimeRequest = vi.fn();
const rejectOvertimeRequest = vi.fn();
const completeOvertimeRequest = vi.fn();

const employees = [
  {
    id: "64f000000000000000000010",
    fullName: "Nguyễn An",
    employeeCode: "NV001",
  },
];

const baseAttendanceHook = {
  employees,
  records: [],
  loading: false,
  error: null,
  refreshAttendanceViews: vi.fn(),
  approveAttendanceOvertime: vi.fn(),
  rejectAttendanceOvertime: vi.fn(),
  approveOvertimeState: { loading: false },
  rejectOvertimeState: { loading: false },
};

const baseOvertimeHook = {
  overtimeRequests: [],
  loading: false,
  error: null,
  createOvertimeRequest,
  approveOvertimeRequest,
  rejectOvertimeRequest,
  completeOvertimeRequest,
  createState: { loading: false },
  approveState: { loading: false },
  rejectState: { loading: false },
  completeState: { loading: false },
};

const manager = { roleName: "manager", restaurantId: "64f000000000000000000001" };
const accountant = { roleName: "accountant", restaurantId: "64f000000000000000000001" };

const pendingRequest = {
  id: "ot-request-1",
  employeeName: "Nguyễn An",
  employeeCode: "NV001",
  employeeRole: "Phục vụ",
  workDate: "2026-06-30T00:00:00.000Z",
  plannedStartTime: "2026-06-30T15:00:00.000Z",
  plannedEndTime: "2026-06-30T16:30:00.000Z",
  plannedOvertimeMinutes: 90,
  overtimeType: "weekday",
  reason: "Dọn kho cuối ca",
  status: "pending_approval",
  requestedAt: "2026-06-29T10:00:00.000Z",
};

const approvedRequest = {
  ...pendingRequest,
  id: "ot-request-2",
  status: "approved",
};

const renderPanel = ({ user = manager, overtimeRequests = [pendingRequest] } = {}) => {
  useAttendanceManagement.mockReturnValue(baseAttendanceHook);
  useOvertimeManagement.mockReturnValue({ ...baseOvertimeHook, overtimeRequests });
  return render(
    <OvertimePanel
      user={user}
      selectedDate="2026-06-30"
      searchQuery=""
      restaurantId="64f000000000000000000001"
    />,
  );
};

describe("OvertimePanel role-safe overtime workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["admin", "manager", "hr"])(
    "shows manager-created overtime form for %s",
    (roleName) => {
      renderPanel({ user: { ...manager, roleName } });
      expect(
        screen.getByRole("heading", { name: "Tạo yêu cầu tăng ca cho nhân viên" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Gửi nhân viên xác nhận" })).toBeInTheDocument();
    },
  );

  it("keeps accountant read-only", () => {
    renderPanel({ user: accountant });
    expect(
      screen.queryByRole("heading", { name: "Tạo yêu cầu tăng ca cho nhân viên" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("Duyệt yêu cầu tăng ca")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Từ chối yêu cầu tăng ca")).not.toBeInTheDocument();
  });

  it("creates a manager-assigned request that requires employee confirmation", async () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText("Nhân viên"), {
      target: { value: employees[0].id },
    });
    fireEvent.change(screen.getByLabelText("Bắt đầu tăng ca"), {
      target: { value: "22:00" },
    });
    fireEvent.change(screen.getByLabelText("Kết thúc tăng ca"), {
      target: { value: "23:00" },
    });
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Hỗ trợ đóng ca cuối ngày" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi nhân viên xác nhận" }));

    await waitFor(() => {
      expect(createOvertimeRequest).toHaveBeenCalledWith({
        employeeId: employees[0].id,
        restaurantId: "64f000000000000000000001",
        workDate: "2026-06-30T00:00:00.000+07:00",
        plannedStartTime: "2026-06-30T22:00:00.000+07:00",
        plannedEndTime: "2026-06-30T23:00:00.000+07:00",
        overtimeType: "weekday",
        reason: "Hỗ trợ đóng ca cuối ngày",
        employeeConfirmationRequired: true,
      });
    });
  });

  it("renders and approves a pending employee request", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Yêu cầu tăng ca" })).toBeInTheDocument();
    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.getByText("Dọn kho cuối ca")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Duyệt yêu cầu tăng ca"));

    expect(approveOvertimeRequest).toHaveBeenCalledWith({
      requestId: "ot-request-1",
      approvedOvertimeMinutes: 90,
      note: "Đã duyệt yêu cầu tăng ca.",
    });
  });

  it("rejects pending request with normalized payload", () => {
    renderPanel();
    fireEvent.click(screen.getByTitle("Từ chối yêu cầu tăng ca"));
    expect(rejectOvertimeRequest).toHaveBeenCalledWith({
      requestId: "ot-request-1",
      reason: "Quản lý từ chối yêu cầu tăng ca.",
    });
  });

  it("shows error feedback when rejecting request fails", async () => {
    rejectOvertimeRequest.mockRejectedValueOnce(new Error("Không thể từ chối"));
    renderPanel();
    fireEvent.click(screen.getByTitle("Từ chối yêu cầu tăng ca"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể xử lý yêu cầu tăng ca.",
    );
  });

  it("completes approved request", () => {
    renderPanel({ overtimeRequests: [approvedRequest] });
    fireEvent.click(screen.getByTitle("Hoàn tất yêu cầu tăng ca"));
    expect(completeOvertimeRequest).toHaveBeenCalledWith("ot-request-2");
  });
});

describe("getOvertimeActionErrorMessage", () => {
  it("returns permission message for FORBIDDEN", () => {
    const error = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "❌ Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("returns session message for UNAUTHENTICATED", () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: "UNAUTHENTICATED" } }] },
      },
    };
    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  });

  it("returns already reviewed message", () => {
    const error = {
      graphQLErrors: [{ message: "ATTENDANCE_OVERTIME_ALREADY_REVIEWED" }],
    };
    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Bản ghi tăng ca này đã được review trước đó. Vui lòng tải lại danh sách.",
    );
  });

  it("returns payroll lock message", () => {
    const error = new Error("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");
    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Kỳ lương đã chốt/khóa/thanh toán, không thể thay đổi tăng ca.",
    );
  });
});
