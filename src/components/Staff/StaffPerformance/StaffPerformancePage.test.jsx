import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffLayout from "@/layouts/StaffLayout";
import StaffPerformancePage from "./StaffPerformancePage";

const mocks = vi.hoisted(() => ({
  viewState: {
    summary: null,
    timeline: [],
    adjustments: [],
    incidents: [],
    loading: false,
    error: null,
    missingIdentity: false,
    restaurantId: "r1",
  },
  createAppeal: vi.fn(),
  refetchAppeals: vi.fn(),
}));

vi.mock("@/components/Staff/NotificationBell", () => ({
  default: () => (
    <button type="button" aria-label="Thông báo nhân viên">
      Thông báo
    </button>
  ),
}));

vi.mock("@/hooks/useStaffPerformanceView", () => ({
  useStaffPerformanceView: vi.fn(() => mocks.viewState),
}));

vi.mock("@/hooks/usePerformanceIncidentAppeals", () => ({
  usePerformanceIncidentAppeals: vi.fn(() => ({
    data: { performanceIncidentAppeals: [] },
    refetch: mocks.refetchAppeals,
  })),
  useCreatePerformanceIncidentAppeal: vi.fn(() => [mocks.createAppeal]),
}));

const user = {
  id: "staff-1",
  fullName: "Nhân viên Test",
  roleSlug: "server",
  restaurantForStaff: "r1",
};

const setViewState = (overrides = {}) => {
  mocks.viewState = {
    summary: null,
    timeline: [],
    adjustments: [],
    incidents: [],
    loading: false,
    error: null,
    missingIdentity: false,
    restaurantId: "r1",
    ...overrides,
  };
};

const renderPerformance = () =>
  render(
    <MemoryRouter initialEntries={["/staff/performance"]}>
      <AuthContext.Provider value={{ user }}>
        <StaffLayout>
          <StaffPerformancePage />
        </StaffLayout>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("StaffPerformancePage", () => {
  beforeEach(() => {
    setViewState();
    mocks.createAppeal.mockReset();
    mocks.refetchAppeals.mockReset();
  });

  it("renders loading state", () => {
    setViewState({ loading: true });

    renderPerformance();

    expect(screen.getByText("Đang tải phản hồi hiệu suất của bạn...")).toBeInTheDocument();
  });

  it("renders missing identity state", () => {
    setViewState({ missingIdentity: true, restaurantId: "" });

    renderPerformance();

    expect(screen.getByRole("heading", { name: "Chưa xác định được hồ sơ nhân viên" })).toBeInTheDocument();
  });

  it("renders normal empty data state and appeal form", () => {
    const { container } = renderPerformance();

    expect(screen.getByRole("heading", { name: "Hiệu suất của tôi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gửi phản hồi" })).toBeInTheDocument();
    expect(screen.getByText("Chưa có thay đổi điểm trong kỳ này")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu hiệu suất trong kỳ này.")).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
