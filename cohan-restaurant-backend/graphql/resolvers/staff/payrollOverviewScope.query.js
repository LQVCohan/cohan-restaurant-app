import { PayrollPeriod } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

async function assertPeriodRestaurantScope({ periodId, restaurantId }, ctx) {
  if (!periodId) return null;

  const period = await PayrollPeriod.findById(periodId)
    .select({ restaurantId: 1 })
    .lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");

  await requireRestaurantAccess(ctx, period.restaurantId);
  if (
    restaurantId &&
    String(period.restaurantId) !== String(restaurantId)
  ) {
    const error = new Error("PAYROLL_PERIOD_RESTAURANT_MISMATCH");
    error.code = "PAYROLL_PERIOD_RESTAURANT_MISMATCH";
    throw error;
  }

  return period;
}

const wrapPayrollOverviewResolver = (resolver) => {
  if (typeof resolver !== "function") {
    throw new Error("PAYROLL_OVERVIEW_RESOLVER_MISSING");
  }

  return async (parent, args = {}, ctx, info) => {
    await assertPeriodRestaurantScope(args, ctx);
    return resolver(parent, args, ctx, info);
  };
};

export function guardPayrollOverviewQueries(queryMap = {}) {
  return {
    staffPayrollOverview: wrapPayrollOverviewResolver(
      queryMap.staffPayrollOverview,
    ),
    staffPayrollOverviewPage: wrapPayrollOverviewResolver(
      queryMap.staffPayrollOverviewPage,
    ),
  };
}
