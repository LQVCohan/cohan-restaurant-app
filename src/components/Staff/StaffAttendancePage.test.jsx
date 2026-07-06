import React from "react";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffAttendancePage, {
  CANCEL_ATTENDANCE_CORRECTION,
  CANCEL_OVERTIME_REQUEST,
  CONFIRM_OVERTIME_REQUEST,
  CREATE_ATTENDANCE_CORRECTION,
  CREATE_OVERTIME_REQUEST,
  STAFF_ATTENDANCE_SELF_SERVICE,
} from "./StaffAttendancePage";

const user = {
  id: "emp-1",
  fullName: "Nhân viên Test",
  role: "staff",
  restaurantForStaff: { id: "rest-1", name: "Cơ sở 1" },
};

const records = [
  {
    id: "ts-1",
    employeeId: "emp-1",
    restaurantId: "rest-1",
    workDate: "2026-06-30T00:00:00.000+07:00",
    shiftId: "shift-1",
    shiftType: "Ca tối",
    plannedStartTime: "2026-06-30T17:00:00.000+07:00",
    plannedEndTime: "2026-06-30T22:00:00.000+07:00",
    actualCheckInAt: "2026-06-30T17:05:00.000+07:00",
    actualCheckOutAt: "2026-06-30T22:10:00.000+07:00",
    workedMinutes: 305,
    status: "completed",
    note: "",
  },
];

const corrections = [
  {
    id: "acr-1",
    employeeId: "emp-1",
    restaurantId: "rest-1",
    timesheetId: "ts-1",
    shiftId: "shift-1",
    workDate: "2026-06-30T00:00:00.000+07:00",
    correctionType: "missing_check_out",
    status: "pending",
    requestedCheckInAt: null,
    requestedCheckOutAt: "2026-06-30T22:30:00.000+07:00",
    reason: "Quên bấm ra",
    requestedAt: "2026-06-30T23:00:00.000+07:00",
    createdAt: "2026-06-30T23:00:00.000+07:00",
  },
];

const pendingOvertime = {
  id: "ot-1",
  employeeId: "emp-1",
  restaurantId: "rest-1",
  shiftId: "shift-1",
  timesheetId: "ts-1",
  workDate: "2026-06-30T00:00:00.000+07:00",
  plannedStartTime: "2026-06-30T22:00:00.000+07:00",
  plannedEndTime: "2026-06-30T23:00:00.000+07:00",
  plannedOvertimeMinutes: 60,
  overtimeType: "weekday",
  status: "pending_approval",
  reason: "Dọn ca cuối",
  requestedAt: "2026-06-30T21:30:00.000+07:00",
  createdAt: "2026-06-30T21:30:00.000+07:00",
};

const assignedOvertime = {
  ...pendingOvertime,
  id: "ot-assigned-1",
  status: "pending_employee_confirmation",
  reason: "Quản lý phân công hỗ trợ đóng ca",
};

const dateVariables = {
  restaurantId: "rest-1",
  employeeId: "emp-1",
  startDate: "2026-06-30T00:00:00.000+07:00",
  endDate: "2026-06-30T23:59:59.999+07:00",
};

const queryMock = (overtimeRequests = [pendingOvertime]) => ({
  request: { query: STAFF_ATTENDANCE_SELF_SERVICE, variables: dateVariables },
  result: {
    data: {
      staffAttendanceRecords: records,
      attendanceCorrectionRequests: corrections,
      overtimeRequests,
    },
  },
});

const renderPage = (mocks = [queryMock()]) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MockedProvider mocks={mocks} addTypename={false}>
        <StaffAttendancePage />
      </MockedProvider>
    </AuthContext.Provider>,
  );

describe("StaffAttendancePage", () => {
  it("renders attendance stats and request forms", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Ngày làm việc"), {
      target: { value: "2026-06-30" },
    });

    expect(await screen.findByText("Ca trong ngày")).toBeInTheDocument();
    expect(screen.getByText("Giờ đã ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("Chỉnh công chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("Tăng ca chờ duyệt")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gửi yêu cầu chỉnh công" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gửi yêu cầu tăng ca" }),
    ).toBeInTheDocument();
    expect(screen.getByText("5.08")).toBeInTheDocument();
  });

  it("submits attendance correction for the selected timesheet", async () => {
    const mutationResult = vi.fn(() => ({
      data: {
        createAttendanceCorrectionRequest: {
          id: "acr-2",
          status: "pending",
          workDate: records[0].workDate,
          correctionType: "wrong_check_out",
          requestedCheckInAt: null,
          requestedCheckOutAt: "2026-06-30T22:45:00.000+07:00",
          reason: "Sai giờ ra thực tế",
          requestedAt: "2026-06-30T23:10:00.000+07:00",
        },
      },
    }));

    renderPage([
      queryMock(),
      {
        request: {
          query: CREATE_ATTENDANCE_CORRECTION,
          variables: {
            input: {
              employeeId: "emp-1",
              restaurantId: "rest-1",
              workDate: records[0].workDate,
              shiftId: "shift-1",
              timesheetId: "ts-1",
              correctionType: "wrong_check_out",
              requestedCheckInAt: null,
              requestedCheckOutAt: "2026-06-30T22:45:00.000+07:00",
              reason: "Sai giờ ra thực tế",
            },
          },
        },
        result: mutationResult,
      },
      queryMock(),
    ]);

    fireEvent.change(screen.getByLabelText("Ngày làm việc"), {
      target: { value: "2026-06-30" },
    });
    await screen.findByText("Ca tối");
    fireEvent.change(screen.getByLabelText("Loại chỉnh công"), {
      target: { value: "wrong_check_out" },
    });
    fireEvent.change(screen.getByLabelText("Giờ ra đề xuất"), {
      target: { value: "22:45" },
    });
    fireEvent.change(screen.getAllByLabelText("Lý do")[0], {
      target: { value: "Sai giờ ra thực tế" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chỉnh công" }));

    await waitFor(() => expect(mutationResult).toHaveBeenCalled());
    expect(await screen.findByText("Đã gửi yêu cầu chỉnh công.")).toBeInTheDocument();
  });

  it("submits employee overtime and cancels pending requests", async () => {
    const overtimeResult = vi.fn(() => ({
      data: {
        createOvertimeRequest: {
          ...pendingOvertime,
          id: "ot-2",
          reason: "Dọn kho cuối ca",
        },
      },
    }));
    const cancelCorrectionResult = vi.fn(() => ({
      data: { cancelAttendanceCorrectionRequest: { id: "acr-1", status: "cancelled" } },
    }));
    const cancelOvertimeResult = vi.fn(() => ({
      data: { cancelOvertimeRequest: { id: "ot-1", status: "cancelled" } },
    }));

    renderPage([
      queryMock(),
      {
        request: {
          query: CREATE_OVERTIME_REQUEST,
          variables: {
            input: {
              employeeId: "emp-1",
              restaurantId: "rest-1",
              workDate: dateVariables.startDate,
              shiftId: "shift-1",
              timesheetId: "ts-1",
              plannedStartTime: "2026-06-30T22:15:00.000+07:00",
              plannedEndTime: "2026-06-30T23:15:00.000+07:00",
              overtimeType: "weekday",
              reason: "Dọn kho cuối ca",
            },
          },
        },
        result: overtimeResult,
      },
      queryMock(),
      {
        request: { query: CANCEL_ATTENDANCE_CORRECTION, variables: { id: "acr-1" } },
        result: cancelCorrectionResult,
      },
      queryMock(),
      {
        request: { query: CANCEL_OVERTIME_REQUEST, variables: { id: "ot-1" } },
        result: cancelOvertimeResult,
      },
      queryMock(),
    ]);

    fireEvent.change(screen.getByLabelText("Ngày làm việc"), {
      target: { value: "2026-06-30" },
    });
    await screen.findByText("Ca tối");
    fireEvent.change(screen.getByLabelText("Bắt đầu tăng ca"), {
      target: { value: "22:15" },
    });
    fireEvent.change(screen.getByLabelText("Kết thúc tăng ca"), {
      target: { value: "23:15" },
    });
    fireEvent.change(screen.getAllByLabelText("Lý do")[1], {
      target: { value: "Dọn kho cuối ca" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tăng ca" }));

    await waitFor(() => expect(overtimeResult).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "Hủy" })[0]);
    await waitFor(() => expect(cancelCorrectionResult).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "Hủy" })[1]);
    await waitFor(() => expect(cancelOvertimeResult).toHaveBeenCalled());
  });

  it("lets only the assigned staff confirm manager-created overtime", async () => {
    const confirmResult = vi.fn(() => ({
      data: {
        confirmOvertimeRequest: {
          id: assignedOvertime.id,
          status: "pending_approval",
        },
      },
    }));

    renderPage([
      queryMock([assignedOvertime]),
      {
        request: {
          query: CONFIRM_OVERTIME_REQUEST,
          variables: { id: assignedOvertime.id },
        },
        result: confirmResult,
      },
      queryMock([{ ...assignedOvertime, status: "pending_approval" }]),
    ]);

    fireEvent.change(screen.getByLabelText("Ngày làm việc"), {
      target: { value: "2026-06-30" },
    });
    expect(await screen.findByText("Quản lý phân công hỗ trợ đóng ca")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(confirmResult).toHaveBeenCalled());
    expect(
      await screen.findByText(
        "Đã xác nhận yêu cầu tăng ca. Yêu cầu đang chờ quản lý duyệt.",
      ),
    ).toBeInTheDocument();
  });
});
