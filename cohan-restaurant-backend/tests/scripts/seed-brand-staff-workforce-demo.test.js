import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND_ID,
  DEFAULT_RESTAURANT_ID,
  buildBaseSeedSteps,
  buildRosterStep,
  calculatePartTimePayrollBreakdown,
  getShiftPlan,
  normalizeSalaryProfile,
} from "../../scripts/seedBrandStaffWorkforceDemo.js";

describe("seedBrandStaffWorkforceDemo helpers", () => {
  it("builds one scoped seed chain for the requested Brand and restaurant", () => {
    const steps = buildBaseSeedSteps({ reset: true });

    expect(steps.map((step) => step.script)).toEqual([
      "seedPermissions.js",
      "seedParentRoles.js",
      "seedRoles.js",
      "seedSchedulingAttendanceDemo.js",
      "seedStaffProfileDemoData.js",
    ]);
    expect(steps[3].args).toEqual(["--reset"]);
    expect(steps.every((step) => step.env.DEMO_BRAND_ID === DEFAULT_BRAND_ID)).toBe(true);
    expect(
      steps.every(
        (step) => step.env.DEMO_RESTAURANT_ID === DEFAULT_RESTAURANT_ID,
      ),
    ).toBe(true);

    expect(buildRosterStep({ managerId: "manager-id" })).toMatchObject({
      script: "seedStaffPerformanceWeekRosterUtc.js",
      env: {
        DEMO_BRAND_ID: DEFAULT_BRAND_ID,
        DEMO_RESTAURANT_ID: DEFAULT_RESTAURANT_ID,
        DEMO_MANAGER_ID: "manager-id",
      },
    });
  });

  it("keeps full-time monthly and normalizes part-time to an hourly rate", () => {
    expect(
      normalizeSalaryProfile({
        employmentType: "full_time",
        baseSalary: 9_000_000,
        hourlyRate: 50_000,
      }),
    ).toEqual({
      salaryType: "monthly",
      baseSalary: 9_000_000,
      hourlyRate: null,
    });

    expect(
      normalizeSalaryProfile({
        employmentType: "part_time",
        baseSalary: 5_000_000,
      }),
    ).toEqual({
      salaryType: "hourly",
      baseSalary: 5_000_000,
      hourlyRate: 30_000,
    });
  });

  it("calculates part-time payroll from actual hours and configured multipliers", () => {
    const result = calculatePartTimePayrollBreakdown(
      {
        totalHours: 20,
        overtimeNormalHours: 2,
        overtimeWeekendHours: 1,
        overtimeHolidayHours: 0,
        nightHours: 4,
        allowance: 100_000,
        bonus: 50_000,
        otherAddition: 0,
        totalDeduction: 80_000,
        insuranceTotal: 20_000,
        minimumWageHourly: 25_000,
      },
      30_000,
      {
        overtimeMultiplierWeekday: 1.5,
        overtimeMultiplierWeekend: 2,
        overtimeMultiplierHoliday: 3,
        nightShiftAllowanceRate: 0.3,
      },
    );

    expect(result.hourlyRate).toBe(30_000);
    expect(result.grossIncome).toBe(786_000);
    expect(result.totalIncome).toBe(936_000);
    expect(result.totalDeduction).toBe(60_000);
    expect(result.netSalary).toBe(876_000);
    expect(result.insuranceTotal).toBe(0);
    expect(result.minimumWageViolation).toBe(false);
  });

  it("uses six-hour shifts for part-time and eight-hour shifts for full-time", () => {
    expect(
      getShiftPlan(
        { employmentType: "part_time", shiftType: "evening" },
        "2026-07-04",
      ),
    ).toEqual({ shiftType: "evening", startHour: 16, endHour: 22 });
    expect(
      getShiftPlan(
        { employmentType: "full_time", shiftType: "morning" },
        "2026-07-04",
      ),
    ).toEqual({ shiftType: "morning", startHour: 8, endHour: 16 });
  });
});
