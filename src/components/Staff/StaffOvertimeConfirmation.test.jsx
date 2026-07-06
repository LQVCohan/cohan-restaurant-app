import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";
import StaffOvertimeConfirmation from "./StaffOvertimeConfirmation";

vi.mock("@/hooks/useOvertimeManagement");

const employeeId = "64f000000000000000000002";
const restaurantId = "64f000000000000000000001";
const confirmOvertimeRequest = vi.fn();
const request = {
  id: "ot-confirm-1",
  employeeId,
  restaurantId,
  status: "pending_employee_confirmation",
  plannedStartTime: "2026-07-06T13:00:00.000Z",
  plannedEndTime: "2026-07-06T13:30:00.000Z",
  reason: "Hỗ trợ đóng ca",
};

const renderFor = (user, overtimeRequests = [request]) => {
  useOvertimeManagement.mockReturnValue({
    overtimeRequests,
    loading: false,
    error: null,
    confirmOvertimeRequest,
    confirmState: { loading: false },
  });
  return render(
    <AuthContext.Provider value={{ user }}>
      <StaffOvertimeConfirmation />
    </AuthContext.Provider>,
  );
};

describe("StaffOvertimeConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the target operational staff account confirm", async () => {
    confirmOvertimeRequest.mockResolvedValue({ data: {} });
    renderFor({
      id: employeeId,
      roleName: "kitchen_helper",
      userType: "STAFF",
      restaurantForStaff: restaurantId,
    });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tăng ca" }));

    await waitFor(() =>
      expect(confirmOvertimeRequest).toHaveBeenCalledWith("ot-confirm-1"),
    );
    expect(
      await screen.findByText(
        "Đã xác nhận đề nghị tăng ca. Yêu cầu đang chờ quản lý duyệt.",
      ),
    ).toBeInTheDocument();
  });

  it("does not show another employee request", () => {
    renderFor(
      {
        id: employeeId,
        roleName: "cashier",
        userType: "STAFF",
        restaurantForStaff: restaurantId,
      },
      [{ ...request, employeeId: "64f000000000000000000099" }],
    );

    expect(
      screen.queryByRole("button", { name: "Xác nhận tăng ca" }),
    ).not.toBeInTheDocument();
  });

  it.each(["manager", "hr", "accountant"])(
    "does not render employee confirmation for %s",
    (roleName) => {
      renderFor({
        id: "64f000000000000000000010",
        roleName,
        userType: roleName.toUpperCase(),
        restaurantForStaff: restaurantId,
      });
      expect(
        screen.queryByRole("button", { name: "Xác nhận tăng ca" }),
      ).not.toBeInTheDocument();
    },
  );
});
