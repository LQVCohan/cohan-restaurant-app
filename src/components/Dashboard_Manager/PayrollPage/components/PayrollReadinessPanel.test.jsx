import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayrollReadinessPanel from "./PayrollReadinessPanel";

const blockingIssue = {
  code: "SCHEDULE_NOT_PUBLISHED",
  severity: "error",
  message: "Lịch làm việc của kỳ lương chưa được công bố.",
  employeeName: "Nguyễn A",
  employeeCode: "NV001",
  sourceType: "schedule",
  suggestedAction: "Công bố lịch làm việc trước khi chốt lương.",
  targetRoute: "schedule",
};

const warningIssue = {
  code: "SCHEDULE_ACK_PENDING",
  severity: "warning",
  message: "Còn nhân viên chưa xác nhận lịch làm việc.",
  sourceType: "schedule_acknowledgement",
  suggestedAction: "Nhắc nhân viên xác nhận lịch.",
  targetRoute: "schedule",
};

const emptySection = { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] };

const buildReadiness = (overrides = {}) => ({
  periodId: "period-1",
  restaurantId: "restaurant-1",
  status: "draft",
  readyToFinalize: false,
  blockingCount: 1,
  warningCount: 1,
  sections: {
    schedule: { status: "published", blockingCount: 1, warningCount: 1, metrics: {}, issues: [blockingIssue, warningIssue] },
    attendance: emptySection,
    approvals: emptySection,
    payroll: emptySection,
  },
  issues: [blockingIssue, warningIssue],
  ...overrides,
});

describe("PayrollReadinessPanel", () => {
  it("shows loading text", () => {
    render(<PayrollReadinessPanel loading />);
    expect(screen.getByText("Đang kiểm tra điều kiện chốt lương...")).toBeInTheDocument();
  });

  it("shows error state and calls refresh", () => {
    const onRefresh = vi.fn();
    render(<PayrollReadinessPanel error={new Error("boom")} onRefresh={onRefresh} />);

    expect(screen.getByText("Không thể tải kiểm tra trước khi chốt lương.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Thử lại"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows ready headline", () => {
    render(
      <PayrollReadinessPanel
        readiness={buildReadiness({ readyToFinalize: true, blockingCount: 0, warningCount: 0, issues: [], sections: { schedule: emptySection, attendance: emptySection, approvals: emptySection, payroll: emptySection } })}
      />,
    );
    expect(screen.getByText("Sẵn sàng chốt lương")).toBeInTheDocument();
  });

  it("shows blocked headline and all sections", () => {
    render(<PayrollReadinessPanel readiness={buildReadiness()} />);

    expect(screen.getByText("Chưa sẵn sàng chốt lương")).toBeInTheDocument();
    expect(screen.getByText("Lịch làm việc")).toBeInTheDocument();
    expect(screen.getByText("Chấm công")).toBeInTheDocument();
    expect(screen.getByText("Duyệt công / tăng ca")).toBeInTheDocument();
    expect(screen.getByText("Lương")).toBeInTheDocument();
  });

  it("renders issue details and suggested action", () => {
    render(<PayrollReadinessPanel readiness={buildReadiness()} />);

    expect(screen.getByText(blockingIssue.message)).toBeInTheDocument();
    expect(screen.getByText(blockingIssue.suggestedAction)).toBeInTheDocument();
    expect(screen.getByText("Nguyễn A")).toBeInTheDocument();
    expect(screen.getByText("NV001")).toBeInTheDocument();
  });

  it("calls onGoToIssue when clicking issue action", () => {
    const onGoToIssue = vi.fn();
    render(<PayrollReadinessPanel readiness={buildReadiness()} onGoToIssue={onGoToIssue} />);

    fireEvent.click(screen.getAllByText("Xem nơi cần xử lý")[0]);
    expect(onGoToIssue).toHaveBeenCalledWith(blockingIssue);
  });

  it("calls refresh from ready state", () => {
    const onRefresh = vi.fn();
    render(<PayrollReadinessPanel readiness={buildReadiness()} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByText("Làm mới"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
