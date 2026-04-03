import { gql, useQuery } from "@apollo/client";

export const QUERY_STAFF_PAYROLL_OVERVIEW = gql`
  query StaffPayrollOverview(
    $startDate: DateTime!
    $endDate: DateTime!
    $restaurantId: ID
  ) {
    staffPayrollOverview(
      startDate: $startDate
      endDate: $endDate
      restaurantId: $restaurantId
    ) {
      stats {
        totalPayroll
        paidAmount
        remaining
        progress
      }
      items {
        id
        name
        code
        role
        department
        avatar
        baseSalary
        workDays
        actualWorkDays
        totalHours
        hourlyRate
        allowance
        bonus
        otherAddition
        overtime
        overtimeNormal
        overtimeWeekend
        overtimeHoliday
        nightShiftExtra
        overtimeHours
        overtimeNormalHours
        overtimeWeekendHours
        overtimeHolidayHours
        nightHours
        overtimeNightHours
        deduction
        otherDeduction
        advance
        insuranceSocial
        insuranceHealth
        insuranceUnemployment
        insuranceTotal
        insuranceEmployerTotal
        personalIncomeTax
        grossIncome
        coefficient
        totalIncome
        totalDeduction
        netSalary
        policyCode
        policyEffectiveFrom
        regionCode
        minimumWageMonthly
        minimumWageHourly
        minimumWageViolation
        insuranceEligible
        warningMessages
        status
      }
    }
  }
`;

const usePayroll = ({ startDate, endDate, restaurantId } = {}) => {
  const hasDateRange = Boolean(startDate && endDate);
  const { data, loading, error, refetch } = useQuery(QUERY_STAFF_PAYROLL_OVERVIEW, {
    variables: {
      startDate,
      endDate,
      restaurantId: restaurantId || undefined,
    },
    skip: !hasDateRange,
    fetchPolicy: "cache-and-network",
  });

  return {
    loading,
    error,
    refetch,
    payrollStats: data?.staffPayrollOverview?.stats || null,
    payrollItems: data?.staffPayrollOverview?.items || [],
  };
};

export default usePayroll;
