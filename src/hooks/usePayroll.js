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
        weekendDays
        holidayDates
        nightShiftStart
        nightShiftEnd
        nightShiftAllowanceRate
        enablePersonalIncomeTax
        personalIncomeTaxRate
        personalIncomeTaxFreeThreshold
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
        paidAmount
        remainingAmount
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
      weekendDays
      holidayDates
      nightShiftStart
      nightShiftEnd
      nightShiftAllowanceRate
      enablePersonalIncomeTax
      personalIncomeTaxRate
      personalIncomeTaxFreeThreshold
      notes
      updatedAt
    }
  }
`;

export const QUERY_VALIDATE_PAYROLL_PERIOD = gql`
  query ValidatePayrollPeriod($periodId: ID!) {
    validatePayrollPeriod(periodId: $periodId) {
      periodId
      status
      errorCount
      warningCount
      issues {
        code
        severity
        message
        employeeId
        employeeName
        employeeCode
        sourceType
        sourceId
        suggestedAction
      }
    }
  }
`;

const PAYROLL_READINESS_ISSUE_FIELDS = gql`
  fragment PayrollReadinessIssueFields on PayrollReadinessIssue {
    code
    severity
    message
    employeeId
    employeeName
    employeeCode
    sourceType
    sourceId
    suggestedAction
    targetRoute
  }
`;

export const QUERY_PAYROLL_READINESS = gql`
  ${PAYROLL_READINESS_ISSUE_FIELDS}
  query PayrollReadiness($periodId: ID!) {
    payrollReadiness(periodId: $periodId) {
      periodId
      restaurantId
      status
      readyToFinalize
      blockingCount
      warningCount
      sections {
        schedule {
          status
          blockingCount
          warningCount
          metrics
          issues {
            ...PayrollReadinessIssueFields
          }
        }
        attendance {
          status
          blockingCount
          warningCount
          metrics
          issues {
            ...PayrollReadinessIssueFields
          }
        }
        approvals {
          status
          blockingCount
          warningCount
          metrics
          issues {
            ...PayrollReadinessIssueFields
          }
        }
        payroll {
          status
          blockingCount
          warningCount
          metrics
          issues {
            ...PayrollReadinessIssueFields
          }
        }
      }
      issues {
        ...PayrollReadinessIssueFields
      }
    }
  }
`;

export const QUERY_MY_PAYSLIPS = gql`
  query MyPayslips($limit: Int = 12) {
    myPayslips(limit: $limit) {
      id
      payrollItemId
      periodId
      periodName
      periodStartDate
      periodEndDate
      periodStatus
      periodFinalizedAt
      name
      code
      role
      department
      totalIncome
      totalDeduction
      netSalary
      paidAmount
      remainingAmount
      status
      paidAt
      warningMessages
    }
  }
`;

export const QUERY_MY_PAYSLIP = gql`
  query MyPayslip($periodId: ID!) {
    myPayslip(periodId: $periodId) {
      period { id name startDate endDate status finalizedAt lockedAt paidAt stats { totalPayroll paidAmount remaining progress } }
      employee { id name code role department avatar }
      item {
        id payrollItemId name code role department baseSalary actualWorkDays totalHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours allowance bonus deduction advance insuranceTotal personalIncomeTax totalIncome totalDeduction netSalary paidAmount remainingAmount status paidAt warningMessages
      }
      breakdown {
        baseSalary actualWorkDays totalHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours allowance bonus deduction advance insuranceTotal personalIncomeTax totalIncome totalDeduction netSalary
      }
      payments { id periodId restaurantId employeeId payrollItemId amount method paidAt note referenceCode payoutId createdBy createdAt }
      remainingAmount
      canMarkPaid
      canEdit
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

export const MUT_MARK_PAYROLL_ITEM_PAID = gql`
  mutation MarkPayrollItemPaid($input: MarkPayrollItemPaidInput!) {
    markPayrollItemPaid(input: $input) {
      id
      payrollItemId
      status
      paidAmount
      remainingAmount
      paidAt
      netSalary
    }
  }
`;

export const MUT_BATCH_MARK_PAYROLL_PAID = gql`
  mutation BatchMarkPayrollPaid($input: BatchMarkPayrollPaidInput!) {
    batchMarkPayrollPaid(input: $input) {
      successCount
      failedCount
      items {
        id
        payrollItemId
        status
        paidAmount
        remainingAmount
        paidAt
        netSalary
      }
      errors {
        employeeId
        code
        message
      }
    }
  }
`;

export const MUT_CREATE_PAYROLL_PAYOUT = gql`
  mutation CreatePayrollPayout($input: PayrollPayoutInput!) {
    createPayrollPayout(input: $input) {
      id
      status
      amount
      provider
      failureReason
      providerTransactionId
      paidAt
      employeeId
      payrollItemId
    }
  }
`;


export const MUT_CREATE_PAYROLL_BATCH_PAYOUT = gql`
  mutation CreatePayrollBatchPayout($input: PayrollBatchPayoutInput!) {
    createPayrollBatchPayout(input: $input) {
      successCount
      processingCount
      failedCount
      payouts { id status amount employeeId failureReason }
      errors { employeeId code message }
      batch { id status successCount processingCount failedCount totalAmount }
    }
  }
`;

export const MUT_RETRY_PAYROLL_PAYOUT = gql`
  mutation RetryPayrollPayout($payoutId: ID!, $idempotencyKey: String) {
    retryPayrollPayout(payoutId: $payoutId, idempotencyKey: $idempotencyKey) {
      id
      status
      failureReason
      retryCount
    }
  }
`;

export const MUT_CANCEL_PAYROLL_PAYOUT = gql`
  mutation CancelPayrollPayout($payoutId: ID!, $reason: String!) {
    cancelPayrollPayout(payoutId: $payoutId, reason: $reason) {
      id
      status
      failureReason
    }
  }
`;

export const MUT_APPLY_PAYROLL_PAYOUT_RESULT = gql`
  mutation ApplyPayrollPayoutResult($input: PayrollPayoutResultInput!) {
    applyPayrollPayoutResult(input: $input) {
      id
      status
      failureReason
      providerTransactionId
      paidAt
    }
  }
`;

export const MUT_UPSERT_EMPLOYEE_BANK_ACCOUNT = gql`
  mutation UpsertEmployeeBankAccount($input: EmployeeBankAccountInput!) {
    upsertEmployeeBankAccount(input: $input) {
      id
      employeeId
      accountHolderName
      bankName
      bankCode
      accountNumberMasked
      accountNumberLast4
      branchName
      isDefault
      verificationStatus
    }
  }
`;

export const MUT_VERIFY_EMPLOYEE_BANK_ACCOUNT = gql`
  mutation VerifyEmployeeBankAccount($employeeId: ID!, $restaurantId: ID!, $verificationStatus: String = "verified") {
    verifyEmployeeBankAccount(employeeId: $employeeId, restaurantId: $restaurantId, verificationStatus: $verificationStatus) {
      id
      employeeId
      accountNumberMasked
      verificationStatus
    }
  }
`;

export const MUT_UPSERT_RESTAURANT_PAYOUT_ACCOUNT = gql`
  mutation UpsertRestaurantPayoutAccount($input: RestaurantPayoutAccountInput!) {
    upsertRestaurantPayoutAccount(input: $input) {
      id
      accountName
      bankName
      bankCode
      accountNumberMasked
      status
      payoutEnabled
      provider
      dailyLimit
      perTransactionLimit
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
      weekendDays
      holidayDates
      nightShiftStart
      nightShiftEnd
      nightShiftAllowanceRate
      enablePersonalIncomeTax
      personalIncomeTaxRate
      personalIncomeTaxFreeThreshold
      notes
      updatedAt
    }
  }
`;


export const QUERY_PAYROLL_CONTEXT = gql`
  query PayrollContext {
    me {
      id
      restaurantForStaff
      roleName
    }
  }
`;



export const QUERY_STAFF_PAYROLL_OVERVIEW = gql`
  query StaffPayrollOverview($startDate: DateTime!, $endDate: DateTime!, $restaurantId: ID, $periodId: ID) {
    staffPayrollOverview(startDate: $startDate, endDate: $endDate, restaurantId: $restaurantId, periodId: $periodId) {
      stats { totalPayroll paidAmount remaining progress }
      items {
        id payrollItemId name code role department avatar baseSalary workDays actualWorkDays totalHours hourlyRate allowance bonus otherAddition overtime overtimeNormal overtimeWeekend overtimeHoliday nightShiftExtra overtimeHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours overtimeNightHours deduction otherDeduction advance insuranceSocial insuranceHealth insuranceUnemployment insuranceTotal insuranceEmployerTotal personalIncomeTax grossIncome coefficient totalIncome totalDeduction netSalary policyCode policyEffectiveFrom regionCode minimumWageMonthly minimumWageHourly minimumWageViolation insuranceEligible warningMessages status paidAmount remainingAmount paidAt lateMinutes earlyLeaveMinutes unpaidLeaveDays paidLeaveDays scheduleShiftCount manualAdjustmentTotal
      }
    }
  }
`;

export const QUERY_PAYROLL_PAYSLIP = gql`
  query PayrollPayslip($periodId: ID!, $employeeId: ID!) {
    payrollPayslip(periodId: $periodId, employeeId: $employeeId) {
      period { id name startDate endDate status finalizedAt lockedAt paidAt stats { totalPayroll paidAmount remaining progress } }
      employee { id name code role department avatar }
      item {
        id payrollItemId name code role department baseSalary actualWorkDays totalHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours allowance bonus deduction advance insuranceTotal personalIncomeTax totalIncome totalDeduction netSalary paidAmount remainingAmount status paidAt
      }
      breakdown {
        baseSalary actualWorkDays totalHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours allowance bonus deduction advance insuranceTotal personalIncomeTax totalIncome totalDeduction netSalary
      }
      payments { id periodId restaurantId employeeId payrollItemId amount method paidAt note referenceCode payoutId createdBy createdAt }
      remainingAmount
      canMarkPaid
      canEdit
    }
  }
`;

export const QUERY_PAYROLL_PAYMENTS = gql`
  query PayrollPayments($periodId: ID!, $employeeId: ID) {
    payrollPayments(periodId: $periodId, employeeId: $employeeId) {
      id periodId restaurantId employeeId payrollItemId amount method paidAt note referenceCode createdBy createdAt
    }
  }
`;

export const QUERY_PAYROLL_EXPORT_ROWS = gql`
  query PayrollExportRows($periodId: ID!) {
    payrollExportRows(periodId: $periodId) {
      employeeId employeeCode employeeName department role baseSalary actualWorkDays totalHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours grossIncome allowance bonus deduction insuranceTotal personalIncomeTax netSalary paidAmount remainingAmount status
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

export const MUT_DELETE_ADJUSTMENT = gql`
  mutation DeletePayrollAdjustment(
    $periodId: ID!
    $employeeId: ID!
    $adjustmentId: ID!
  ) {
    deletePayrollAdjustment(
      periodId: $periodId
      employeeId: $employeeId
      adjustmentId: $adjustmentId
    ) {
      id
      totalIncome
      totalDeduction
      netSalary
      manualAdjustmentTotal
    }
  }
`;

const noopPayrollMutation = () => Promise.resolve({});
const safeUseMutation = (...args) => useMutation(...args) || [noopPayrollMutation];

const createPayrollNotReadyError = () => {
  const error = new Error("PAYROLL_PERIOD_NOT_READY");
  error.code = "PAYROLL_PERIOD_NOT_READY";
  return error;
};

const usePayroll = ({ periodId, restaurantId, startDate, endDate } = {}) => {
  const periodsQuery = useQuery(QUERY_PAYROLL_PERIODS, {
    variables: { restaurantId: restaurantId || undefined, limit: 24 },
    fetchPolicy: "cache-and-network",
  }) || {};

  const settingsQuery = useQuery(QUERY_PAYROLL_SETTINGS, {
    variables: { restaurantId: restaurantId || undefined },
    fetchPolicy: "cache-and-network",
  }) || {};
  const meQuery = useQuery(QUERY_PAYROLL_CONTEXT, {
    fetchPolicy: "cache-first",
  }) || {};

  const appliedPeriodId =
    settingsQuery.data?.payrollSettings?.currentPayrollPeriodId ||
    periodsQuery.data?.payrollPeriods?.[0]?.id ||
    null;
  const effectivePeriodId = periodId || appliedPeriodId;

  const detailQuery = useQuery(QUERY_PAYROLL_PERIOD_DETAIL, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "cache-and-network",
  }) || {};
  const validationQuery = useQuery(QUERY_VALIDATE_PAYROLL_PERIOD, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "network-only",
  }) || {};
  const readinessQuery = useQuery(QUERY_PAYROLL_READINESS, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "network-only",
  }) || {};
  const payslipQuery = useQuery(QUERY_PAYROLL_PAYSLIP, {
    variables: { periodId: effectivePeriodId, employeeId: undefined },
    skip: true,
    fetchPolicy: "network-only",
  }) || {};
  const paymentsQuery = useQuery(QUERY_PAYROLL_PAYMENTS, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "cache-and-network",
  }) || {};
  const exportRowsQuery = useQuery(QUERY_PAYROLL_EXPORT_ROWS, {
    variables: { periodId: effectivePeriodId },
    skip: !effectivePeriodId,
    fetchPolicy: "cache-and-network",
  }) || {};
  const hasSnapshotItems = Boolean(
    detailQuery.data?.payrollPeriodDetail?.items?.length,
  );
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
  }) || {};

  const [createPeriod] = safeUseMutation(MUT_CREATE_PERIOD, {
    refetchQueries: [
      {
        query: QUERY_PAYROLL_PERIODS,
        variables: { restaurantId: restaurantId || undefined, limit: 24 },
      },
    ],
  });
  const [recalculatePeriod] = safeUseMutation(MUT_RECALC_PERIOD);
  const [finalizePeriodMutation] = safeUseMutation(MUT_FINALIZE_PERIOD);
  const [lockPeriod] = safeUseMutation(MUT_LOCK_PERIOD);
  const [markPaid] = safeUseMutation(MUT_MARK_PAID);
  const [markPayrollItemPaidMutation] = safeUseMutation(MUT_MARK_PAYROLL_ITEM_PAID);
  const [batchMarkPayrollPaidMutation] = safeUseMutation(
    MUT_BATCH_MARK_PAYROLL_PAID,
  );
  const [createPayrollPayoutMutation] = safeUseMutation(MUT_CREATE_PAYROLL_PAYOUT);
  const [createPayrollBatchPayoutMutation] = safeUseMutation(MUT_CREATE_PAYROLL_BATCH_PAYOUT);
  const [retryPayrollPayoutMutation] = safeUseMutation(MUT_RETRY_PAYROLL_PAYOUT);
  const [cancelPayrollPayoutMutation] = safeUseMutation(MUT_CANCEL_PAYROLL_PAYOUT);
  const [applyPayrollPayoutResultMutation] = safeUseMutation(MUT_APPLY_PAYROLL_PAYOUT_RESULT);
  const [upsertEmployeeBankAccountMutation] = safeUseMutation(MUT_UPSERT_EMPLOYEE_BANK_ACCOUNT);
  const [verifyEmployeeBankAccountMutation] = safeUseMutation(MUT_VERIFY_EMPLOYEE_BANK_ACCOUNT);
  const [upsertRestaurantPayoutAccountMutation] = safeUseMutation(MUT_UPSERT_RESTAURANT_PAYOUT_ACCOUNT);
  const [updateSettings] = safeUseMutation(MUT_UPDATE_SETTINGS);
  const [upsertAdjustment] = safeUseMutation(MUT_UPSERT_ADJUSTMENT);
  const [deleteAdjustment] = safeUseMutation(MUT_DELETE_ADJUSTMENT);

  const finalizePeriod = async (options = {}) => {
    const requestedPeriodId = options?.variables?.periodId || effectivePeriodId;
    if (requestedPeriodId && readinessQuery.refetch) {
      const latestReadinessResult = await readinessQuery.refetch({
        periodId: requestedPeriodId,
      });
      const latestReadiness = latestReadinessResult?.data?.payrollReadiness;
      if (latestReadiness?.readyToFinalize === false) {
        throw createPayrollNotReadyError();
      }
    }
    return finalizePeriodMutation(options);
  };

  const markPayrollItemPaid = (inputOrOptions) => {
    if (inputOrOptions?.variables)
      return markPayrollItemPaidMutation(inputOrOptions);
    return markPayrollItemPaidMutation({
      variables: { input: inputOrOptions },
    });
  };

  const batchMarkPayrollPaid = (inputOrOptions) => {
    if (inputOrOptions?.variables)
      return batchMarkPayrollPaidMutation(inputOrOptions);
    return batchMarkPayrollPaidMutation({
      variables: { input: inputOrOptions },
    });
  };


  const createPayrollPayout = (inputOrOptions) => {
    if (inputOrOptions?.variables) return createPayrollPayoutMutation(inputOrOptions);
    return createPayrollPayoutMutation({ variables: { input: inputOrOptions } });
  };

  const createPayrollBatchPayout = (inputOrOptions) => {
    if (inputOrOptions?.variables) return createPayrollBatchPayoutMutation(inputOrOptions);
    return createPayrollBatchPayoutMutation({ variables: { input: inputOrOptions } });
  };

  const retryPayrollPayout = (variablesOrOptions) => {
    if (variablesOrOptions?.variables) return retryPayrollPayoutMutation(variablesOrOptions);
    return retryPayrollPayoutMutation({ variables: variablesOrOptions });
  };

  const cancelPayrollPayout = (variablesOrOptions) => {
    if (variablesOrOptions?.variables) return cancelPayrollPayoutMutation(variablesOrOptions);
    return cancelPayrollPayoutMutation({ variables: variablesOrOptions });
  };

  const applyPayrollPayoutResult = (inputOrOptions) => {
    if (inputOrOptions?.variables) return applyPayrollPayoutResultMutation(inputOrOptions);
    return applyPayrollPayoutResultMutation({ variables: { input: inputOrOptions } });
  };

  const upsertEmployeeBankAccount = (inputOrOptions) => {
    if (inputOrOptions?.variables) return upsertEmployeeBankAccountMutation(inputOrOptions);
    return upsertEmployeeBankAccountMutation({ variables: { input: inputOrOptions } });
  };

  const verifyEmployeeBankAccount = (variablesOrOptions) => {
    if (variablesOrOptions?.variables) return verifyEmployeeBankAccountMutation(variablesOrOptions);
    return verifyEmployeeBankAccountMutation({ variables: variablesOrOptions });
  };

  const upsertRestaurantPayoutAccount = (inputOrOptions) => {
    if (inputOrOptions?.variables) return upsertRestaurantPayoutAccountMutation(inputOrOptions);
    return upsertRestaurantPayoutAccountMutation({ variables: { input: inputOrOptions } });
  };

  return {
    loading:
      periodsQuery.loading || detailQuery.loading || overviewQuery.loading,
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
    payrollItems: detailQuery.data?.payrollPeriodDetail?.items?.length
      ? detailQuery.data?.payrollPeriodDetail?.items
      : overviewQuery.data?.staffPayrollOverview?.items || [],
    payrollSettings:
      settingsQuery.data?.payrollSettings ||
      detailQuery.data?.payrollPeriodDetail?.settings ||
      null,
    resolvedRestaurantId:
      restaurantId ||
      settingsQuery.data?.payrollSettings?.restaurantId ||
      periodsQuery.data?.payrollPeriods?.[0]?.restaurantId ||
      meQuery.data?.me?.restaurantForStaff ||
      null,
    refetchPeriods: periodsQuery.refetch,
    refetchPayrollPeriods: periodsQuery.refetch,
    refetchDetail: detailQuery.refetch,
    refetchPayrollPeriodDetail: detailQuery.refetch,
    refetchSettings: settingsQuery.refetch,
    validationResult: validationQuery.data?.validatePayrollPeriod || null,
    payrollReadiness: readinessQuery.data?.payrollReadiness || null,
    readinessLoading: readinessQuery.loading,
    readinessError: readinessQuery.error,
    payrollPayslip: payslipQuery.data?.payrollPayslip || null,
    payrollPayments: paymentsQuery.data?.payrollPayments || [],
    payrollExportRows: exportRowsQuery.data?.payrollExportRows || [],
    refetchValidation: validationQuery.refetch,
    refetchPayrollReadiness: readinessQuery.refetch,
    refetchReadiness: readinessQuery.refetch,
    refetchPayrollPayslip: payslipQuery.refetch,
    refetchPayrollPayments: paymentsQuery.refetch,
    refetchPayrollExportRows: exportRowsQuery.refetch,
    createPeriod,
    recalculatePeriod,
    finalizePeriod,
    lockPeriod,
    markPaid,
    markPayrollItemPaid,
    batchMarkPayrollPaid,
    createPayrollPayout,
    createPayrollBatchPayout,
    retryPayrollPayout,
    cancelPayrollPayout,
    applyPayrollPayoutResult,
    upsertEmployeeBankAccount,
    verifyEmployeeBankAccount,
    upsertRestaurantPayoutAccount,
    updateSettings,
    upsertAdjustment,
    deleteAdjustment,
  };
};

export default usePayroll;
