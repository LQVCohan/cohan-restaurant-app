import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<AddShiftModal {...baseProps} staffList={[{ id: "p1", name: "Part-time A", employmentType: "part_time", workingDays: ["tue"], salary: 1000 }]} availabilitySubmissions={[{ employeeId: "p1", status: "approved", slots: [{ date: "2026-05-11T00:00:00.000Z", shiftType: "morning", status: "available" }], pendingSlots: [] }]} />);
    expect(screen.getByText("Part-time A")).toBeInTheDocument();
  });

  it("hides part-time with pending slots only", () => {
    render(<AddShiftModal {...baseProps} staffList={[{ id: "p1", name: "Part-time A", employmentType: "part_time", workingDays: ["mon"], salary: 1000 }]} availabilitySubmissions={[{ employeeId: "p1", status: "late_change_requested", slots: [], pendingSlots: [{ date: "2026-05-11T00:00:00.000Z", shiftType: "morning", status: "available" }] }]} />);
    expect(screen.queryByText("Part-time A")).not.toBeInTheDocument();
  });

  it("hides full-time outside workingDays", () => {
    render(<AddShiftModal {...baseProps} staffList={[{ id: "f1", name: "FT A", employmentType: "full_time", workingDays: ["tue"], salary: 1000 }]} />);
    expect(screen.queryByText("FT A")).not.toBeInTheDocument();
  });

  it("hides full-time with official unavailable exception", () => {
    render(<AddShiftModal {...baseProps} staffList={[{ id: "f1", name: "FT A", employmentType: "full_time", workingDays: ["mon"], salary: 1000 }]} availabilitySubmissions={[{ employeeId: "f1", status: "approved", slots: [{ date: "2026-05-11T00:00:00.000Z", shiftType: "morning", status: "unavailable" }] }]} />);
    expect(screen.queryByText("FT A")).not.toBeInTheDocument();
  });

  it("shows full-time in workingDays without unavailable exception", () => {
    render(<AddShiftModal {...baseProps} staffList={[{ id: "f1", name: "FT A", employmentType: "full_time", workingDays: ["mon"], salary: 1000 }]} />);
    expect(screen.getByText("FT A")).toBeInTheDocument();
  });
});
