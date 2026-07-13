import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("lucide-react", async (importOriginal) => {
  const icons = await importOriginal();
  return {
    ...icons,
    MessageSquareText: ({ size = 24, className = "", ...props }) => (
      <svg
        {...props}
        width={size}
        height={size}
        className={`lucide lucide-message-square-text ${className}`.trim()}
      />
    ),
  };
});

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

    expect(
      screen.getByText("Đang tải phản hồi hiệu suất của bạn..."),
    ).toBeInTheDocument();
  });

  it("renders missing identity state", () => {
    setViewState({ missingIdentity: true, restaurantId: "" });

    renderPerformance();

    expect(
      screen.getByRole("heading", {
        name: "Chưa xác định được hồ sơ nhân viên",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the empty page compact without duplicated heading or unusable form", () => {
    const { container } = renderPerformance();

    expect(
      screen.getByRole("heading", { name: "Hiệu suất cá nhân" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Hiệu suất của tôi" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gửi phản hồi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Chưa có thay đổi điểm trong kỳ này"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chưa có dữ liệu hiệu suất trong kỳ này."),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });

  it("opens secondary history and appeal content only when requested", () => {
    setViewState({
      adjustments: [
        {
          id: "adjustment-1",
          reason: "Điều chỉnh phục vụ",
          scoreDelta: -2,
          previousScore: 82,
          newScore: 80,
          note: "Đã xác nhận",
          appliedAt: "2026-07-10T08:00:00.000Z",
        },
      ],
      incidents: [
        {
          id: "incident-1",
          eventType: "SERVICE_QUALITY",
          severity: "warning",
          responsibilityStatus: "pending_review",
          scoreImpactStatus: "eligible",
          proposedScoreDelta: -2,
          scoreDelta: 0,
          occurredAt: "2026-07-10T08:00:00.000Z",
          note: "Cần bổ sung bối cảnh",
        },
      ],
    });

    renderPerformance();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Lịch sử điều chỉnh" }),
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Lịch sử điều chỉnh",
    );
    expect(screen.getByText("Điều chỉnh phục vụ")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Đóng lịch sử điều chỉnh" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Phản hồi sự kiện này" }),
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Gửi phản hồi");
    expect(screen.getByRole("combobox")).toHaveValue("incident-1");
  });
});
