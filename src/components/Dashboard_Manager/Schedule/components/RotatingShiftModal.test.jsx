import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RotatingShiftModal from "./RotatingShiftModal";

const staffList = [
  {
    id: "r1",
    name: "An Xoay Ca",
    employeeCode: "RT001",
    positionTitle: "Phục vụ",
  },
  {
    id: "r2",
    name: "Bình Trùng Ca",
    employeeCode: "RT002",
    positionTitle: "Thu ngân",
  },
];

const existingShifts = [
  {
    id: "existing-1",
    employeeId: "r2",
    startTime: "2099-01-05T09:00:00+07:00",
    endTime: "2099-01-05T12:00:00+07:00",
  },
];

describe("RotatingShiftModal workspace", () => {
  it("keeps overlapping staff visible but disabled with an explicit reason", () => {
    render(
      <RotatingShiftModal
        isOpen
        date="2099-01-05"
        staffList={staffList}
        existingShifts={existingShifts}
        shiftTemplates={[
          {
            key: "day",
            label: "Ca ngày",
            startTime: "08:00",
            endTime: "16:00",
          },
        ]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const blockedButton = screen.getByRole("button", {
      name: /Không thể chọn Bình Trùng Ca/i,
    });
    expect(blockedButton).toBeDisabled();
    expect(blockedButton).toHaveTextContent("Đã có ca trùng khung giờ");
  });

  it("keeps selected staff in the side summary and submits the existing payload", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RotatingShiftModal
        isOpen
        date="2099-01-05"
        staffList={staffList}
        existingShifts={existingShifts}
        shiftTemplates={[
          {
            key: "day",
            label: "Ca ngày",
            startTime: "08:00",
            endTime: "16:00",
          },
        ]}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn An Xoay Ca/i }));

    expect(
      screen.getByRole("button", { name: /Bỏ An Xoay Ca khỏi ca/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo ca xoay" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2099-01-05",
        startTime: "08:00",
        endTime: "16:00",
        staffIds: ["r1"],
      }),
    );
  });
});
