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

  const referenceSalary = Number(policy.insurance.salaryCaps.socialAndHealthByReferenceSalary.amount || 0);
  const socialHealthCap = referenceSalary > 0 ? referenceSalary * 20 : Number.MAX_SAFE_INTEGER;
  const regionMinimum = Number(policy.minimumWageByRegion[regionCode]?.monthly || 0);
  const unemploymentCap = regionMinimum > 0
    ? regionMinimum * Number(policy.insurance.salaryCaps.unemploymentByRegionalMinimumWage || 20)
    : Number.MAX_SAFE_INTEGER;

  const insuranceBaseSalary = Math.max(0, Math.min(Number(baseSalary || 0), socialHealthCap, unemploymentCap));

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

export function computeOvertimeComponents({ aggregate, hourlyRate, settings, policy }) {
  const overtimeNormalHours = Number(aggregate?.overtimeNormalHours || 0);
  const overtimeWeekendHours = Number(aggregate?.overtimeWeekendHours || 0);
  const overtimeHolidayHours = Number(aggregate?.overtimeHolidayHours || 0);
  const nightHours = Number(aggregate?.nightHours || 0);
  const overtimeNightHours = Number(aggregate?.overtimeNightHours || 0);
  const overtimeHours = overtimeNormalHours + overtimeWeekendHours + overtimeHolidayHours;

  const overtimeNormal = overtimeNormalHours * hourlyRate * Number(settings?.overtimeMultiplierWeekday || policy.overtimeMultipliers.normalDay || 1.5);
  const overtimeWeekend = overtimeWeekendHours * hourlyRate * Number(settings?.overtimeMultiplierWeekend || policy.overtimeMultipliers.weekendDay || 2);
  const overtimeHoliday = overtimeHolidayHours * hourlyRate * Number(settings?.overtimeMultiplierHoliday || policy.overtimeMultipliers.holidayDay || 3);
  const nightShiftExtra = nightHours * hourlyRate * Number(settings?.nightShiftAllowanceRate ?? policy.overtimeMultipliers.nightWorkExtra ?? 0);

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
    overtimeNightExtra: 0,
    overtimeTotal: overtimeNormal + overtimeWeekend + overtimeHoliday + nightShiftExtra,
  };
}

export function normalizeSalaryType(value) {
  const salaryType = String(value || "monthly").trim().toLowerCase();
  return ["monthly", "hourly", "shift", "commission"].includes(salaryType)
    ? salaryType
    : "monthly";
}

export function buildPayrollItem({ staff, period, aggregate, regionCode, payrollStatus, settings = {} }) {
  const policy = getPayrollPolicyForDate(period.end);
  const baseSalary = Number(staff.baseSalary || 0);
  const salaryType = normalizeSalaryType(staff.salaryType);
  const workDays = Number(settings.standardWorkDaysPerMonth || period.calendarDays || policy.payrollDefaults.standardDaysPerMonth || 26);
  const standardHoursPerDay = Number(settings.standardHoursPerDay || policy.payrollDefaults.standardHoursPerDay || 8);
  const actualWorkDays = Number(aggregate.workedDateCount || 0);
  const totalHours = Math.max(Number(aggregate.totalHours || 0), 0);
  const scheduleShiftCount = Math.max(Number(aggregate.scheduleShiftCount || 0), 0);
  const totalAmount = Math.max(Number(aggregate.totalAmount || 0), 0);

  const dailyRate = workDays > 0 ? baseSalary / workDays : 0;
  const derivedHourlyRate = standardHoursPerDay > 0 ? dailyRate / standardHoursPerDay : 0;
  const configuredHourlyRate = Number(staff.hourlyRate || 0);
  const hourlyRate = configuredHourlyRate > 0 ? configuredHourlyRate : derivedHourlyRate;
  const salaryRateSource = configuredHourlyRate > 0
    ? "staff.hourlyRate"
    : "derived_from_base_salary";

  const overtimeBreakdown = computeOvertimeComponents({
    aggregate,
    hourlyRate,
    settings,
    policy,
  });
  const overtimeHours = Number(overtimeBreakdown.overtimeHours || 0);
  const regularHours = Math.max(totalHours - overtimeHours, 0);
  const commissionRate = Math.max(Number(staff.commissionRate || 0), 0);

  let baseWorkIncome = actualWorkDays * dailyRate;
  let salaryConfigurationIssue = null;
  if (salaryType === "hourly") {
    baseWorkIncome = regularHours * hourlyRate;
  } else if (salaryType === "shift") {
    const shiftRate = configuredHourlyRate > 0 ? configuredHourlyRate : dailyRate;
    baseWorkIncome = scheduleShiftCount * shiftRate;
  } else if (salaryType === "commission") {
    if (commissionRate > 0) {
      baseWorkIncome = totalAmount * (commissionRate / 100);
    } else {
      baseWorkIncome = 0;
      salaryConfigurationIssue = "COMMISSION_RATE_REQUIRED";
    }
  }

  const allowance = 0;
  const bonus = 0;
  const otherAddition = 0;

  const grossIncome =
    baseWorkIncome +
    overtimeBreakdown.overtimeNormal +
    overtimeBreakdown.overtimeWeekend +
    overtimeBreakdown.overtimeHoliday +
    overtimeBreakdown.nightShiftExtra;
  const totalIncome = grossIncome + allowance + bonus + otherAddition;

  const insuranceEligible = calculateInsuranceEligibility(staff, policy);
  const insurance = computeInsuranceDeductions({
    baseSalary,
    policy,
    regionCode,
    isEligible: insuranceEligible,
  });

  const deduction = 0;
  const otherDeduction = 0;
  const advance = 0;

  const taxFreeThreshold = Number(settings.personalIncomeTaxFreeThreshold || 0);
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

  const minWageMonthly = Number(policy.minimumWageByRegion[regionCode]?.monthly || 0);
  const minimumWageHourly = Number(policy.minimumWageByRegion[regionCode]?.hourly || 0);
  const minimumWageReference = salaryType === "monthly" ? baseSalary : hourlyRate;
  const minimumWageViolation =
    minimumWageReference > 0 &&
    (salaryType === "monthly"
      ? minimumWageReference < minWageMonthly
      : minimumWageReference < minimumWageHourly);

  return {
    baseSalary,
    salaryType,
    commissionRate,
    commissionableAmount: totalAmount,
    salaryRateSource,
    salaryConfigurationIssue,
    workDays,
    actualWorkDays,
    totalHours,
    regularHours,
    scheduleShiftCount,
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
    totalIncome,
    totalDeduction,
    netSalary,
    coefficient: salaryType === "monthly"
      ? (workDays > 0 ? actualWorkDays / workDays : 0)
      : salaryType === "shift"
        ? (workDays > 0 ? scheduleShiftCount / workDays : 0)
        : (workDays * standardHoursPerDay > 0
          ? totalHours / (workDays * standardHoursPerDay)
          : 0),
    payrollStatus,
    regionCode,
    minimumWageMonthly: minWageMonthly,
    minimumWageHourly,
    minimumWageViolation,
    insuranceEligible,
    missingTimesheetData: actualWorkDays > 0 && totalHours <= 0,
    policyCode: policy.policyCode,
    policyEffectiveFrom: policy.effectiveFrom,
    policyLegalReferences: Object.values(policy.legalReferences || {}),
  };
}
