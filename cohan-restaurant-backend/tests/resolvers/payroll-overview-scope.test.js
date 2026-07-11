import { beforeEach, describe, expect, it, vi } from "vitest";

const periodMocks = vi.hoisted(() => ({ findById: vi.fn() }));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const queryMocks = vi.hoisted(() => ({ staffPayrollOverview: vi.fn() }));

vi.mock("../../models/index.js", () => ({ PayrollPeriod: periodMocks }));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../graphql/resolvers/staff/query.js", () => ({
  default: queryMocks,
}));

const periodQuery = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("payroll overview period scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    periodMocks.findById.mockReturnValue(
      periodQuery({ _id: "period-1", restaurantId: "restaurant-1" }),
    );
    queryMocks.staffPayrollOverview.mockResolvedValue({
      stats: { totalPayroll: 100 },
      items: [
        { id: "employee-1", name: "An", status: "draft" },
        { id: "employee-2", name: "Bình", status: "paid" },
      ],
    });
  });

  it("rejects a period rendered under another restaurant", async () => {
    const payrollQueries = (
      await import(
        "../../graphql/resolvers/staff/payrollOverviewScope.query.js"
      )
    ).default;

    await expect(
      payrollQueries.staffPayrollOverview(
        null,
        {
          periodId: "period-1",
          restaurantId: "restaurant-2",
          startDate: new Date("2026-07-01"),
          endDate: new Date("2026-07-31"),
        },
        {},
      ),
    ).rejects.toMatchObject({
      message: "PAYROLL_PERIOD_RESTAURANT_MISMATCH",
      code: "PAYROLL_PERIOD_RESTAURANT_MISMATCH",
    });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      {},
      "restaurant-1",
    );
    expect(queryMocks.staffPayrollOverview).not.toHaveBeenCalled();
  });

  it("delegates a matching period and paginates the scoped result", async () => {
    const payrollQueries = (
      await import(
        "../../graphql/resolvers/staff/payrollOverviewScope.query.js"
      )
    ).default;

    await expect(
      payrollQueries.staffPayrollOverviewPage(
        null,
        {
          periodId: "period-1",
          restaurantId: "restaurant-1",
          startDate: new Date("2026-07-01"),
          endDate: new Date("2026-07-31"),
          status: "paid",
          limit: 8,
          offset: 0,
        },
        {},
      ),
    ).resolves.toEqual({
      stats: { totalPayroll: 100 },
      items: [{ id: "employee-2", name: "Bình", status: "paid" }],
      pageInfo: {
        totalCount: 1,
        limit: 8,
        offset: 0,
        page: 1,
        pageSize: 1,
        totalPages: 1,
        hasMore: false,
      },
    });

    expect(queryMocks.staffPayrollOverview).toHaveBeenCalledTimes(1);
  });
});
