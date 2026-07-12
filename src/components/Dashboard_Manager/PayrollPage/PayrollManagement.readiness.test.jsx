import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import PayrollManagement from "./PayrollManagement";
import usePayroll from "@/hooks/usePayroll";

vi.mock("@apollo/client", () => ({
  gql: (strings, ...values) => String.raw({ raw: strings }, ...values),
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/usePayroll", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    restaurantOptions: [{ id: "restaurant-1", name: "Cohan Restaurant" }],
    selectedRestaurantId: "restaurant-1",
    setSelectedRestaurantId: vi.fn(),
    selectedRestaurant: { id: "restaurant-1", name: "Cohan Restaurant" },
    restaurantsLoading: false,
    hasRestaurants: true,
  }),
}));

const emptyOverview = {
  staffPayrollOverview: {
    stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
    pageInfo: {
      totalCount: 0,
      limit: 8,
      offset: 0,
      page: 1,
      pageSize: 0,
      totalPages: 1,
      hasMore: false,
    },
    items: [],
  },
};

const buildHookValue = (overrides = {}) => ({
  periods: [
    {
      id: "period-1",
      name: "Kỳ hiện tại",
      restaurantId: "restaurant-1",
      startDate: "2026-05-25T00:00:00.000Z",
      endDate: "2026-06-24T23:59:59.999Z",
      status: "draft",
    },
  ],
  currentPeriodId: "period-1",
  periodDetail: {
    period: {
      id: "period-1",
      restaurantId: "restaurant-1",
      startDate: "2026-05-25T00:00:00.000Z",
      endDate: "2026-06-24T23:59:59.999Z",
      status: "draft",
    },
  },
  payrollItems: [],
  payrollStats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
  payrollReadiness: { readyToFinalize: false },
  loading: false,
  error: null,
  createPeriod: vi.fn().mockResolvedValue({ data: { createPayrollPeriod: { id: "period-2" } } }),
  recalculatePeriod: vi.fn().mockResolvedValue({}),
  finalizePeriod: vi.fn().mockResolvedValue({}),
  lockPeriod: vi.fn().mockResolvedValue({}),
  refetchPeriods: vi.fn().mockResolvedValue({}),
  refetchDetail: vi.fn().mockResolvedValue({}),
  refetchPayrollReadiness: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe("PayrollManagement readiness and data mode summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockReturnValue({
      data: emptyOverview,
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: emptyOverview }),
    });
  });

  it("shows readiness copy when payroll is not ready to finalize", () => {
    usePayroll.mockReturnValue(buildHookValue({ payrollReadiness: { readyToFinalize: false, blockingCount: 1, warningCount: 0, sections: { approvals: { blockingCount: 1, warningCount: 0, issues: [{ code: "UNAPPROVED_OVERTIME", message: "Còn tăng ca chưa duyệt" }] } } } }));

    render(<PayrollManagement />);

    expect(screen.getByText("Còn tăng ca chưa duyệt")).toBeInTheDocument();
    expect(screen.getByText("Kiểm tra dữ liệu trước khi chốt")).toBeInTheDocument();
  });

  it("shows ready-to-finalize copy from payrollReadiness", () => {
    usePayroll.mockReturnValue(buildHookValue({ payrollReadiness: { readyToFinalize: true } }));

    render(<PayrollManagement />);

    expect(screen.getByText("Kỳ lương sẵn sàng chốt")).toBeInTheDocument();
  });

  it("marks official payroll mode when backend returns period snapshot rows", () => {
    useQuery.mockReturnValue({
      data: {
        staffPayrollOverview: {
          ...emptyOverview.staffPayrollOverview,
          pageInfo: { ...emptyOverview.staffPayrollOverview.pageInfo, totalCount: 1, pageSize: 1 },
          items: [
            {
              id: "payroll-item-1",
              payrollItemId: "payroll-item-1",
              periodId: "period-1",
              name: "Nguyen A",
              code: "NV001",
              role: "Server",
              department: "Service",
              actualWorkDays: 0,
              workDays: 0,
              totalHours: 0,
              grossIncome: 0,
              totalIncome: 0,
              totalDeduction: 0,
              netSalary: 0,
              paidAmount: 0,
              remainingAmount: 0,
              status: "draft",
            },
          ],
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: emptyOverview }),
    });
    usePayroll.mockReturnValue(buildHookValue());

    render(<PayrollManagement />);

    expect(screen.getByText("Kỳ lương chính thức")).toBeInTheDocument();
    expect(screen.getByText("1 nhân viên phù hợp")).toBeInTheDocument();
  });
});