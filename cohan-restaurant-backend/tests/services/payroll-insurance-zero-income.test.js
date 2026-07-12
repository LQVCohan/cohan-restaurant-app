import { describe, expect, it } from "vitest";
import { buildPayrollItem } from "../../src/services/payroll/payrollCalculator.service.js";

const period = {
  start: new Date("2026-06-25T00:00:00.000Z"),
  end: new Date("2026-07-24T23:59:59.999Z"),
  calendarDays: 30,
};

const settings = {
  standardWorkDaysPerMonth: 26,
  standardHoursPerDay: 8,
  enablePersonalIncomeTax: false,
};

const eligibleStaff = {
  baseSalary: 5_310_000,
  salaryType: "monthly",
  employmentType: "full_time",
  employmentStatus: "working",
  allowanceAmount: 0,
};

const build = (aggregate) =>
  buildPayrollItem({
    staff: eligibleStaff,
    period,
    aggregate,
    regionCode: "I",
    payrollStatus: "draft",
    settings,
  });

describe("payroll insurance deduction with no earned income", () => {
  it("keeps an eligible zero-income draft at zero instead of creating a negative payslip", () => {
    const payroll = build({
      workedDateCount: 0,
      workedShiftCount: 0,
      totalHours: 0,
    });

    expect(payroll.insuranceEligible).toBe(true);
    expect(payroll.totalIncome).toBe(0);
    expect(payroll.insuranceSocial).toBe(0);
    expect(payroll.insuranceHealth).toBe(0);
    expect(payroll.insuranceUnemployment).toBe(0);
    expect(payroll.insuranceTotal).toBe(0);
    expect(payroll.totalDeduction).toBe(0);
    expect(payroll.netSalary).toBe(0);
  });

  it("still applies the configured insurance rates after income is earned", () => {
    const payroll = build({
      workedDateCount: 26,
      workedShiftCount: 26,
      totalHours: 208,
    });

    expect(payroll.totalIncome).toBe(5_310_000);
    expect(payroll.insuranceSocial).toBe(424_800);
    expect(payroll.insuranceHealth).toBe(79_650);
    expect(payroll.insuranceUnemployment).toBe(53_100);
    expect(payroll.insuranceTotal).toBe(557_550);
    expect(payroll.totalDeduction).toBe(557_550);
    expect(payroll.netSalary).toBe(4_752_450);
  });
});
