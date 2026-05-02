import { render, screen } from "@testing-library/react";
import StaffIncidentsList from "./StaffIncidentsList";

test("renders labels and no action buttons", () => {
  render(<StaffIncidentsList incidents={[{ id: "1", eventType: "late", severity: "warning", responsibilityStatus: "staff_responsible", scoreImpactStatus: "pending", occurredAt: "2026-01-01T00:00:00.000Z" }]} />);
  expect(screen.getByText("Mức độ: Cảnh báo")).toBeInTheDocument();
  expect(screen.getByText(/Trách nhiệm: Nhân viên chịu trách nhiệm/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /review|waive|eligible|apply/i })).not.toBeInTheDocument();
});

test("renders empty state", () => {
  render(<StaffIncidentsList incidents={[]} />);
  expect(screen.getByText("Chưa có dữ liệu hiệu suất trong kỳ này.")).toBeInTheDocument();
});
