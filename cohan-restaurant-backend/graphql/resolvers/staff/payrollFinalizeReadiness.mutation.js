import { PayrollPeriod } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { assertPayrollPermission } from "../../../src/services/payroll/payrollPermission.service.js";
import { logPayrollEvent } from "../../../src/services/payroll/payrollEventLog.service.js";
import { buildPayrollReadiness } from "../../../src/services/payroll/payrollReadiness.service.js";
import staffMutation from "./mutation.js";

function createPayrollNotReadyError(readiness) {
  const error = new Error("PAYROLL_PERIOD_NOT_READY");
  error.code = "PAYROLL_PERIOD_NOT_READY";
  error.extensions = {
    code: "PAYROLL_PERIOD_NOT_READY",
    readiness: readiness
      ? {
          blockingCount: readiness.blockingCount,
          warningCount: readiness.warningCount,
        }
      : undefined,
  };
  return error;
}

const payrollFinalizeReadinessMutation = {
  finalizePayrollPeriod: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.finalize");

    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");

    await requireRestaurantAccess(ctx, period.restaurantId);

    if (period.status !== "draft") {
      throw new Error("Chỉ có thể chốt kỳ lương đang ở trạng thái nháp.");
    }

    const readiness = await buildPayrollReadiness({
      periodId,
      actor: ctx?.user || null,
      context: ctx,
    });

    if (readiness?.readyToFinalize === false) {
      await logPayrollEvent({
        ctx,
        restaurantId: period.restaurantId,
        verb: "payroll.readiness.failed",
        objectKind: "PayrollPeriod",
        objectId: period._id,
        status: "failed",
        meta: {
          blockingCount: readiness.blockingCount,
          warningCount: readiness.warningCount,
          issueCodes: (readiness.issues || []).map((issue) => issue.code),
        },
      });

      throw createPayrollNotReadyError(readiness);
    }

    return staffMutation.finalizePayrollPeriod(_, { periodId }, ctx);
  },
};

export default payrollFinalizeReadinessMutation;
