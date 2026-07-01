import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const setSelectedRestaurantId = vi.fn();

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    restaurantOptions: [{ id: "restaurant-1", name: "Cohan Restaurant" }],
    selectedRestaurantId: "restaurant-1",
    setSelectedRestaurantId,
    selectedRestaurant: { id: "restaurant-1", name: "Cohan Restaurant" },
    restaurantsLoading: false,
    hasRestaurants: true,
  }),
}));

const payrollItems = Array.from({ length: 14 }, (_, index) => ({
  id: `emp-${index + 1}`,
  payrollItemId: null,
  periodId: null,
  name: `Demo Staff ${index + 1}`,
  code: `DS-${String(index + 1).padStart(2, "0")}`,
  role: index % 2 ? "Cashier" : "Server",
  department: index % 3 === 0 ? "Service" : index % 3 === 1 ? "Cashier" : "Kitchen",
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
}));

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildExpectedDefaultRange = (today = new Date()) => {
  const start = toDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 25));
  const end = toDateInput(new Date(today.getFullYear(), today.getMonth(), 24));
  return {
    startDate: `${start}T00:00:00.000Z`,
    endDate: `${end}T23:59:59.999Z`,
  };
};

const buildPageOverview = ({ offset = 0, limit = 8, status, search } = {}) => {
  const keyword = String(search || "").trim().toLowerCase();
  const filtered = payrollItems.filter((item) => {
    const matchesStatus = !status || item.status === status;
    const haystack = [item.name, item.code, item.department, item.role].join(" ").toLowerCase();
    const matchesSearch = !keyword || haystack.includes(keyword);
    return matchesStatus && matchesSearch;
  });
  const pageItems = filtered.slice(offset, offset + limit);
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  return {
    staffPayrollOverview: {
      stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
      pageInfo: {
        totalCount: filtered.length,
        limit,
        offset,
        page: Math.min(totalPages, Math.floor(offset / limit) + 1),
        pageSize: pageItems.length,
        totalPages,
        hasMore: offset + limit < filtered.length,
      },
      items: pageItems,
    },
  };
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
  recalculatePeriod: vi.fn().mockResolvedValue({ data: { recalculatePayrollPeriod: { period: { id: "period-1" } } } }),
  finalizePeriod: vi.fn().mockResolvedValue({ data: { finalizePayrollPeriod: { id: "period-1" } } }),
  lockPeriod: vi.fn().mockResolvedValue({ data: { lockPayrollPeriod: { id: "period-1" } } }),
  refetchPeriods: vi.fn().mockResolvedValue({}),
  refetchDetail: vi.fn().mockResolvedValue({}),
  refetchPayrollReadiness: vi.fn().mockResolvedValue({}),
  ...overrides,
});

const mockPayrollOverviewQuery = () => {
  useQuery.mockImplementation((_, options = {}) => ({
    data: buildPageOverview(options.variables || {}),
    loading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data: buildPageOverview(options.variables || {}) }),
  }));
};

describe("PayrollManagement current manager payroll UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPayrollOverviewQuery();
    usePayroll.mockReturnValue(buildHookValue());
    global.URL.createObjectURL = vi.fn(() => "blob:payroll");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders payroll dashboard with runtime badge and backend paginated rows", () => {
    render(<PayrollManagement />);

    expect(screen.getByRole("heading", { name: "Quản lý lương" })).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu tạm tính")).toBeInTheDocument();
    expect(screen.getByText("14 nhân viên phù hợp")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText(/Hiển thị 1-8/)).toBeInTheDocument();
    expect(screen.getByText(/Trang 1\/2/)).toBeInTheDocument();
    expect(screen.getAllByText(/Demo Staff/)).toHaveLength(8);

    expect(useQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({
          restaurantId: "restaurant-1",
          periodId: "period-1",
          limit: 8,
          offset: 0,
        }),
      }),
    );
  });

  it("uses backend pagination when moving to the next page", async () => {
    render(<PayrollManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Sau" }));

    await waitFor(() => {
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({ offset: 8, limit: 8 }),
        }),
      );
    });
    expect(screen.getByText(/Hiển thị 9-14/)).toBeInTheDocument();
    expect(screen.getByText(/Trang 2\/2/)).toBeInTheDocument();
  });

  it("sends search and status filters to the backend page query", async () => {
    render(<PayrollManagement />);

    fireEvent.change(screen.getByPlaceholderText("Tìm nhân viên, mã, bộ phận..."), {
      target: { value: "cashier" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đã chốt" }));

    await waitFor(() => {
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({ search: "cashier", status: "finalized", offset: 0 }),
        }),
      );
    });
  });

  it("creates a payroll period with DateTime range and refreshes data", async () => {
    const createPeriod = vi.fn().mockResolvedValue({ data: { createPayrollPeriod: { id: "period-2" } } });
    const refetchPeriods = vi.fn().mockResolvedValue({});
    const refetchDetail = vi.fn().mockResolvedValue({});
    const refetchPayrollReadiness = vi.fn().mockResolvedValue({});
    const expectedDefaultRange = buildExpectedDefaultRange();
    usePayroll.mockReturnValue(
      buildHookValue({ createPeriod, refetchPeriods, refetchDetail, refetchPayrollReadiness }),
    );

    render(<PayrollManagement />);
    fireEvent.click(screen.getByRole("button", { name: /Tạo kỳ lương/i }));

    await waitFor(() => {
      expect(createPeriod).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            restaurantId: "restaurant-1",
            startDate: expectedDefaultRange.startDate,
            endDate: expectedDefaultRange.endDate,
          }),
        },
      });
    });
    await waitFor(() => expect(screen.getByText("Đã tạo kỳ lương chính thức.")).toBeInTheDocument());
    expect(refetchPeriods).toHaveBeenCalled();
    expect(refetchDetail).toHaveBeenCalledWith({ periodId: "period-2" });
    expect(refetchPayrollReadiness).toHaveBeenCalledWith({ periodId: "period-2" });
  });

  it("does not show a false success message when createPayrollPeriod returns GraphQL errors", async () => {
    const createPeriod = vi.fn().mockResolvedValue({
      errors: [{ message: "Bạn không có quyền thực hiện thao tác bảng lương này." }],
    });
    usePayroll.mockReturnValue(buildHookValue({ createPeriod }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByRole("button", { name: /Tạo kỳ lương/i }));

    expect(await screen.findByText("Bạn không có quyền thực hiện thao tác bảng lương này.")).toBeInTheDocument();
    expect(screen.queryByText("Đã tạo kỳ lương chính thức.")).not.toBeInTheDocument();
  });

  it("runs period lifecycle actions with the selected effective period id", async () => {
    const finalizePeriod = vi.fn().mockResolvedValue({ data: { finalizePayrollPeriod: { id: "period-1" } } });
    usePayroll.mockReturnValue(buildHookValue({ finalizePeriod }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Chốt kỳ" }));

    await waitFor(() => {
      expect(finalizePeriod).toHaveBeenCalledWith({ variables: { periodId: "period-1" } });
    });
    expect(screen.getByText("Chốt kỳ lương thành công.")).toBeInTheDocument();
  });
});
