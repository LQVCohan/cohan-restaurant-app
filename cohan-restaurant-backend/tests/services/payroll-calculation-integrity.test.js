import { describe, expect, it } from "vitest";
import {
  buildPayrollItem,
  normalizeSalaryType,
} from "../../src/services/payroll/payrollCalculator.service.js";
import {
  summarize,
  toEndOfDay,
  toStartOfDay,
} from "../../src/services/payroll/payrollRuntime.service.js";

const period = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-07-31T23:59:59.999Z"),
  calendarDays: 31,
};

const settings = {
  standardWorkDaysPerMonth: 26,
  standardHoursPerDay: 8,
  overtimeMultiplierWeekday: 1.5,
  overtimeMultiplierWeekend: 2,
  overtimeMultiplierHoliday: 3,
  nightShiftAllowanceRate: 0.3,
  enablePersonalIncomeTax: false,
};

const staff = (patch = {}) => ({
  employmentType: "seasonal",
  employmentStatus: "working",
  baseSalary: 0,
  salaryType: "monthly",
  hourlyRate: 0,
  allowanceAmount: 0,
  ...patch,
});

const aggregate = (patch = {}) => ({
  workedDateCount: 0,
  workedShiftCount: 0,
  totalHours: 0,
  totalWage: 0,
  totalAmount: 0,
  overtimeNormalHours: 0,
  overtimeWeekendHours: 0,
  overtimeHolidayHours: 0,
  nightHours: 0,
  overtimeNightHours: 0,
  paidLeaveDays: 0,
  ...patch,
});

const calculate = (staffPatch, aggregatePatch) =>
  buildPayrollItem({
    staff: staff(staffPatch),
    period,
    aggregate: aggregate(aggregatePatch),
    regionCode: "I",
    payrollStatus: "draft",
    settings,
  });

describe("payroll calculation integrity", () => {
  it("normalizes unknown salary types to monthly", () => {
    expect(normalizeSalaryType("HOURLY")).toBe("hourly");
    expect(normalizeSalaryType("unknown")).toBe("monthly");
  });

  it("prorates monthly salary and includes employee allowance once", () => {
    const result = calculate(
      { baseSalary: 26_000_000, allowanceAmount: 500_000 },
      { workedDateCount: 13, totalHours: 104 },
    );

    expect(result.salaryType).toBe("monthly");
    expect(result.baseWorkIncome).toBe(13_000_000);
    expect(result.allowance).toBe(500_000);
    expect(result.grossIncome).toBe(13_000_000);
    expect(result.totalIncome).toBe(13_500_000);
  });

  it("does not pay approved overtime twice for hourly staff", () => {
    const result = calculate(
      { salaryType: "hourly", hourlyRate: 50_000 },
      { totalHours: 12, workedDateCount: 2, overtimeNormalHours: 2 },
    );

    expect(result.salaryType).toBe("hourly");
    expect(result.regularHours).toBe(10);
    expect(result.baseWorkIncome).toBe(500_000);
    expect(result.overtimeNormal).toBe(150_000);
    expect(result.grossIncome).toBe(650_000);
  });

  it("calculates shift staff from payable shift count", () => {
    const result = calculate(
      { salaryType: "shift", baseSalary: 400_000 },
      { workedDateCount: 3, workedShiftCount: 3, totalHours: 24 },
    );

    expect(result.salaryType).toBe("shift");
    expect(result.workedShiftCount).toBe(3);
    expect(result.baseWorkIncome).toBe(1_200_000);
  });

  it("calculates commission from persisted timesheet amount and configured rate", () => {
    const result = calculate(
      { salaryType: "commission", commissionRate: 10 },
      { totalAmount: 20_000_000, totalWage: 1_500_000, totalHours: 20 },
    );

    expect(result.salaryType).toBe("commission");
    expect(result.commissionRate).toBe(10);
    expect(result.commissionableAmount).toBe(20_000_000);
    expect(result.baseWorkIncome).toBe(2_000_000);
    expect(result.grossIncome).toBe(2_000_000);
  });

  it("includes partial payments in period totals and progress", () => {
    expect(
      summarize([
        { netSalary: 1_000_000, paidAmount: 400_000, status: "pending_payment" },
        { netSalary: 2_000_000, paidAmount: 2_000_000, status: "paid" },
      ]),
    ).toMatchObject({
      totalPayroll: 3_000_000,
      paidAmount: 2_400_000,
      remaining: 600_000,
      progress: 80,
      paidEmployees: 1,
      unpaidEmployees: 1,
    });
  });

  it("uses UTC-stable payroll day boundaries", () => {
    expect(toStartOfDay("2026-07-11T18:30:00.000Z").toISOString()).toBe(
      "2026-07-11T00:00:00.000Z",
    );
    expect(toEndOfDay("2026-07-11T02:30:00.000Z").toISOString()).toBe(
      "2026-07-11T23:59:59.999Z",
    );
  });
});