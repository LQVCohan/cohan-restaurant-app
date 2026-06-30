import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OvertimePanel, { getOvertimeActionErrorMessage } from "./OvertimePanel";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";

vi.mock("@/hooks/useAttendanceManagement");
vi.mock("@/hooks/useOvertimeManagement");

const approveOvertimeRequest = vi.fn();
const rejectOvertimeRequest = vi.fn();
const completeOvertimeRequest = vi.fn();

const baseAttendanceHook = {
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
  approveOvertimeRequest,
  rejectOvertimeRequest,
  completeOvertimeRequest,
  approveState: { loading: false },
  rejectState: { loading: false },
  completeState: { loading: false },
};

const user = { roleName: "manager", restaurantId: "64f000000000000000000001" };

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

const renderPanel = (overtimeRequests = [pendingRequest]) => {
  useAttendanceManagement.mockReturnValue(baseAttendanceHook);
  useOvertimeManagement.mockReturnValue({ ...baseOvertimeHook, overtimeRequests });
  return render(<OvertimePanel user={user} selectedDate="2026-06-30" searchQuery="" restaurantId="64f000000000000000000001" />);
};

describe("OvertimePanel staff overtime requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders staff overtime request section and pending request", () => {
    renderPanel();

    expect(screen.getByText("Yêu cầu tăng ca nhân viên gửi")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.getByText("Dọn kho cuối ca")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Chờ quản lý duyệt"))).toBeInTheDocument();
  });

  it("approves pending request with normalized payload", () => {
    renderPanel();

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

    expect(rejectOvertimeRequest).toHaveBeenCalledWith({
      requestId: "ot-request-1",
      reason: "Quản lý từ chối yêu cầu tăng ca.",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể xử lý yêu cầu tăng ca.");
  });

  it("completes approved request", () => {
    renderPanel([approvedRequest]);

    fireEvent.click(screen.getByTitle("Hoàn tất yêu cầu tăng ca"));

    expect(completeOvertimeRequest).toHaveBeenCalledWith("ot-request-2");
  });
});

describe("getOvertimeActionErrorMessage", () => {
  it("returns permission message for FORBIDDEN", () => {
    const error = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const fallback = "fallback";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(
      "❌ Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("returns session message for UNAUTHENTICATED", () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: "UNAUTHENTICATED" } }] },
      },
    };
    const fallback = "fallback";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(
      "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  });

  it("returns already reviewed message for overtime re-review attempts", () => {
    const error = {
      graphQLErrors: [{ message: "ATTENDANCE_OVERTIME_ALREADY_REVIEWED" }],
    };

    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Bản ghi tăng ca này đã được review trước đó. Vui lòng tải lại danh sách.",
    );
  });

  it("returns payroll lock message for locked payroll periods", () => {
    const error = new Error("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");

    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Kỳ lương đã chốt/khóa/thanh toán, không thể thay đổi tăng ca.",
    );
  });

  it("returns fallback for non-auth graphql errors", () => {
    const error = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    const fallback = "❌ Hành động thất bại";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(fallback);
  });
});
