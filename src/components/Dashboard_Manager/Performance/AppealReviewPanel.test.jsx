import { render, screen } from "@testing-library/react";
import { beforeEach, test, vi } from "vitest";
import AppealReviewPanel from "./AppealReviewPanel";

const mocks = vi.hoisted(() => ({
  appeals: [],
  review: vi.fn(),
  reverseScore: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/hooks/usePerformanceIncidentAppeals", () => ({
  usePerformanceIncidentAppeals: vi.fn(() => ({
    data: { performanceIncidentAppeals: mocks.appeals },
    refetch: mocks.refetch,
  })),
  useReviewPerformanceIncidentAppeal: vi.fn(() => [mocks.review]),
  useReverseScoreForAcceptedAppeal: vi.fn(() => [mocks.reverseScore]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appeals = [];
});

test("shows review actions only while an appeal is reviewable", () => {
  mocks.appeals = [
    {
      id: "a1",
      employeeId: "e1",
      incidentId: "i1",
      reason: "Cần xem lại",
      status: "submitted",
      scoreReversalStatus: "not_required",
    },
  ];

  render(<AppealReviewPanel restaurantId="r1" canReview />);

  expect(screen.getByRole("button", { name: "under_review" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "needs_more_info" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "accepted" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "rejected" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Hoàn điểm" })).not.toBeInTheDocument();
});

test("keeps accepted appeals terminal while allowing score reversal", () => {
  mocks.appeals = [
    {
      id: "a1",
      employeeId: "e1",
      incidentId: "i1",
      reason: "Đã xác minh",
      status: "accepted",
      scoreReversalStatus: "pending",
    },
  ];

  render(<AppealReviewPanel restaurantId="r1" canReview isAccountant={false} />);

  expect(screen.getByRole("button", { name: "Hoàn điểm" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "under_review" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "needs_more_info" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "rejected" })).not.toBeInTheDocument();
});

test("accountant does not see reversal action", () => {
  mocks.appeals = [
    {
      id: "a1",
      employeeId: "e1",
      incidentId: "i1",
      reason: "Đã xác minh",
      status: "accepted",
      scoreReversalStatus: "pending",
    },
  ];

  render(<AppealReviewPanel restaurantId="r1" canReview isAccountant />);

  expect(screen.queryByRole("button", { name: "Hoàn điểm" })).not.toBeInTheDocument();
});
