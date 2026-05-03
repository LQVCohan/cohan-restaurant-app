import { render, screen } from "@testing-library/react";
import StaffPerformanceSummaryCards from "./StaffPerformanceSummaryCards";

test("renders score and status", () => {
  render(<StaffPerformanceSummaryCards summary={{ finalPerformanceScore: 92, totalScoreDelta: -5, pendingReviewIncidentCount: 1, appliedIncidentCount: 2, waivedIncidentCount: 1 }} />);
  expect(screen.getByText("Điểm hiện tại")).toBeInTheDocument();
  expect(screen.getByText("92")).toBeInTheDocument();
  expect(screen.getByText("Tốt")).toBeInTheDocument();
});
