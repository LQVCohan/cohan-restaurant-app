import { beforeEach, describe, expect, it, vi } from "vitest";

const periodMocks = vi.hoisted(() => ({ findById: vi.fn() }));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));

vi.mock("../../models/index.js", () => ({ PayrollPeriod: periodMocks }));
vi.mock("../../graphql/guards.js", () => guardMocks);

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
  });

  it("rejects a period rendered under another restaurant", async () => {
    const staffPayrollOverview = vi.fn();
    const staffPayrollOverviewPage = vi.fn();
    const { guardPayrollOverviewQueries } = await import(
      "../../graphql/resolvers/staff/payrollOverviewScope.query.js"
    );
    const payrollQueries = guardPayrollOverviewQueries({
      staffPayrollOverview,
      staffPayrollOverviewPage,
    });

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
    expect(staffPayrollOverview).not.toHaveBeenCalled();
    expect(staffPayrollOverviewPage).not.toHaveBeenCalled();
  });

  it("delegates matching direct and paginated overview resolvers unchanged", async () => {
    const directResult = {
      stats: { totalPayroll: 100 },
      items: [{ id: "employee-1", name: "An", status: "draft" }],
    };
    const pageResult = {
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
    };
    const staffPayrollOverview = vi.fn().mockResolvedValue(directResult);
    const staffPayrollOverviewPage = vi.fn().mockResolvedValue(pageResult);
    const { guardPayrollOverviewQueries } = await import(
      "../../graphql/resolvers/staff/payrollOverviewScope.query.js"
    );
    const payrollQueries = guardPayrollOverviewQueries({
      staffPayrollOverview,
      staffPayrollOverviewPage,
    });
    const args = {
      periodId: "period-1",
      restaurantId: "restaurant-1",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
      status: "paid",
      limit: 8,
      offset: 0,
    };

    await expect(
      payrollQueries.staffPayrollOverview(null, args, {}),
    ).resolves.toEqual(directResult);
    await expect(
      payrollQueries.staffPayrollOverviewPage(null, args, {}),
    ).resolves.toEqual(pageResult);

    expect(staffPayrollOverview).toHaveBeenCalledWith(
      null,
      args,
      {},
      undefined,
    );
    expect(staffPayrollOverviewPage).toHaveBeenCalledWith(
      null,
      args,
      {},
      undefined,
    );
  });

  it("fails fast when the resolver map is incomplete", async () => {
    const { guardPayrollOverviewQueries } = await import(
      "../../graphql/resolvers/staff/payrollOverviewScope.query.js"
    );

    expect(() =>
      guardPayrollOverviewQueries({ staffPayrollOverview: vi.fn() }),
    ).toThrow("PAYROLL_OVERVIEW_RESOLVER_MISSING");
  });
});
