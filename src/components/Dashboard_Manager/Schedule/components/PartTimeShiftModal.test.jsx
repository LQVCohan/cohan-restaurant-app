import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PartTimeShiftModal from "./PartTimeShiftModal";

const staffList = [
  {
    id: "p1",
    name: "Lan Part-time",
    employeeCode: "PT001",
    positionTitle: "Thu ngân",
  },
  {
    id: "p2",
    name: "Minh Part-time",
    employeeCode: "PT002",
    positionTitle: "Phục vụ",
  },
];

describe("PartTimeShiftModal workspace", () => {
  it("keeps selected staff visible in the side panel and allows removal", () => {
    render(
      <PartTimeShiftModal
        isOpen
        date="2026-07-20"
        startTime="08:00"
        staffList={staffList}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Lan Part-time/i }));

    expect(screen.getByText(/1 đã chọn/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bỏ Lan Part-time khỏi ca/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Bỏ Lan Part-time khỏi ca/i }),
    );

    expect(screen.getByText(/0 đã chọn/i)).toBeInTheDocument();
  });

  it("submits selected staff and duration through the unchanged contract", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PartTimeShiftModal
        isOpen
        date="2026-07-20"
        startTime="08:00"
        defaultDurationHours={4}
        staffList={staffList}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Minh Part-time/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo block ca" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-07-20",
        startTime: "08:00",
        durationHours: 4,
        staffIds: ["p2"],
      }),
    );
  });
});
