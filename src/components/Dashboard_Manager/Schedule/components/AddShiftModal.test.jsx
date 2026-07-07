import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddShiftModal from "./AddShiftModal";

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  selectedDate: "2026-05-11",
  selectedShiftType: "morning",
  staffList: [],
  onConfirm: vi.fn(),
};

describe("AddShiftModal availability visibility", () => {
  it("shows part-time with approved official slot even if workingDays mismatch", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "p1",
            name: "Part-time A",
            employmentType: "part_time",
            workingDays: ["tue"],
            salary: 1000,
          },
        ]}
        availabilitySubmissions={[
          {
            employeeId: "p1",
            status: "approved",
            slots: [
              {
                date: "2026-05-11T00:00:00.000Z",
                shiftType: "morning",
                status: "available",
              },
            ],
            pendingSlots: [],
          },
        ]}
      />,
    );
    expect(screen.getByText("Part-time A")).toBeInTheDocument();
  });

  it("hides part-time with pending slots only", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "p1",
            name: "Part-time A",
            employmentType: "part_time",
            workingDays: ["mon"],
            salary: 1000,
          },
        ]}
        availabilitySubmissions={[
          {
            employeeId: "p1",
            status: "late_change_requested",
            slots: [],
            pendingSlots: [
              {
                date: "2026-05-11T00:00:00.000Z",
                shiftType: "morning",
                status: "available",
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText("Part-time A")).not.toBeInTheDocument();
  });

  it("hides full-time outside workingDays", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "f1",
            name: "FT A",
            employmentType: "full_time",
            workingDays: ["tue"],
            salary: 1000,
          },
        ]}
      />,
    );
    expect(screen.queryByText("FT A")).not.toBeInTheDocument();
  });

  it("hides full-time with official unavailable exception", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "f1",
            name: "FT A",
            employmentType: "full_time",
            workingDays: ["mon"],
            salary: 1000,
          },
        ]}
        availabilitySubmissions={[
          {
            employeeId: "f1",
            status: "approved",
            slots: [
              {
                date: "2026-05-11T00:00:00.000Z",
                shiftType: "morning",
                status: "unavailable",
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText("FT A")).not.toBeInTheDocument();
  });

  it("shows full-time in workingDays without unavailable exception", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "f1",
            name: "FT A",
            employmentType: "full_time",
            workingDays: ["mon"],
            salary: 1000,
          },
        ]}
      />,
    );
    expect(screen.getByText("FT A")).toBeInTheDocument();
  });
});

describe("AddShiftModal mandatoryShiftRoles sync", () => {
  const staffList = [
    {
      id: "s1",
      name: "Cashier A",
      employmentType: "full_time",
      workingDays: ["mon"],
      salary: 1000,
      positionTitle: "Thu ngân",
      departmentLabel: "Front",
    },
    {
      id: "s2",
      name: "Server A",
      employmentType: "full_time",
      workingDays: ["mon"],
      salary: 1000,
      positionTitle: "Nhân viên phục vụ",
      departmentLabel: "Front",
    },
    {
      id: "s3",
      name: "Chef A",
      employmentType: "full_time",
      workingDays: ["mon"],
      salary: 1000,
      positionTitle: "Bếp trưởng",
      departmentLabel: "Kitchen",
    },
  ];

  it("preselects and locks mandatory roles, while allowing additional selections", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <AddShiftModal
        {...baseProps}
        staffList={staffList}
        onConfirm={onConfirm}
        mandatoryShiftRoles={["server", "cashier"]}
      />,
    );

    const serverRoleCard = screen
      .getByText("Nhân viên phục vụ")
      .closest(".job-checkbox");
    const cashierRoleCard = screen
      .getByText("Thu ngân")
      .closest(".job-checkbox");

    expect(serverRoleCard).toHaveClass("checked", "locked");
    expect(cashierRoleCard).toHaveClass("checked", "locked");
    expect(serverRoleCard).toBeDisabled();
    expect(cashierRoleCard).toBeDisabled();
    expect(serverRoleCard).toHaveAttribute(
      "title",
      expect.stringContaining("không thể bỏ chọn"),
    );

    fireEvent.click(screen.getByText("Bếp trưởng"));
    expect(screen.getByText("Bếp trưởng").closest(".job-checkbox")).toHaveClass(
      "checked",
    );

    fireEvent.click(screen.getByRole("button", { name: /Cashier A/i }));
    fireEvent.click(screen.getByRole("button", { name: /Server A/i }));
    fireEvent.click(screen.getByRole("button", { name: /Chef A/i }));

    expect(screen.getByText(/3 nhân viên đã chọn/i)).toBeInTheDocument();
    expect(
      screen.getByText("Đã đủ nhân viên cho các vị trí bắt buộc."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo ca làm việc" }));

    expect(onConfirm).toHaveBeenCalled();
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.essentialJobs).toEqual(
      expect.arrayContaining(["server", "cashier", "chef"]),
    );
  });

  it("uses final roles for role matching labels", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={staffList.slice(0, 2)}
        mandatoryShiftRoles={["cashier"]}
      />,
    );
    expect(
      screen.getByText("Cashier A").closest(".staff-item"),
    ).toHaveTextContent("Khớp vị trí");
    expect(
      screen.getByText("Server A").closest(".staff-item"),
    ).toHaveTextContent("Không khớp vị trí bắt buộc");
  });

  it("renders policy mandatory roles once and avoids duplicate role labels", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "s1",
            name: "Cashier A",
            employmentType: "full_time",
            workingDays: ["mon"],
            salary: 1000,
            positionTitle: "Thu ngân",
            roleName: "Thu ngân",
            departmentLabel: "Front",
          },
        ]}
        mandatoryShiftRoles={["cashier", "cashier", "CASHIER"]}
      />,
    );

    const roleCards = screen
      .getAllByText("Thu ngân")
      .filter((node) => node.closest(".job-checkbox"));
    expect(roleCards).toHaveLength(1);
    expect(
      screen.getByText("Cashier A").closest(".staff-item"),
    ).not.toHaveTextContent("Thu ngân · Thu ngân");
    expect(screen.getByText(/Vị trí từ chính sách đã được khóa/)).toBeInTheDocument();
  });

  it("shows missing required roles before submit", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={staffList.slice(0, 1)}
        mandatoryShiftRoles={["cashier", "server"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cashier A/i }));

    expect(screen.getByText(/Còn thiếu: Nhân viên phục vụ/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ca làm việc" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ca làm còn thiếu vị trí bắt buộc",
    );
  });
});
