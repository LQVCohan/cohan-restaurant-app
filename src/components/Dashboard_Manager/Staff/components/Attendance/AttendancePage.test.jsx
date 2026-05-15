import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttendancePage, { getAttendanceActionErrorMessage } from "./AttendancePage";

vi.mock("@/context/AuthContext", () => ({
  AuthContext: React.createContext({ user: { restaurantForStaff: "r1" } }),
}));


vi.mock("./OvertimePanel", () => ({
  default: () => <div>Overtime Panel</div>,
}));

vi.mock("@/hooks/useAttendanceManagement", () => ({
  default: () => ({
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
  }),
  toAttendanceIsoStartOfDay: vi.fn(),
}));

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
});
