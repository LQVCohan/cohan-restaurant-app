import { PayrollPeriod } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { assertPayrollPermission } from "../../../src/services/payroll/payrollPermission.service.js";
import { buildPayrollReadiness } from "../../../src/services/payroll/payrollReadiness.service.js";

export default {
  payrollReadiness: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");

    const period = await PayrollPeriod.findById(periodId)
      .select({ restaurantId: 1 })
      .lean();
    if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");

    await requireRestaurantAccess(ctx, period.restaurantId);

    return buildPayrollReadiness({
      periodId,
      actor: ctx?.user || null,
      context: ctx || {},
    });
  },
};
