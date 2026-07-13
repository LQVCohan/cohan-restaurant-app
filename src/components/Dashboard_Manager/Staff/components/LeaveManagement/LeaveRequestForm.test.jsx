import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import LeaveRequestForm from "./LeaveRequestForm";

const staffList = [
  {
    id: "staff-1",
    fullName: "Hoang Nguyen",
    employeeCode: "NV001",
    positionTitle: "Server",
    roleName: "Staff",
    department: "service",
    restaurantId: "restaurant-1",
  },
  {
    id: "staff-2",
    fullName: "Lan Manager",
    employeeCode: "NV002",
    positionTitle: "Restaurant Manager",
    roleName: "Manager",
    department: "management",
    restaurantId: "restaurant-1",
  },
  {
    id: "staff-3",
    fullName: "Minh Assistant",
    employeeCode: "NV003",
    positionTitle: "Assistant Manager",
    roleName: "Supervisor",
    department: "operations",
    restaurantId: "restaurant-1",
  },
];

const fillBaseLeaveFields = (container) => {
  fireEvent.click(container.querySelector('input[name="leaveType"][value="ANNUAL"]'));
  fireEvent.change(container.querySelector('input[name="startDate"]'), {
    target: { value: "2026-04-24" },
  });
  fireEvent.change(container.querySelector('input[name="endDate"]'), {
    target: { value: "2026-04-25" },
  });
  fireEvent.change(container.querySelector('textarea[name="reason"]'), {
    target: { value: "Need planned leave" },
  });
};

describe("LeaveRequestForm", () => {
  let alertSpy;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("filters employees by name and employee code", () => {
    render(<LeaveRequestForm onSubmit={vi.fn()} staffList={staffList} />);

    const searchInput = screen.getByTestId("leave-employee-search");

    fireEvent.change(searchInput, { target: { value: "Lan" } });
    expect(screen.getByRole("option", { name: /\[NV002\] Lan Manager/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /\[NV001\] Hoang Nguyen/i })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "NV003" } });
    expect(screen.getByRole("option", { name: /\[NV003\] Minh Assistant/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /\[NV002\] Lan Manager/i })).not.toBeInTheDocument();
  });

  it("uses a concise native leave-type selector in the compact manager modal", () => {
    const { container } = render(
      <LeaveRequestForm onSubmit={vi.fn()} staffList={staffList} compact />,
    );

    expect(screen.getByRole("combobox", { name: "Loại nghỉ *" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nghỉ bệnh" })).toBeInTheDocument();
    expect(container.querySelector(".leave-types-grid")).not.toBeInTheDocument();
  });

  it("does not show replacement manager selection for manager leave requests", () => {
    render(<LeaveRequestForm onSubmit={vi.fn()} staffList={staffList} />);

    fireEvent.change(screen.getByTestId("leave-employee-select"), {
      target: { value: "staff-2" },
    });

    expect(screen.queryByTestId("leave-replacement-select")).not.toBeInTheDocument();
    expect(screen.queryByText(/Quản lý thay thế/i)).not.toBeInTheDocument();
  });

  it("submits non-manager leave requests without replacementManagerId", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LeaveRequestForm onSubmit={onSubmit} staffList={staffList} />);

    fireEvent.change(screen.getByTestId("leave-employee-select"), {
      target: { value: "staff-1" },
    });
    fillBaseLeaveFields(container);
    fireEvent.click(screen.getByRole("button", { name: /Gửi Đơn/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      employeeId: "staff-1",
      restaurantId: "restaurant-1",
      leaveType: "ANNUAL",
      startDate: "2026-04-24",
      endDate: "2026-04-25",
      reason: "Need planned leave",
    });
    expect(payload).not.toHaveProperty("replacementManagerId");
  });

  it("submits manager leave requests without replacementManagerId", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LeaveRequestForm onSubmit={onSubmit} staffList={staffList} />);

    fireEvent.change(screen.getByTestId("leave-employee-select"), {
      target: { value: "staff-2" },
    });
    fillBaseLeaveFields(container);
    fireEvent.click(screen.getByRole("button", { name: /Gửi Đơn/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      employeeId: "staff-2",
      restaurantId: "restaurant-1",
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("replacementManagerId");
  });

  it("guides self-service staff through three steps and preserves previous values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <LeaveRequestForm
        onSubmit={onSubmit}
        staffList={[staffList[0]]}
        restaurantId="restaurant-1"
        selfServiceEmployeeId="staff-1"
        stepByStep
        submitLabel="Gửi đơn"
      />,
    );

    expect(screen.getByRole("heading", { name: "Chọn loại nghỉ phù hợp" })).toBeInTheDocument();
    expect(screen.queryByTestId("leave-employee-select")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="startDate"]')).not.toBeInTheDocument();

    fireEvent.click(container.querySelector('input[name="leaveType"][value="ANNUAL"]'));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục đến bước 2" }));

    const startDate = container.querySelector('input[name="startDate"]');
    const endDate = container.querySelector('input[name="endDate"]');
    fireEvent.change(startDate, { target: { value: "2026-04-24" } });
    fireEvent.change(endDate, { target: { value: "2026-04-25" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục đến bước 3" }));

    expect(screen.getByText("Nghỉ năm")).toBeInTheDocument();
    expect(screen.getByText("24/04/2026 – 25/04/2026")).toBeInTheDocument();
    expect(screen.getByText("2 ngày")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(container.querySelector('input[name="startDate"]')).toHaveValue("2026-04-24");
    expect(container.querySelector('input[name="endDate"]')).toHaveValue("2026-04-25");
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục đến bước 3" }));

    fireEvent.change(container.querySelector('textarea[name="reason"]'), {
      target: { value: "Need planned leave" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi đơn" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      employeeId: "staff-1",
      restaurantId: "restaurant-1",
      leaveType: "ANNUAL",
      startDate: "2026-04-24",
      endDate: "2026-04-25",
      startSession: "FULL",
      endSession: "FULL",
      reason: "Need planned leave",
    });
  });
});
