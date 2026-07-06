import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";
import ManagerOvertimeRequestCreate from "./ManagerOvertimeRequestCreate";

vi.mock("@/hooks/useAttendanceManagement");
vi.mock("@/hooks/useOvertimeManagement");

const createOvertimeRequest = vi.fn();
const restaurantId = "64f000000000000000000001";
const employeeId = "64f000000000000000000002";
const record = {
  id: "64f000000000000000000003",
  employeeId,
  employeeName: "Demo Kitchen Helper",
  employeeCode: "PERF-KH-01",
  workDate: "2026-07-06T00:00:00.000+07:00",
  shiftId: "64f000000000000000000004",
  plannedStartTime: "2026-07-06T05:00:00.000Z",
  plannedEndTime: "2026-07-06T13:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAttendanceManagement.mockReturnValue({ records: [record] });
  useOvertimeManagement.mockReturnValue({
    createOvertimeRequest,
    createState: { loading: false },
  });
});

describe("ManagerOvertimeRequestCreate", () => {
  it("allows manager to create an employee-confirmed overtime request", async () => {
    createOvertimeRequest.mockResolvedValue({
      data: { createOvertimeRequest: { id: "ot-1" } },
    });
    render(
      <ManagerOvertimeRequestCreate
        user={{ roleName: "manager", restaurantId }}
        selectedDate="2026-07-06"
        restaurantId={restaurantId}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu tăng ca" }));
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Hỗ trợ dọn ca cuối ngày" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi cho nhân viên xác nhận" }),
    );

    await waitFor(() => expect(createOvertimeRequest).toHaveBeenCalled());
    expect(createOvertimeRequest).toHaveBeenCalledWith({
      employeeId,
      restaurantId,
      workDate: record.workDate,
      shiftId: record.shiftId,
      timesheetId: record.id,
      plannedStartTime: "2026-07-06T20:00:00.000+07:00",
      plannedEndTime: "2026-07-06T21:00:00.000+07:00",
      overtimeType: "weekday",
      reason: "Hỗ trợ dọn ca cuối ngày",
      employeeConfirmationRequired: true,
    });
    expect(
      await screen.findByText("Đã tạo đề nghị tăng ca. Đang chờ nhân viên xác nhận."),
    ).toBeInTheDocument();
  });

  it.each(["admin", "hr"])("shows create action for %s", (roleName) => {
    render(
      <ManagerOvertimeRequestCreate
        user={{ roleName, restaurantId }}
        selectedDate="2026-07-06"
        restaurantId={restaurantId}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Tạo yêu cầu tăng ca" }),
    ).toBeInTheDocument();
  });

  it("keeps accountant read-only", () => {
    render(
      <ManagerOvertimeRequestCreate
        user={{ roleName: "accountant", restaurantId }}
        selectedDate="2026-07-06"
        restaurantId={restaurantId}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Tạo yêu cầu tăng ca" }),
    ).not.toBeInTheDocument();
  });
});
