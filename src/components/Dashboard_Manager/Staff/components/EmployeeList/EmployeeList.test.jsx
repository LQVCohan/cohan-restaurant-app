import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmployeeList from "./EmployeeList";

const employees = [
  {
    id: "staff-1",
    name: "Nguyễn An",
    code: "NV001",
    role: "Bếp chính",
    roleId: "role-cook",
    roleSlug: "cook",
    department: "kitchen",
    status: "active",
    employmentStatus: "WORKING",
    accountStatus: "active",
    verificationStatus: "verified",
    email: "an@example.com",
    phone: "0901000001",
  },
  {
    id: "staff-2",
    name: "Trần Bình",
    code: "NV002",
    role: "Thu ngân",
    roleId: "role-cashier",
    roleSlug: "cashier",
    department: "cashier",
    status: "inactive",
    employmentStatus: "RESIGNED",
    accountStatus: "blocked",
    verificationStatus: "unverified",
    email: "binh@example.com",
    phone: "0901000002",
  },
];

const renderList = () => render(
  <EmployeeList
    employees={employees}
    selectedEmployee={null}
    onEmployeeSelect={vi.fn()}
    roleList={[
      { id: "role-cook", name: "cook", slug: "cook" },
      { id: "role-cashier", name: "cashier", slug: "cashier" },
    ]}
  />,
);

describe("EmployeeList UC15 filters", () => {
  it("renders staff and searches by employee code/email/phone/name", () => {
    renderList();

    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.getByText("Trần Bình")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tìm nhân viên/i), {
      target: { value: "NV001" },
    });

    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.queryByText("Trần Bình")).not.toBeInTheDocument();
  });

  it("filters by employment, role, account, and verification status", () => {
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Nghỉ việc" }));
    expect(screen.queryByText("Nguyễn An")).not.toBeInTheDocument();
    expect(screen.getByText("Trần Bình")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lọc theo vai trò"), {
      target: { value: "role-cashier" },
    });
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái tài khoản"), {
      target: { value: "blocked" },
    });
    fireEvent.change(screen.getByLabelText("Lọc theo xác minh"), {
      target: { value: "unverified" },
    });

    const list = screen.getByText("Danh sách nhân sự").closest(".employee-list-card");
    expect(within(list).getByText("Trần Bình")).toBeInTheDocument();
    expect(within(list).queryByText("Nguyễn An")).not.toBeInTheDocument();
  });
});
