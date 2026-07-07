import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ShiftDetailModal from "./ShiftDetailModal";

describe("ShiftDetailModal staffing coverage", () => {
  it("does not count an unresolved assignment as staffed", () => {
    render(
      <ShiftDetailModal
        isOpen
        onClose={vi.fn()}
        readOnly
        staffList={[]}
        shift={{
          id: "2026-07-08|morning",
          date: "2026-07-08",
          shiftType: "morning",
          startTime: "07:00",
          endTime: "15:00",
          essentialJobs: [],
          staffIds: ["deleted-or-out-of-scope-staff"],
          notes: "",
        }}
      />,
    );

    expect(screen.getByText("Thiếu 1 người")).toBeInTheDocument();
    expect(screen.getByText("0 nhân sự")).toBeInTheDocument();
    expect(screen.queryByText("Đủ nhân sự")).not.toBeInTheDocument();
    expect(
      screen.getByText(/1 phân công không còn hồ sơ nhân viên hợp lệ/i),
    ).toBeInTheDocument();
  });

  it("counts only resolved employees and reports a complete shift", () => {
    render(
      <ShiftDetailModal
        isOpen
        onClose={vi.fn()}
        readOnly
        staffList={[
          {
            id: "staff-1",
            name: "Nguyễn Văn A",
            job: "server",
            departmentLabel: "Phục vụ",
          },
        ]}
        shift={{
          id: "2026-07-08|morning",
          date: "2026-07-08",
          shiftType: "morning",
          startTime: "07:00",
          endTime: "15:00",
          essentialJobs: ["server"],
          staffIds: ["staff-1"],
          notes: "",
        }}
      />,
    );

    expect(screen.getByText("Đủ nhân sự")).toBeInTheDocument();
    expect(screen.getByText("1 nhân sự")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
  });
});
