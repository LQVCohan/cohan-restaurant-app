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

const getStaffButton = (name) =>
  screen.getByRole("button", { name: new RegExp(name, "i") });

const getRoleCard = (label) =>
  screen
    .getAllByText(label)
    .map((node) => node.closest(".job-checkbox"))
    .find(Boolean);

describe("AddShiftModal availability observability", () => {
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

    expect(getStaffButton("Part-time A")).toBeEnabled();
    expect(getStaffButton("Part-time A")).toHaveTextContent(
      "Đã đăng ký có thể làm",
    );
  });

  it("keeps part-time with pending slots visible but disabled with a reason", () => {
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

    const button = getStaffButton("Part-time A");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Không có lịch rảnh đã duyệt phù hợp");
  });

  it("keeps full-time outside workingDays visible but disabled", () => {
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

    const button = getStaffButton("FT A");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Ngoài ngày làm việc mặc định");
  });

  it("keeps full-time with official unavailable exception visible but disabled", () => {
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

    const button = getStaffButton("FT A");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Đã báo không khả dụng cho ca này");
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

    expect(getStaffButton("FT A")).toBeEnabled();
  });

  it("filters blocked employees without hiding their explanation", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={[
          {
            id: "blocked",
            name: "Blocked Staff",
            employmentType: "full_time",
            workingDays: ["tue"],
          },
          {
            id: "ready",
            name: "Ready Staff",
            employmentType: "full_time",
            workingDays: ["mon"],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Không thể chọn \(1\)/i }),
    );

    expect(screen.getByText("Blocked Staff")).toBeInTheDocument();
    expect(screen.queryByText("Ready Staff")).not.toBeInTheDocument();
    expect(getStaffButton("Blocked Staff")).toHaveTextContent(
      "Ngoài ngày làm việc mặc định",
    );
  });
});

describe("AddShiftModal selected staff workspace", () => {
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

  it("keeps selected employees visible in the side summary and allows removal", () => {
    render(<AddShiftModal {...baseProps} staffList={staffList.slice(0, 1)} />);

    fireEvent.click(getStaffButton("Cashier A"));
    const selectedPanel = screen
      .getByRole("region", { name: "Nhân viên đã chọn" });
    expect(selectedPanel).toHaveTextContent("Cashier A");
    expect(screen.getByText(/1 nhân viên đã chọn/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Bỏ Cashier A khỏi ca/i }),
    );

    expect(selectedPanel).not.toHaveTextContent("Cashier A");
    expect(screen.getByText(/0 nhân viên đã chọn/i)).toBeInTheDocument();
  });

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

    const serverRoleCard = getRoleCard("Nhân viên phục vụ");
    const cashierRoleCard = getRoleCard("Thu ngân");

    expect(serverRoleCard).toHaveClass("checked", "locked");
    expect(cashierRoleCard).toHaveClass("checked", "locked");
    expect(serverRoleCard).toBeDisabled();
    expect(cashierRoleCard).toBeDisabled();
    expect(serverRoleCard).toHaveAttribute(
      "title",
      expect.stringContaining("không thể bỏ chọn"),
    );

    fireEvent.click(getRoleCard("Bếp trưởng"));
    expect(getRoleCard("Bếp trưởng")).toHaveClass("checked");

    fireEvent.click(getStaffButton("Cashier A"));
    fireEvent.click(getStaffButton("Server A"));
    fireEvent.click(getStaffButton("Chef A"));

    expect(screen.getByText(/3 nhân viên đã chọn/i)).toBeInTheDocument();
    expect(
      screen.getAllByText("Đã đủ nhân viên cho các vị trí bắt buộc.").length,
    ).toBeGreaterThan(0);

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

    expect(getStaffButton("Cashier A")).toHaveTextContent(
      "Khớp vị trí bắt buộc",
    );
    expect(getStaffButton("Server A")).toHaveTextContent(
      "Không khớp vị trí bắt buộc",
    );
  });

  it("renders policy mandatory roles once in the editor and avoids duplicate role labels", () => {
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
    expect(getStaffButton("Cashier A")).not.toHaveTextContent(
      "Thu ngân · Thu ngân",
    );
    expect(
      screen.getByText(/Vị trí từ chính sách đã được khóa/),
    ).toBeInTheDocument();
  });

  it("shows missing required roles before submit", () => {
    render(
      <AddShiftModal
        {...baseProps}
        staffList={staffList.slice(0, 1)}
        mandatoryShiftRoles={["cashier", "server"]}
      />,
    );

    fireEvent.click(getStaffButton("Cashier A"));

    expect(screen.getAllByText(/Còn thiếu: Nhân viên phục vụ/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Tạo ca làm việc" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ca làm còn thiếu vị trí bắt buộc",
    );
  });
});
