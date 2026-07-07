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
    expect(screen.getAllByText("Ca sáng").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/06:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14:00/).length).toBeGreaterThan(0);
  });

  it("part-time approved slot shows Có thể làm", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "approved", slots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.getAllByTitle("Có thể làm").length).toBeGreaterThan(0);
  });

  it("pendingSlots alone never become usable", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "approved", slots: [], pendingSlots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.queryByTitle("Có thể làm")).not.toBeInTheDocument();
    expect(screen.getByText(/Pending: 1/i)).toBeInTheDocument();
  });

  it("late_change_requested uses official slots and shows warning", () => {
    renderModal({
      staffList: [{ id: "p1", fullName: "PT", employeeCode: "E1", employmentType: "part_time" }],
      availabilitySubmissions: [{ staffId: "p1", status: "late_change_requested", slots: [{ date: "2026-05-25", shiftType: "morning", status: "available" }] }],
    });
    expect(screen.getAllByTitle("Có thể làm").length).toBeGreaterThan(0);
    expect(screen.getByText(/Chờ duyệt thay đổi muộn/i)).toBeInTheDocument();
  });

  it("full-time workingDays MON shows available on Monday", () => {
    renderModal({ staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: ["MON"] }] });
    expect(screen.getAllByTitle("Theo workingDays").length).toBeGreaterThan(0);
  });

  it("full-time unavailable_exception marks Báo bận", () => {
    renderModal({
      staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: ["MON"] }],
      availabilitySubmissions: [{ staffId: "f1", submissionType: "unavailable_exception", status: "approved", slots: [{ date: "2026-05-25", shiftType: "morning", status: "unavailable" }] }],
    });
    expect(screen.getAllByTitle("Báo bận").length).toBeGreaterThan(0);
  });

  it("full-time missing workingDays shows Chưa rõ workingDays", () => {
    renderModal({ staffList: [{ id: "f1", fullName: "FT", employeeCode: "F1", employmentType: "full_time", workingDays: [] }] });
    expect(screen.getAllByTitle("Chưa rõ workingDays").length).toBeGreaterThan(0);
  });

  it("query error is displayed", () => {
    renderModal({ error: new Error("boom") });
    expect(screen.getByText(/Không thể tải lịch rảnh đã đăng ký: boom/i)).toBeInTheDocument();
  });

  it("renders only when open, no hook-order crash", () => {
    const { rerender } = render(<AvailabilitySnapshotModal isOpen={false} onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} availabilityWindows={windows} shiftTemplates={shifts} staffList={[]} availabilitySubmissions={[]} />);
    rerender(<AvailabilitySnapshotModal isOpen onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} availabilityWindows={windows} shiftTemplates={shifts} staffList={[]} availabilitySubmissions={[]} />);
    expect(screen.getByText("Lịch rảnh đã đăng ký")).toBeInTheDocument();
  });

  it("shows the staff matrix when no finalized availability window exists", () => {
    renderModal({
      availabilityWindows: [],
      staffList: [
        {
          id: "f1",
          fullName: "Nhân viên toàn thời gian",
          employeeCode: "FT01",
          employmentType: "full_time",
          workingDays: ["MON"],
        },
      ],
    });

    expect(screen.getByText("Tuần này chưa có kỳ đăng ký đã chốt.")).toBeInTheDocument();
    expect(screen.getByText("Nhân viên toàn thời gian")).toBeInTheDocument();
    expect(screen.getAllByTitle("Theo workingDays").length).toBeGreaterThan(0);
  });

  it("matches availability window by date key even with different periodEnd timestamp/timezone", () => {
    render(
      <AvailabilitySnapshotModal
        isOpen
        onClose={() => {}}
        weekStart={new Date("2026-05-25T00:00:00.000Z")}
        weekEnd={new Date("2026-05-31T12:34:56.000Z")}
        availabilityWindows={[
          {
            periodStart: "2026-05-25T00:00:00.000Z",
            periodEnd: "2026-05-31T23:59:59.999+07:00",
            status: "open",
          },
        ]}
        shiftTemplates={shifts}
        staffList={[]}
        availabilitySubmissions={[]}
      />,
    );

    expect(
      screen.queryByText("Tuần này chưa có kỳ đăng ký đã chốt."),
    ).not.toBeInTheDocument();
  });

  it("renders filter controls", () => {
    renderModal();
    expect(screen.getByPlaceholderText(/Tìm tên hoặc mã nhân viên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chỉ hiện nhân viên thiếu đăng ký/i)).toBeInTheDocument();
  });
});
