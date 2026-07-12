import {
  getPayrollPolicyForDate,
  PAYROLL_VN_DEFAULT_REGION,
} from "../../config/payrollPolicy.vn.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SALARY_TYPES = new Set(["monthly", "hourly", "shift", "commission"]);

const toNonNegativeNumber = (value) => Math.max(Number(value || 0), 0);

export function normalizeRegionCode(regionLike) {
  const raw = String(regionLike || "").trim().toUpperCase();
  if (["I", "II", "III", "IV"].includes(raw)) return raw;
  return PAYROLL_VN_DEFAULT_REGION;
}

export function normalizeSalaryType(value) {
  const normalized = String(value || "monthly").trim().toLowerCase();
  return SALARY_TYPES.has(normalized) ? normalized : "monthly";
}

export function calculatePeriodCalendarDays(start, end) {
  if (!start || !end || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

export function calculateInsuranceEligibility(staff, policy) {
  const employmentType = String(staff?.employmentType || "").toLowerCase();
  const employmentStatus = String(staff?.employmentStatus || "").toLowerCase();

  const isIncludedType =
    policy.insuranceEligibility.includedEmploymentTypes.includes(employmentType);
  const isExcludedType =
    policy.insuranceEligibility.excludedEmploymentTypes.includes(employmentType);
  const isIncludedStatus =
    policy.insuranceEligibility.includedEmploymentStatuses.includes(employmentStatus);

  return Boolean(isIncludedType && !isExcludedType && isIncludedStatus);
}

export function computeInsuranceDeductions({
  baseSalary,
  policy,
  regionCode,
  isEligible,
}) {
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
  const socialHealthCap =
    referenceSalary > 0 ? referenceSalary * 20 : Number.MAX_SAFE_INTEGER;
  const regionMinimum = Number(
    policy.minimumWageByRegion[regionCode]?.monthly || 0,
  );
  const unemploymentCap =
    regionMinimum > 0
      ? regionMinimum *
        Number(
          policy.insurance.salaryCaps.unemploymentByRegionalMinimumWage || 20,
        )
      : Number.MAX_SAFE_INTEGER;

  const insuranceBaseSalary = Math.max(
    0,
    Math.min(Number(baseSalary || 0), socialHealthCap, unemploymentCap),
  );

  const insuranceSocial =
    insuranceBaseSalary * Number(policy.insurance.employee.social || 0);
  const insuranceHealth =
    insuranceBaseSalary * Number(policy.insurance.employee.health || 0);
  const insuranceUnemployment =
    insuranceBaseSalary * Number(policy.insurance.employee.unemployment || 0);

  const insuranceEmployerTotal =
    insuranceBaseSalary *
    (Number(
      policy.insurance.employer.socialRetirementAndSurvivorship || 0,
    ) +
      Number(
        policy.insurance.employer.socialSicknessAndMaternity || 0,
      ) +
      Number(
        policy.insurance.employer.workAccidentAndOccupationalDisease || 0,
      ) +
      Number(policy.insurance.employer.health || 0) +
      Number(policy.insurance.employer.unemployment || 0));

  return {
    insuranceBaseSalary,
    insuranceSocial,
    insuranceHealth,
    insuranceUnemployment,
    insuranceTotal:
      insuranceSocial + insuranceHealth + insuranceUnemployment,
    insuranceEmployerTotal,
  };
}

export function computeOvertimeComponents({
  aggregate,
  hourlyRate,
  settings,
  policy,
}) {
  const overtimeNormalHours = toNonNegativeNumber(
    aggregate?.overtimeNormalHours,
  );
  const overtimeWeekendHours = toNonNegativeNumber(
    aggregate?.overtimeWeekendHours,
  );
  const overtimeHolidayHours = toNonNegativeNumber(
    aggregate?.overtimeHolidayHours,
  );
  const nightHours = toNonNegativeNumber(aggregate?.nightHours);
  const overtimeNightHours = toNonNegativeNumber(
    aggregate?.overtimeNightHours,
  );
  const overtimeHours =
    overtimeNormalHours + overtimeWeekendHours + overtimeHolidayHours;

  const overtimeNormal =
    overtimeNormalHours *
    hourlyRate *
    Number(
      settings?.overtimeMultiplierWeekday ||
        policy.overtimeMultipliers.normalDay ||
        1.5,
    );
  const overtimeWeekend =
    overtimeWeekendHours *
    hourlyRate *
    Number(
      settings?.overtimeMultiplierWeekend ||
        policy.overtimeMultipliers.weekendDay ||
        2,
    );
  const overtimeHoliday =
    overtimeHolidayHours *
    hourlyRate *
    Number(
      settings?.overtimeMultiplierHoliday ||
        policy.overtimeMultipliers.holidayDay ||
        3,
    );
  const nightShiftExtra =
    nightHours *
    hourlyRate *
    Number(
      settings?.nightShiftAllowanceRate ??
        policy.overtimeMultipliers.nightWorkExtra ??
        0,
    );
  const overtimeNightExtra =
    overtimeNightHours *
    hourlyRate *
    Number(policy.overtimeMultipliers.overtimeAtNightExtra ?? 0);

  return {
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
    overtimeTotal:
      overtimeNormal +
      overtimeWeekend +
      overtimeHoliday +
      nightShiftExtra +
      overtimeNightExtra,
  };
}

function resolveCompensation({
  staff,
  aggregate,
  workDays,
  standardHoursPerDay,
}) {
  const salaryType = normalizeSalaryType(staff?.salaryType);
  const baseSalary = toNonNegativeNumber(staff?.baseSalary);
  const configuredHourlyRate = toNonNegativeNumber(staff?.hourlyRate);
  const commissionRate = toNonNegativeNumber(staff?.commissionRate);
  const commissionableAmount = toNonNegativeNumber(aggregate?.totalAmount);
  const actualWorkDays = toNonNegativeNumber(aggregate?.workedDateCount);
  const workedShiftCount = toNonNegativeNumber(
    aggregate?.workedShiftCount ?? actualWorkDays,
  );
  const paidLeaveDays = toNonNegativeNumber(aggregate?.paidLeaveDays);
  const totalHours = toNonNegativeNumber(aggregate?.totalHours);
  const overtimeHours =
    toNonNegativeNumber(aggregate?.overtimeNormalHours) +
    toNonNegativeNumber(aggregate?.overtimeWeekendHours) +
    toNonNegativeNumber(aggregate?.overtimeHolidayHours);
  const monthlyDailyRate = workDays > 0 ? baseSalary / workDays : 0;
  const monthlyHourlyRate =
    standardHoursPerDay > 0 ? monthlyDailyRate / standardHoursPerDay : 0;
  const paidLeaveHours = paidLeaveDays * standardHoursPerDay;
  const normalWorkedHours = Math.max(totalHours - overtimeHours, 0);

  if (salaryType === "hourly") {
    const hourlyRate = configuredHourlyRate;
    const regularHours = normalWorkedHours + paidLeaveHours;
    return {
      salaryType,
      hourlyRate,
      regularHours,
      workedShiftCount,
      commissionRate,
      commissionableAmount,
      salaryConfigurationIssue: null,
      baseWorkIncome: regularHours * hourlyRate,
      missingCompensationRate: hourlyRate <= 0,
      coefficient:
        workDays * standardHoursPerDay > 0
          ? regularHours / (workDays * standardHoursPerDay)
          : 0,
    };
  }

  if (salaryType === "shift") {
    const payableShifts = workedShiftCount + paidLeaveDays;
    const hourlyRate =
      standardHoursPerDay > 0 ? baseSalary / standardHoursPerDay : 0;
    return {
      salaryType,
      hourlyRate,
      regularHours: normalWorkedHours + paidLeaveHours,
      workedShiftCount,
      commissionRate,
      commissionableAmount,
      salaryConfigurationIssue: null,
      baseWorkIncome: payableShifts * baseSalary,
      missingCompensationRate: baseSalary <= 0,
      coefficient: workDays > 0 ? payableShifts / workDays : 0,
    };
  }

  if (salaryType === "commission") {
    const hourlyRate = configuredHourlyRate || monthlyHourlyRate;
    const salaryConfigurationIssue =
      commissionRate > 0 ? null : "COMMISSION_RATE_REQUIRED";
    return {
      salaryType,
      hourlyRate,
      regularHours: normalWorkedHours,
      workedShiftCount,
      commissionRate,
      commissionableAmount,
      salaryConfigurationIssue,
      baseWorkIncome: salaryConfigurationIssue
        ? 0
        : commissionableAmount * (commissionRate / 100),
      missingCompensationRate: commissionRate <= 0,
      coefficient: commissionableAmount > 0 ? 1 : 0,
    };
  }

  return {
    salaryType: "monthly",
    hourlyRate: monthlyHourlyRate,
    regularHours: normalWorkedHours + paidLeaveHours,
    workedShiftCount,
    commissionRate,
    commissionableAmount,
    salaryConfigurationIssue: null,
    baseWorkIncome: actualWorkDays * monthlyDailyRate,
    missingCompensationRate: baseSalary <= 0,
    coefficient: workDays > 0 ? actualWorkDays / workDays : 0,
  };
}

export function buildPayrollItem({
  staff,
  period,
  aggregate,
  regionCode,
  payrollStatus,
  settings = {},
}) {
  const policy = getPayrollPolicyForDate(period.end);
  const baseSalary = toNonNegativeNumber(staff?.baseSalary);
  const workDays = Number(
    settings.standardWorkDaysPerMonth ||
      period.calendarDays ||
      policy.payrollDefaults.standardDaysPerMonth ||
      26,
  );
  const standardHoursPerDay = Number(
    settings.standardHoursPerDay ||
      policy.payrollDefaults.standardHoursPerDay ||
      8,
  );
  const actualWorkDays = toNonNegativeNumber(aggregate?.workedDateCount);
  const totalHours = toNonNegativeNumber(aggregate?.totalHours);
  const compensation = resolveCompensation({
    staff,
    aggregate,
    workDays,
    standardHoursPerDay,
  });

  const overtimeBreakdown = computeOvertimeComponents({
    aggregate,
    hourlyRate: compensation.hourlyRate,
    settings,
    policy,
  });

  const allowance = toNonNegativeNumber(staff?.allowanceAmount);
  const bonus = 0;
  const otherAddition = 0;
  const grossIncome =
    compensation.baseWorkIncome + overtimeBreakdown.overtimeTotal;
  const totalIncome = grossIncome + allowance + bonus + otherAddition;

  const insuranceEligible = calculateInsuranceEligibility(staff, policy);
  const insurance = computeInsuranceDeductions({
    baseSalary,
    policy,
    regionCode,
    // A draft with no earned income must not become an insurance-only negative payslip.
    isEligible: insuranceEligible && totalIncome > 0,
  });

  const deduction = 0;
  const otherDeduction = 0;
  const advance = 0;
  const taxFreeThreshold = Number(
    settings.personalIncomeTaxFreeThreshold || 0,
  );
  const taxableIncome = Math.max(
    totalIncome - insurance.insuranceTotal - taxFreeThreshold,
    0,
  );
  const personalIncomeTax = settings.enablePersonalIncomeTax
    ? taxableIncome * Number(settings.personalIncomeTaxRate || 0)
    : 0;
  const totalDeduction =
    deduction +
    otherDeduction +
    advance +
    insurance.insuranceTotal +
    personalIncomeTax;
  const netSalary = totalIncome - totalDeduction;

  const minimumWageMonthly = Number(
    policy.minimumWageByRegion[regionCode]?.monthly || 0,
  );
  const minimumWageHourly = Number(
    policy.minimumWageByRegion[regionCode]?.hourly || 0,
  );
  const minimumWageViolation =
    compensation.salaryType === "monthly"
      ? baseSalary > 0 && baseSalary < minimumWageMonthly
      : compensation.hourlyRate > 0 &&
        compensation.hourlyRate < minimumWageHourly;

  return {
    salaryType: compensation.salaryType,
    baseSalary,
    baseWorkIncome: compensation.baseWorkIncome,
    commissionRate: compensation.commissionRate,
    commissionableAmount: compensation.commissionableAmount,
    salaryConfigurationIssue: compensation.salaryConfigurationIssue,
    workDays,
    actualWorkDays,
    workedShiftCount: compensation.workedShiftCount,
    totalHours,
    regularHours: compensation.regularHours,
    hourlyRate: compensation.hourlyRate,
    allowance,
    bonus,
    otherAddition,
    overtime: overtimeBreakdown.overtimeTotal,
    overtimeNormal: overtimeBreakdown.overtimeNormal,
    overtimeWeekend: overtimeBreakdown.overtimeWeekend,
    overtimeHoliday: overtimeBreakdown.overtimeHoliday,
    nightShiftExtra: overtimeBreakdown.nightShiftExtra,
    overtimeNightExtra: overtimeBreakdown.overtimeNightExtra,
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
    totalIncome,
    totalDeduction,
    netSalary,
    coefficient: compensation.coefficient,
    payrollStatus,
    regionCode,
    minimumWageMonthly,
    minimumWageHourly,
    minimumWageViolation,
    insuranceEligible,
    missingCompensationRate: compensation.missingCompensationRate,
    missingTimesheetData: actualWorkDays > 0 && totalHours <= 0,
    policyCode: policy.policyCode,
    policyEffectiveFrom: policy.effectiveFrom,
    policyLegalReferences: Object.values(policy.legalReferences || {}),
  };
}
