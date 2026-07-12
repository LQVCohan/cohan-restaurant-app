import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import usePayroll from "@/hooks/usePayroll";
import PayrollManagement from "./PayrollManagement";

const selectionMock = vi.hoisted(() => vi.fn());

vi.mock("@apollo/client", () => ({
  gql: (strings, ...values) => String.raw({ raw: strings }, ...values),
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/usePayroll", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => selectionMock(),
}));

vi.mock("./components/PayrollReadinessPanel", () => ({
  default: () => <div>Kiểm tra trước khi chốt</div>,
}));

const item = {
  id: "employee-1",
  payrollItemId: "payroll-item-1",
  periodId: "period-1",
  name: "Phương Anh",
  code: "NV0001",
  role: "Server",
  department: "Service",
  actualWorkDays: 0,
  workDays: 26,
  totalHours: 0,
  grossIncome: 0,
  totalIncome: 0,
  allowance: 0,
  bonus: 0,
  overtime: 0,
  deduction: 0,
  otherDeduction: 0,
  advance: 0,
  insuranceTotal: 0,
  personalIncomeTax: 0,
  totalDeduction: 0,
  netSalary: 0,
  paidAmount: 0,
  remainingAmount: 0,
  insuranceEligible: true,
  scheduleShiftCount: 0,
  lateMinutes: 0,
  unpaidLeaveDays: 0,
  warningMessages: [],
  status: "draft",
};

const overview = {
  staffPayrollOverview: {
    stats: {
      totalPayroll: 0,
      paidAmount: 0,
      remaining: 0,
      progress: 0,
    },
    pageInfo: {
      totalCount: 1,
      limit: 8,
      offset: 0,
      page: 1,
      pageSize: 1,
      totalPages: 1,
      hasMore: false,
    },
    items: [item],
  },
};

const payrollHook = () => ({
  periods: [
    {
      id: "period-1",
      restaurantId: "restaurant-1",
      name: "Kỳ tháng 7",
      startDate: "2026-06-25T00:00:00.000Z",
      endDate: "2026-07-24T23:59:59.999Z",
      status: "draft",
    },
  ],
  currentPeriodId: "period-1",
  periodDetail: {
    period: {
      id: "period-1",
      restaurantId: "restaurant-1",
      startDate: "2026-06-25T00:00:00.000Z",
      endDate: "2026-07-24T23:59:59.999Z",
      status: "draft",
    },
  },
  payrollStats: overview.staffPayrollOverview.stats,
  payrollReadiness: { readyToFinalize: false },
  loading: false,
  createPeriod: vi.fn(),
  recalculatePeriod: vi.fn(),
  finalizePeriod: vi.fn(),
  lockPeriod: vi.fn(),
  refetchPeriods: vi.fn(),
  refetchDetail: vi.fn(),
  refetchPayrollReadiness: vi.fn(),
  refetchPayrollExportRows: vi.fn(),
});

describe("PayrollManagement data audit UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectionMock.mockReturnValue({
      restaurantOptions: [{ id: "restaurant-1", name: "Cohan Restaurant" }],
      selectedRestaurantId: "restaurant-1",
      setSelectedRestaurantId: vi.fn(),
      restaurantsLoading: false,
    });
    usePayroll.mockReturnValue(payrollHook());
    useQuery.mockReturnValue({
      data: overview,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("switches to range preview and removes periodId when a date changes", async () => {
    render(<PayrollManagement />);

    expect(useQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({ periodId: "period-1" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("Từ ngày"), {
      target: { value: "2026-07-01" },
    });

    await waitFor(() => {
      expect(screen.getByText("Đang xem dữ liệu tạm tính")).toBeInTheDocument();
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            periodId: undefined,
            startDate: "2026-07-01T00:00:00.000Z",
          }),
        }),
      );
    });
  });

  it("shows why a zero-income eligible employee has no insurance deduction", () => {
    render(<PayrollManagement />);

    expect(
      screen.getByText("1 nhân viên chưa phát sinh công hoặc thu nhập trên trang này"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết/i }));

    expect(screen.getByRole("heading", { name: "Khấu trừ" })).toBeInTheDocument();
    expect(screen.getByText("BH bắt buộc")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Chưa phát sinh thu nhập; khoản BH chưa được khấu trừ trong bản tính này.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("0 ₫").length).toBeGreaterThan(0);
  });
});
