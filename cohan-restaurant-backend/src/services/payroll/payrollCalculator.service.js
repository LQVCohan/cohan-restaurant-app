import { getPayrollPolicyForDate, PAYROLL_VN_DEFAULT_REGION } from "../../config/payrollPolicy.vn.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeRegionCode(regionLike) {
  const raw = String(regionLike || "").trim().toUpperCase();
  if (["I", "II", "III", "IV"].includes(raw)) return raw;
  return PAYROLL_VN_DEFAULT_REGION;
}

export function calculatePeriodCalendarDays(start, end) {
  if (!start || !end || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

export function calculateInsuranceEligibility(staff, policy) {
  const employmentType = String(staff?.employmentType || "").toLowerCase();
  const employmentStatus = String(staff?.employmentStatus || "").toLowerCase();

  const isIncludedType = policy.insuranceEligibility.includedEmploymentTypes.includes(employmentType);
  const isExcludedType = policy.insuranceEligibility.excludedEmploymentTypes.includes(employmentType);
  const isIncludedStatus = policy.insuranceEligibility.includedEmploymentStatuses.includes(employmentStatus);

  return Boolean(isIncludedType && !isExcludedType && isIncludedStatus);
}

export function computeInsuranceDeductions({ baseSalary, policy, regionCode, isEligible }) {
  if (!isEligible) {
    return {
      insuranceBaseSalary: 0,
      insuranceSocial: 0,
      insuranceHealth: 0,
      insuranceUnemployment: 0,
      insuranceTotal: 0,
      insuranceEmployerTotal: 0,
    };
  }

  const referenceSalary = Number(
    policy.insurance.salaryCaps.socialAndHealthByReferenceSalary.amount || 0,
  );

  const socialHealthCap = referenceSalary > 0 ? referenceSalary * 20 : Number.MAX_SAFE_INTEGER;
  const regionMinimum = Number(policy.minimumWageByRegion[regionCode]?.monthly || 0);
  const unemploymentCap = regionMinimum > 0
    ? regionMinimum * Number(policy.insurance.salaryCaps.unemploymentByRegionalMinimumWage || 20)
    : Number.MAX_SAFE_INTEGER;

  const insuranceBaseSalary = Math.max(
    0,
    Math.min(Number(baseSalary || 0), socialHealthCap, unemploymentCap),
  );

  const insuranceSocial = insuranceBaseSalary * Number(policy.insurance.employee.social || 0);
  const insuranceHealth = insuranceBaseSalary * Number(policy.insurance.employee.health || 0);
  const insuranceUnemployment = insuranceBaseSalary * Number(policy.insurance.employee.unemployment || 0);

  const insuranceEmployerTotal = insuranceBaseSalary * (
    Number(policy.insurance.employer.socialRetirementAndSurvivorship || 0)
    + Number(policy.insurance.employer.socialSicknessAndMaternity || 0)
    + Number(policy.insurance.employer.workAccidentAndOccupationalDisease || 0)
    + Number(policy.insurance.employer.health || 0)
    + Number(policy.insurance.employer.unemployment || 0)
  );

  return {
    insuranceBaseSalary,
    insuranceSocial,
    insuranceHealth,
    insuranceUnemployment,
    insuranceTotal: insuranceSocial + insuranceHealth + insuranceUnemployment,
    insuranceEmployerTotal,
  };
}

export function computeOvertimeComponents({ totalHours, actualWorkDays, hourlyRate, policy }) {
  const standardHours = Math.max(actualWorkDays * Number(policy.payrollDefaults.standardHoursPerDay || 8), 0);
  const overtimeHours = Math.max(Number(totalHours || 0) - standardHours, 0);

  const overtimeNormalHours = overtimeHours;
  const overtimeWeekendHours = 0;
  const overtimeHolidayHours = 0;
  const nightHours = 0;
  const overtimeNightHours = 0;

  const overtimeNormal = overtimeNormalHours * hourlyRate * Number(policy.overtimeMultipliers.normalDay || 1.5);
  const overtimeWeekend = overtimeWeekendHours * hourlyRate * Number(policy.overtimeMultipliers.weekendDay || 2);
  const overtimeHoliday = overtimeHolidayHours * hourlyRate * Number(policy.overtimeMultipliers.holidayDay || 3);
  const nightShiftExtra = nightHours * hourlyRate * Number(policy.overtimeMultipliers.nightWorkExtra || 0);
  const overtimeNightExtra = overtimeNightHours * hourlyRate * Number(policy.overtimeMultipliers.overtimeAtNightExtra || 0);

  return {
    standardHours,
    overtimeHours,
    overtimeNormalHours,
    overtimeWeekendHours,
    overtimeHolidayHours,
    nightHours,
    overtimeNightHours,
    overtimeNormal,
    overtimeWeekend,
    overtimeHoliday,
    nightShiftExtra,
    overtimeNightExtra,
    overtimeTotal: overtimeNormal + overtimeWeekend + overtimeHoliday + nightShiftExtra + overtimeNightExtra,
  };
}

export function buildPayrollItem({
  staff,
  period,
  aggregate,
  regionCode,
  payrollStatus,
}) {
  const policy = getPayrollPolicyForDate(period.end);
  const baseSalary = Number(staff.baseSalary || 0);
  const workDays = Number(period.calendarDays || 0);
  const actualWorkDays = Number(aggregate.workedDateCount || 0);

  const hourlyRate = workDays > 0
    ? baseSalary / Math.max(workDays * Number(policy.payrollDefaults.standardHoursPerDay || 8), 1)
    : 0;

  const dailyRate = workDays > 0 ? baseSalary / workDays : 0;
  const proratedBaseSalary = dailyRate * actualWorkDays;

  const overtimeBreakdown = computeOvertimeComponents({
    totalHours: aggregate.totalHours,
    actualWorkDays,
    hourlyRate,
    policy,
  });

  const allowance = 0;
  const bonus = Math.max(0, Number(aggregate.totalAmount || 0) - Number(aggregate.totalWage || 0));
  const otherAddition = 0;
  const grossIncome = proratedBaseSalary + overtimeBreakdown.overtimeTotal + allowance + bonus + otherAddition;

  const insuranceEligible = calculateInsuranceEligibility(staff, policy);
  const insurance = computeInsuranceDeductions({
    baseSalary,
    policy,
    regionCode,
    isEligible: insuranceEligible,
  });

  const deduction = Math.max(0, Number(aggregate.totalWage || 0) - Number(aggregate.totalAmount || 0));
  const advance = 0;
  const otherDeduction = deduction;
  const personalIncomeTax = 0;
  const totalDeduction = insurance.insuranceTotal + advance + otherDeduction + personalIncomeTax;
  const netSalary = grossIncome - totalDeduction;

  const minWageMonthly = Number(policy.minimumWageByRegion[regionCode]?.monthly || 0);
  const minimumWageViolation = baseSalary > 0 && baseSalary < minWageMonthly;
  const missingTimesheetData = actualWorkDays > 0 && Number(aggregate.totalHours || 0) <= 0;

  return {
    baseSalary,
    workDays,
    actualWorkDays,
    totalHours: Number(aggregate.totalHours || 0),
    hourlyRate,
    allowance,
    bonus,
    otherAddition,
    overtime: overtimeBreakdown.overtimeTotal,
    overtimeNormal: overtimeBreakdown.overtimeNormal,
    overtimeWeekend: overtimeBreakdown.overtimeWeekend,
    overtimeHoliday: overtimeBreakdown.overtimeHoliday,
    nightShiftExtra: overtimeBreakdown.nightShiftExtra,
    overtimeHours: overtimeBreakdown.overtimeHours,
    overtimeNormalHours: overtimeBreakdown.overtimeNormalHours,
    overtimeWeekendHours: overtimeBreakdown.overtimeWeekendHours,
    overtimeHolidayHours: overtimeBreakdown.overtimeHolidayHours,
    nightHours: overtimeBreakdown.nightHours,
    overtimeNightHours: overtimeBreakdown.overtimeNightHours,
    grossIncome,
    deduction,
    otherDeduction,
    advance,
    insuranceSocial: insurance.insuranceSocial,
    insuranceHealth: insurance.insuranceHealth,
    insuranceUnemployment: insurance.insuranceUnemployment,
    insuranceTotal: insurance.insuranceTotal,
    insuranceEmployerTotal: insurance.insuranceEmployerTotal,
    personalIncomeTax,
    totalIncome: grossIncome,
    totalDeduction,
    netSalary,
    coefficient: workDays > 0 ? actualWorkDays / workDays : 0,
    payrollStatus,
    regionCode,
    minimumWageMonthly: minWageMonthly,
    minimumWageHourly: Number(policy.minimumWageByRegion[regionCode]?.hourly || 0),
    minimumWageViolation,
    insuranceEligible,
    missingTimesheetData,
    policyCode: policy.policyCode,
    policyEffectiveFrom: policy.effectiveFrom,
    policyLegalReferences: Object.values(policy.legalReferences || {}),
  };
}
