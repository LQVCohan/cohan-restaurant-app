import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffPerformancePolicyPage from "./StaffPerformancePolicyPage";
import useStaffPerformancePolicy from "@/hooks/useStaffPerformancePolicy";

const formatterMocks = vi.hoisted(() => ({
  resetPerformanceLevelThresholds: vi.fn(),
  setPerformanceLevelThresholds: vi.fn(),
}));

vi.mock("@/hooks/useStaffPerformancePolicy", () => ({
  default: vi.fn(),
}));
vi.mock("@/utils/staffPerformanceGlobalFormat", () => formatterMocks);
vi.mock("./StaffPerformancePage", () => ({
  default: () => <div data-testid="performance-page">Performance table</div>,
  resolveEffectivePerformanceRestaurantId: (value) => {
    if (!value || String(value).toLowerCase() === "all") return null;
    return String(value);
  },
}));

const policy = {
  restaurantId: "restaurant-1",
  weights: {
    productivity: 25,
    punctuality: 25,
    quality: 20,
    managerReview: 20,
    compliance: 10,
  },
  levelThresholds: {
    excellentMin: 90,
    goodMin: 80,
    averageMin: 65,
    needsAttentionMin: 50,
  },
  editableFields: [
    "excellentMin",
    "goodMin",
    "averageMin",
    "needsAttentionMin",
  ],
  lockedFields: [
    "Trọng số 25/25/20/20/10",
    "Công thức năng suất theo thời lượng ca",
  ],
};

const renderPage = (overrides = {}) =>
  render(
    <StaffPerformancePolicyPage
      employees={[]}
      selectedRestaurant="restaurant-1"
      restaurantList={[{ id: "restaurant-1", name: "Cohan Central" }]}
      searchQuery=""
      {...overrides}
    />,
  );

describe("StaffPerformancePolicyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStaffPerformancePolicy.mockReturnValue({
      policy,
      loading: false,
      error: null,
      updatePolicy: vi.fn().mockResolvedValue({
        data: { updateStaffPerformancePolicy: policy },
      }),
      updateState: { loading: false, error: null },
    });
  });

  it("disables configuration until one restaurant is selected", () => {
    renderPage({ selectedRestaurant: "all" });

    expect(
      screen.getByRole("button", { name: "Cấu hình đánh giá" }),
    ).toBeDisabled();
    expect(useStaffPerformancePolicy).toHaveBeenCalledWith({
      restaurantId: null,
    });
  });

  it("opens a modal that separates editable thresholds from locked rules", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Cấu hình đánh giá" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Cấu hình đánh giá hiệu suất" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Được phép điều chỉnh")).toBeInTheDocument();
    expect(screen.getByText("Được bảo vệ, không thể sửa")).toBeInTheDocument();
    expect(screen.getByText("Trọng số 25/25/20/20/10")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /Xuất sắc từ/ }),
    ).toHaveValue(90);
  });

  it("blocks invalid threshold ordering in the modal", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Cấu hình đánh giá" }),
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Tốt từ/ }),
      { target: { value: "90" } },
    );

    expect(
      screen.getByText(
        "Các mốc phải giảm nghiêm ngặt: Xuất sắc > Tốt > Trung bình > Cần chú ý.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lưu mốc xếp loại" }),
    ).toBeDisabled();
  });

  it("saves only the four editable thresholds", async () => {
    const updatePolicy = vi.fn().mockResolvedValue({
      data: {
        updateStaffPerformancePolicy: {
          ...policy,
          levelThresholds: { ...policy.levelThresholds, excellentMin: 93 },
        },
      },
    });
    useStaffPerformancePolicy.mockReturnValue({
      policy,
      loading: false,
      error: null,
      updatePolicy,
      updateState: { loading: false, error: null },
    });
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Cấu hình đánh giá" }),
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Xuất sắc từ/ }),
      { target: { value: "93" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu mốc xếp loại" }),
    );

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith({
        variables: {
          input: {
            restaurantId: "restaurant-1",
            levelThresholds: {
              excellentMin: 93,
              goodMin: 80,
              averageMin: 65,
              needsAttentionMin: 50,
            },
          },
        },
      });
    });
    expect(
      await screen.findByText(/Đã lưu mốc xếp loại/),
    ).toBeInTheDocument();
    expect(formatterMocks.setPerformanceLevelThresholds).toHaveBeenCalledWith(
      expect.objectContaining({ excellentMin: 93 }),
    );
  });
});
