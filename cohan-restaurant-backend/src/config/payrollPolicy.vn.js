export const PAYROLL_VN_DEFAULT_REGION = "I";

// Policy values are intentionally centralized and versioned by effective date.
// Update this file when legal documents change.
export const PAYROLL_VN_POLICY_VERSIONS = [
  {
    policyCode: "VN_PAYROLL_V1",
    effectiveFrom: "2024-07-01",
    legalReferences: {
      laborCode: "Bộ luật Lao động 2019 (Điều 98)",
      minimumWage: "Nghị định 74/2024/NĐ-CP",
      socialInsurance: "Luật BHXH 2024 (hiệu lực 01/07/2025)",
      healthInsurance: "Luật BHYT 2008, sửa đổi bổ sung",
      unemploymentInsurance: "Luật Việc làm 2013",
    },
    minimumWageByRegion: {
      I: { monthly: 4960000, hourly: 23800 },
      II: { monthly: 4410000, hourly: 21200 },
      III: { monthly: 3860000, hourly: 18600 },
      IV: { monthly: 3450000, hourly: 16600 },
    },
    overtimeMultipliers: {
      normalDay: 1.5,
      weekendDay: 2,
      holidayDay: 3,
      nightWorkExtra: 0.3,
      overtimeAtNightExtra: 0.2,
    },
    insurance: {
      employee: {
        social: 0.08,
        health: 0.015,
        unemployment: 0.01,
      },
      employer: {
        socialRetirementAndSurvivorship: 0.14,
        socialSicknessAndMaternity: 0.03,
        workAccidentAndOccupationalDisease: 0.005,
        health: 0.03,
        unemployment: 0.01,
      },
      salaryCaps: {
        // For BHXH/BHYT, cap = 20 × reference salary.
        socialAndHealthByReferenceSalary: {
          amount: 2340000,
          effectiveFrom: "2024-07-01",
          source: "Nghị định 73/2024/NĐ-CP",
        },
        // For BHTN, cap = 20 × regional minimum wage.
        unemploymentByRegionalMinimumWage: 20,
      },
    },
    insuranceEligibility: {
      includedEmploymentTypes: ["full_time", "contract"],
      excludedEmploymentTypes: ["probation", "seasonal", "part_time"],
      includedEmploymentStatuses: ["working", "on_leave"],
    },
    payrollDefaults: {
      standardHoursPerDay: 8,
      standardDaysPerMonth: 26,
      defaultPayrollStatus: "draft",
      personalIncomeTaxEnabled: false,
      weekendDays: ["SUN"],
      holidayDates: [],
      nightShiftStart: "22:00",
      nightShiftEnd: "06:00",
      nightShiftAllowanceRate: 0.3,
    },
  },
];

export function getPayrollPolicyForDate(targetDate = new Date()) {
  const target = new Date(targetDate);
  const sorted = [...PAYROLL_VN_POLICY_VERSIONS].sort(
    (a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom),
  );

  let active = sorted[0] || null;
  for (const policy of sorted) {
    if (new Date(policy.effectiveFrom) <= target) {
      active = policy;
    }
  }
  return active;
}
