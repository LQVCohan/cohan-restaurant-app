import { gql, useMutation, useQuery } from "@apollo/client";

export const QUERY_PAYROLL_PERIODS = gql`
  query PayrollPeriods($restaurantId: ID, $limit: Int = 12) {
    payrollPeriods(restaurantId: $restaurantId, limit: $limit) {
      id
      name
      restaurantId
      startDate
      endDate
      status
      finalizedAt
      lockedAt
      paidAt
      stats {
        totalPayroll
        paidAmount
        remaining
        progress
      }
    }
  }
`;

export const QUERY_PAYROLL_PERIOD_DETAIL = gql`
  query PayrollPeriodDetail($periodId: ID!) {
    payrollPeriodDetail(periodId: $periodId) {
      period {
        id
        name
        restaurantId
        startDate
        endDate
        status
        finalizedAt
        lockedAt
        paidAt
        stats {
          totalPayroll
          paidAmount
          remaining
          progress
        }
      }
      settings {
        restaurantId
        currentPayrollPeriodId
        standardWorkDaysPerMonth
        standardHoursPerDay
        overtimeMultiplierWeekday
        overtimeMultiplierWeekend
        overtimeMultiplierHoliday
        latenessPenaltyPerMinute
        earlyLeavePenaltyPerMinute
        unpaidLeaveDeductionPerDay
        defaultAllowance
        allowPaidLeaveInWorkDays
        defaultBonus
        defaultDeduction
        notes
        updatedAt
      }
      stats {
        totalPayroll
        paidAmount
        remaining
        progress
      }
      items {
        id
        payrollItemId
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
        paidAt
        lateMinutes
        earlyLeaveMinutes
        unpaidLeaveDays
        paidLeaveDays
        scheduleShiftCount
        manualAdjustmentTotal
      }
    }
  }
`;

export const QUERY_PAYROLL_SETTINGS = gql`
  query PayrollSettings($restaurantId: ID) {
    payrollSettings(restaurantId: $restaurantId) {
      restaurantId
      currentPayrollPeriodId
      standardWorkDaysPerMonth
      standardHoursPerDay
      overtimeMultiplierWeekday
      overtimeMultiplierWeekend
      overtimeMultiplierHoliday
      latenessPenaltyPerMinute
      earlyLeavePenaltyPerMinute
      unpaidLeaveDeductionPerDay
      defaultAllowance
      allowPaidLeaveInWorkDays
      defaultBonus
      defaultDeduction
      notes
      updatedAt
    }
  }
`;

export const QUERY_PAYROLL_CONTEXT = gql`
  query PayrollContextMe {
    me {
      id
      restaurantForStaff
      primaryRestaurantId
    }
  }
`;

export const QUERY_STAFF_PAYROLL_OVERVIEW = gql`
  query StaffPayrollOverview(
    $startDate: DateTime!
    $endDate: DateTime!
    $restaurantId: ID
    $periodId: ID
  ) {
    staffPayrollOverview(
      startDate: $startDate
      endDate: $endDate
      restaurantId: $restaurantId
      periodId: $periodId
    ) {
      stats {
        totalPayroll
        paidAmount
        remaining
        progress
      }
      items {
        id
        payrollItemId
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
        paidAt
        lateMinutes
        earlyLeaveMinutes
        unpaidLeaveDays
        paidLeaveDays
        scheduleShiftCount
        manualAdjustmentTotal
      }
    }
  }
`;

export const MUT_CREATE_PERIOD = gql`
  mutation CreatePayrollPeriod($input: CreatePayrollPeriodInput!) {
    createPayrollPeriod(input: $input) {
      id
      status
      startDate
      endDate
      name
    }
  }
`;

export const MUT_RECALC_PERIOD = gql`
  mutation RecalculatePayrollPeriod($periodId: ID!) {
    recalculatePayrollPeriod(periodId: $periodId) {
      period {
        id
        status
      }
    }
  }
`;

export const MUT_FINALIZE_PERIOD = gql`
  mutation FinalizePayrollPeriod($periodId: ID!) {
    finalizePayrollPeriod(periodId: $periodId) {
      id
      status
      finalizedAt
    }
  }
`;

export const MUT_LOCK_PERIOD = gql`
  mutation LockPayrollPeriod($periodId: ID!) {
    lockPayrollPeriod(periodId: $periodId) {
      id
      status
      lockedAt
    }
  }
`;

export const MUT_MARK_PAID = gql`
  mutation MarkPayrollPeriodPaid($periodId: ID!, $employeeIds: [ID!]) {
    markPayrollPeriodPaid(periodId: $periodId, employeeIds: $employeeIds) {
      id
      status
      paidAt
    }
  }
`;

export const MUT_UPDATE_SETTINGS = gql`
  mutation UpdatePayrollSettings($input: PayrollSettingsInput!) {
    updatePayrollSettings(input: $input) {
      restaurantId
      currentPayrollPeriodId
      standardWorkDaysPerMonth
      standardHoursPerDay
      overtimeMultiplierWeekday
      overtimeMultiplierWeekend
      overtimeMultiplierHoliday
      latenessPenaltyPerMinute
      earlyLeavePenaltyPerMinute
      unpaidLeaveDeductionPerDay
      defaultAllowance
      allowPaidLeaveInWorkDays
      defaultBonus
      defaultDeduction
      notes
      updatedAt
    }
  }
`;

export const MUT_UPSERT_ADJUSTMENT = gql`
  mutation UpsertPayrollAdjustment($input: PayrollAdjustmentInput!) {
    upsertPayrollAdjustment(input: $input) {
      id
      name
      totalIncome
      totalDeduction
      netSalary
      manualAdjustmentTotal
    }
  }
`;

const usePayroll = ({ periodId, restaurantId, startDate, endDate } = {}) => {
  const periodsQuery = useQuery(QUERY_PAYROLL_PERIODS, {
    variables: { restaurantId: restaurantId || undefined, limit: 24 },
    fetchPolicy: "cache-and-network",
  });

  const settingsQuery = useQuery(QUERY_PAYROLL_SETTINGS, {
    variables: { restaurantId: restaurantId || undefined },
    fetchPolicy: "cache-and-network",
  });
  const meQuery = useQuery(QUERY_PAYROLL_CONTEXT, {
    fetchPolicy: "cache-first",
  });

  const appliedPeriodId =
    settingsQuery.data?.payrollSettings?.currentPayrollPeriodId ||
    periodsQuery.data?.payrollPeriods?.[0]?.id ||
    null;
  const effectivePeriodId = periodId || appliedPeriodId;

  const detailQuery = useQuery(QUERY_PAYROLL_PERIOD_DETAIL, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "cache-and-network",
  });
  const hasSnapshotItems = Boolean(detailQuery.data?.payrollPeriodDetail?.items?.length);
  const canQueryOverviewByRange = Boolean(startDate && endDate);
  const overviewQuery = useQuery(QUERY_STAFF_PAYROLL_OVERVIEW, {
    variables: {
      startDate,
      endDate,
      restaurantId: restaurantId || undefined,
      periodId: effectivePeriodId || undefined,
    },
    skip: !(effectivePeriodId || canQueryOverviewByRange) || hasSnapshotItems,
    fetchPolicy: "cache-and-network",
  });

  const [createPeriod] = useMutation(MUT_CREATE_PERIOD, {
    refetchQueries: [{ query: QUERY_PAYROLL_PERIODS, variables: { restaurantId: restaurantId || undefined, limit: 24 } }],
  });
  const [recalculatePeriod] = useMutation(MUT_RECALC_PERIOD);
  const [finalizePeriod] = useMutation(MUT_FINALIZE_PERIOD);
  const [lockPeriod] = useMutation(MUT_LOCK_PERIOD);
  const [markPaid] = useMutation(MUT_MARK_PAID);
  const [updateSettings] = useMutation(MUT_UPDATE_SETTINGS);
  const [upsertAdjustment] = useMutation(MUT_UPSERT_ADJUSTMENT);

  return {
    loading: periodsQuery.loading || detailQuery.loading || overviewQuery.loading,
    settingsLoading: settingsQuery.loading,
    error: periodsQuery.error || detailQuery.error || overviewQuery.error,
    settingsError: settingsQuery.error,
    periods: periodsQuery.data?.payrollPeriods || [],
    currentPeriodId: appliedPeriodId,
    periodDetail: detailQuery.data?.payrollPeriodDetail || null,
    payrollStats:
      detailQuery.data?.payrollPeriodDetail?.stats ||
      overviewQuery.data?.staffPayrollOverview?.stats ||
      null,
    payrollItems:
      detailQuery.data?.payrollPeriodDetail?.items?.length
        ? detailQuery.data?.payrollPeriodDetail?.items
        : (overviewQuery.data?.staffPayrollOverview?.items || []),
    payrollSettings:
      settingsQuery.data?.payrollSettings ||
      detailQuery.data?.payrollPeriodDetail?.settings ||
      null,
    resolvedRestaurantId:
      restaurantId ||
      settingsQuery.data?.payrollSettings?.restaurantId ||
      periodsQuery.data?.payrollPeriods?.[0]?.restaurantId ||
      meQuery.data?.me?.restaurantForStaff ||
      meQuery.data?.me?.primaryRestaurantId ||
      null,
    refetchPeriods: periodsQuery.refetch,
    refetchDetail: detailQuery.refetch,
    refetchSettings: settingsQuery.refetch,
    createPeriod,
    recalculatePeriod,
    finalizePeriod,
    lockPeriod,
    markPaid,
    updateSettings,
    upsertAdjustment,
  };
};

export default usePayroll;
