import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmployeeDetail from "./EmployeeDetail";

vi.mock("lucide-react", () => {
  const Icon = (props) => <svg aria-hidden="true" {...props} />;
  return {
    User: Icon,
    Phone: Icon,
    Mail: Icon,
    MapPin: Icon,
    Briefcase: Icon,
    CalendarDays: Icon,
    DollarSign: Icon,
    Clock: Icon,
    Trash2: Icon,
    Edit: Icon,
    History: Icon,
    ShieldCheck: Icon,
    Camera: Icon,
    Umbrella: Icon,
    CircleCheck: Icon,
    LogOut: Icon,
    Lock: Icon,
    Unlock: Icon,
  };
});

vi.mock("../StaffAvatarMedia", () => ({
  default: ({ name }) => <span aria-label={`Ảnh ${name}`}>{name?.slice(0, 1)}</span>,
}));

const employee = {
  id: "staff-1",
  name: "Phương Anh",
  code: "NV0001",
  role: "Nhân viên phục vụ",
  roleName: "Staff",
  positionTitle: "Nhân viên phục vụ",
  department: "service",
  phone: "0909000000",
  email: "phuonganh@cohan.local",
  address: "Biên Hòa",
  startDate: "10/07/2026",
  shift: "Ca xoay",
  employmentStatus: "WORKING",
  accountStatus: "active",
  emailVerified: true,
  phoneVerified: false,
  canResendVerification: true,
  raw: { baseSalary: 7000000 },
};

describe("EmployeeDetail", () => {
  it("groups contact, work, and account information into compact tabs", () => {
    render(<EmployeeDetail employee={employee} onResendVerification={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Liên hệ" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("0909000000")).toBeInTheDocument();
    expect(screen.queryByText("Lương cơ bản")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Công việc" }));
    expect(screen.getByText("Lương cơ bản")).toBeInTheDocument();
    expect(screen.getByText("7.000.000 đ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Tài khoản" }));
    expect(screen.getByText("Trạng thái & xác minh tài khoản")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi lại xác minh" })).toBeEnabled();
  });

  it("returns to contact details when another employee is selected", () => {
    const { rerender } = render(<EmployeeDetail employee={employee} />);
    fireEvent.click(screen.getByRole("tab", { name: "Công việc" }));

    rerender(<EmployeeDetail employee={{ ...employee, id: "staff-2", name: "Minh" }} />);

    expect(screen.getByRole("tab", { name: "Liên hệ" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("0909000000")).toBeInTheDocument();
  });

  it("moves between tabs with arrow keys", () => {
    render(<EmployeeDetail employee={employee} />);

    const contactTab = screen.getByRole("tab", { name: "Liên hệ" });
    contactTab.focus();
    fireEvent.keyDown(contactTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Công việc" })).toHaveFocus();
    expect(screen.getByText("Lương cơ bản")).toBeInTheDocument();
  });
});
