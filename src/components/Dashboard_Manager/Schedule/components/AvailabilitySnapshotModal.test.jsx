import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvailabilitySnapshotModal from "./AvailabilitySnapshotModal";

const weekStart = new Date("2026-05-25T00:00:00.000Z"); // Monday
const weekEnd = new Date("2026-05-31T00:00:00.000Z");
const windows = [{ periodStart: weekStart.toISOString(), periodEnd: weekEnd.toISOString() }];
const shifts = [{ key: "morning", label: "Ca sáng", startTime: "06:00", endTime: "14:00" }];

const renderModal = (props = {}) => render(<AvailabilitySnapshotModal isOpen onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} availabilityWindows={windows} shiftTemplates={shifts} staffList={[]} availabilitySubmissions={[]} {...props} />);

describe("AvailabilitySnapshotModal", () => {
  it("uses shiftTemplates array key and renders shift header", () => {
    renderModal();
    expect(screen.getAllByText(/Ca sáng 06:00-14:00/i).length).toBeGreaterThan(0);
  });

  it("part-time approved slot shows Có thể làm", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "approved", slots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.getByText("Có thể làm")).toBeInTheDocument();
  });

  it("pendingSlots alone never become usable", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "approved", slots: [], pendingSlots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.queryByText("Có thể làm")).not.toBeInTheDocument();
    expect(screen.getByText(/pending: 1, not usable/i)).toBeInTheDocument();
  });

  it("late_change_requested uses official slots and shows warning", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "late_change_requested", slots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.getByText("Có thể làm")).toBeInTheDocument();
    expect(screen.getByText(/Có thay đổi muộn đang chờ duyệt/i)).toBeInTheDocument();
  });

  it("full-time workingDays MON shows available on Monday", () => {
    renderModal({ staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: ["MON"] }] });
    expect(screen.getByText("Theo workingDays")).toBeInTheDocument();
  });

  it("full-time unavailable_exception marks Báo bận", () => {
    renderModal({
      staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: ["MON"] }],
      availabilitySubmissions: [{ staffId: "f1", submissionType: "unavailable_exception", status: "approved", slots: [{ date: "2026-05-25", shiftType: "morning", status: "unavailable" }] }],
    });
    expect(screen.getByText("Báo bận")).toBeInTheDocument();
  });

  it("full-time missing workingDays shows Chưa rõ workingDays", () => {
    renderModal({ staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: [] }] });
    expect(screen.getAllByText("Chưa rõ workingDays").length).toBeGreaterThan(0);
  });

  it("query error is displayed", () => {
    renderModal({ error: new Error("boom") });
    expect(screen.getByText(/Không thể tải availability đã chốt: boom/i)).toBeInTheDocument();
  });

  it("renders only when open, no hook-order crash", () => {
    const { rerender } = render(<AvailabilitySnapshotModal isOpen={false} onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} availabilityWindows={windows} shiftTemplates={shifts} staffList={[]} availabilitySubmissions={[]} />);
    rerender(<AvailabilitySnapshotModal isOpen onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} availabilityWindows={windows} shiftTemplates={shifts} staffList={[]} availabilitySubmissions={[]} />);
    expect(screen.getByText("Availability đã chốt")).toBeInTheDocument();
  });

  it("renders filter controls", () => {
    renderModal();
    expect(screen.getByPlaceholderText(/Tìm tên\/mã NV/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chỉ thiếu availability/i)).toBeInTheDocument();
  });
});
