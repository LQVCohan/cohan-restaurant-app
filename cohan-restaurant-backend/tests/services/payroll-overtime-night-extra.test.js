import { describe, expect, it } from "vitest";
import { computeOvertimeComponents } from "../../src/services/payroll/payrollCalculator.service.js";

const policy = {
  overtimeMultipliers: {
    normalDay: 1.5,
    weekendDay: 2,
    holidayDay: 3,
    nightWorkExtra: 0.3,
    overtimeAtNightExtra: 0.2,
  },
};

describe("payroll overtime at night", () => {
  it("adds the policy 20 percent premium for approved overtime overlapping night hours", () => {
    const result = computeOvertimeComponents({
      aggregate: {
        overtimeNormalHours: 1,
        overtimeWeekendHours: 0,
        overtimeHolidayHours: 0,
        nightHours: 1,
        overtimeNightHours: 1,
      },
      hourlyRate: 100_000,
      settings: {},
      policy,
    });

    expect(result.overtimeNormal).toBe(150_000);
    expect(result.nightShiftExtra).toBe(30_000);
    expect(result.overtimeNightExtra).toBe(20_000);
    expect(result.overtimeTotal).toBe(200_000);
  });

  it("does not add the 20 percent premium to non-overtime night work", () => {
    const result = computeOvertimeComponents({
      aggregate: {
        overtimeNormalHours: 0,
        overtimeWeekendHours: 0,
        overtimeHolidayHours: 0,
        nightHours: 2,
        overtimeNightHours: 0,
      },
      hourlyRate: 100_000,
      settings: {},
      policy,
    });

    expect(result.nightShiftExtra).toBe(60_000);
    expect(result.overtimeNightExtra).toBe(0);
    expect(result.overtimeTotal).toBe(60_000);
  });
});
