import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

export const QUERY_ATTENDANCE_PAGE = gql`
  query AttendancePageData(
    $restaurantId: ID
    $startDate: DateTime!
    $endDate: DateTime!
    $status: String
    $search: String
  ) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id
      fullName
      employeeCode
      positionTitle
      roleName
      avatarUrl
      restaurantForStaff
    }
    staffAttendanceRecords(
      restaurantId: $restaurantId
      startDate: $startDate
      endDate: $endDate
      status: $status
      search: $search
    ) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      employeeAvatar
      restaurantId
      workDate
      shiftId
      shiftType
      plannedStartTime
      plannedEndTime
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      hours
      latenessMinutes
      earlyLeaveMinutes
      overtimeMinutes
      approvedOvertimeMinutes
      overtimeApprovalStatus
      overtimeReviewNote
      overtimeReviewedBy
      overtimeReviewedAt
      status
      isOffSchedule
      source
      note
      approved
      createdAt
      updatedAt
    }
  }
`;

export const QUERY_ATTENDANCE_CORRECTIONS = gql`
  query AttendanceCorrectionRequests($filter: AttendanceCorrectionFilterInput) {
    attendanceCorrectionRequests(filter: $filter) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      employeeAvatar
      restaurantId
      timesheetId
      shiftId
      workDate
      correctionType
      status
      originalCheckInAt
      originalCheckOutAt
      requestedCheckInAt
      requestedCheckOutAt
      originalWorkedMinutes
      requestedWorkedMinutes
      originalLatenessMinutes
      requestedLatenessMinutes
      originalEarlyLeaveMinutes
      requestedEarlyLeaveMinutes
      originalOvertimeMinutes
      requestedOvertimeMinutes
      reason
      evidenceNote
      evidenceUrls
      requestedBy
      requestedByName
      requestedByRole
      requestedAt
      reviewedBy
      reviewedByName
      reviewedAt
      reviewNote
      rejectionReason
      appliedBy
      appliedByName
      appliedAt
      createdAt
      updatedAt
      auditLogs {
        action
        actorId
        actorName
        note
        at
        meta
      }
    }
  }
`;

export const ATTENDANCE_TIMEZONE_OFFSET = "+07:00";

export const toAttendanceIsoStartOfDay = (value) =>
  value ? `${value}T00:00:00.000${ATTENDANCE_TIMEZONE_OFFSET}` : null;

export const toAttendanceIsoEndOfDay = (value) =>
  value ? `${value}T23:59:59.999${ATTENDANCE_TIMEZONE_OFFSET}` : null;

export const buildAttendanceQueryVars = ({
  selectedDate,
  status,
  search,
  restaurantId,
}) => ({
  restaurantId: restaurantId || undefined,
  startDate: toAttendanceIsoStartOfDay(selectedDate),
  endDate: toAttendanceIsoEndOfDay(selectedDate),
  status: status === "all" ? undefined : status,
  search: search?.trim() || undefined,
});

export const buildAttendanceCorrectionFilter = ({
  selectedDate,
  correctionStatus,
  search,
  restaurantId,
  employeeId,
}) => ({
  restaurantId: restaurantId || undefined,
  employeeId: employeeId || undefined,
  status:
    correctionStatus && correctionStatus !== "all"
      ? correctionStatus
      : undefined,
  startDate: toAttendanceIsoStartOfDay(selectedDate),
  endDate: toAttendanceIsoEndOfDay(selectedDate),
  search: search?.trim() || undefined,
});

const MUTATION_UPSERT_ATTENDANCE = gql`
  mutation UpsertAttendance($input: UpsertStaffAttendanceInput!) {
    upsertStaffAttendance(input: $input) {
      id
      employeeId
      status
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      latenessMinutes
      earlyLeaveMinutes
      overtimeMinutes
      approvedOvertimeMinutes
      overtimeApprovalStatus
      overtimeReviewNote
      overtimeReviewedBy
      overtimeReviewedAt
      shiftId
      plannedStartTime
      plannedEndTime
      isOffSchedule
      note
      source
    }
  }
`;

const ATTENDANCE_CORRECTION_FIELDS = gql`
  fragment AttendanceCorrectionFields on AttendanceCorrectionRequest {
    id
    employeeId
    employeeName
    employeeCode
    employeeRole
    employeeAvatar
    restaurantId
    timesheetId
    shiftId
    workDate
    correctionType
    status
    originalCheckInAt
    originalCheckOutAt
    requestedCheckInAt
    requestedCheckOutAt
    originalWorkedMinutes
    requestedWorkedMinutes
    originalLatenessMinutes
    requestedLatenessMinutes
    originalEarlyLeaveMinutes
    requestedEarlyLeaveMinutes
    originalOvertimeMinutes
    requestedOvertimeMinutes
    reason
    evidenceNote
    evidenceUrls
    requestedBy
    requestedByName
    requestedByRole
    requestedAt
    reviewedBy
    reviewedByName
    reviewedAt
    reviewNote
    rejectionReason
    appliedBy
    appliedByName
    appliedAt
    createdAt
    updatedAt
  }
`;

const ATTENDANCE_OVERTIME_FIELDS = gql`
  fragment AttendanceOvertimeFields on StaffAttendanceRecord {
    id
    employeeId
    employeeName
    employeeCode
    employeeRole
    employeeAvatar
    restaurantId
    workDate
    shiftId
    shiftType
    plannedStartTime
    plannedEndTime
    actualCheckInAt
    actualCheckOutAt
    workedMinutes
    hours
    latenessMinutes
    earlyLeaveMinutes
    overtimeMinutes
    approvedOvertimeMinutes
    overtimeApprovalStatus
    overtimeReviewNote
    overtimeReviewedBy
    overtimeReviewedAt
    status
    isOffSchedule
    source
    note
    approved
    createdAt
    updatedAt
  }
`;

const MUTATION_CREATE_ATTENDANCE_CORRECTION = gql`
  ${ATTENDANCE_CORRECTION_FIELDS}
  mutation CreateAttendanceCorrectionRequest(
    $input: CreateAttendanceCorrectionRequestInput!
  ) {
    createAttendanceCorrectionRequest(input: $input) {
      ...AttendanceCorrectionFields
    }
  }
`;

const MUTATION_APPROVE_ATTENDANCE_CORRECTION = gql`
  ${ATTENDANCE_CORRECTION_FIELDS}
  mutation ApproveAttendanceCorrectionRequest(
    $input: ReviewAttendanceCorrectionRequestInput!
  ) {
    approveAttendanceCorrectionRequest(input: $input) {
      ...AttendanceCorrectionFields
    }
  }
`;

const MUTATION_REJECT_ATTENDANCE_CORRECTION = gql`
  ${ATTENDANCE_CORRECTION_FIELDS}
  mutation RejectAttendanceCorrectionRequest(
    $input: RejectAttendanceCorrectionRequestInput!
  ) {
    rejectAttendanceCorrectionRequest(input: $input) {
      ...AttendanceCorrectionFields
    }
  }
`;

const MUTATION_CANCEL_ATTENDANCE_CORRECTION = gql`
  ${ATTENDANCE_CORRECTION_FIELDS}
  mutation CancelAttendanceCorrectionRequest($requestId: ID!) {
    cancelAttendanceCorrectionRequest(requestId: $requestId) {
      ...AttendanceCorrectionFields
    }
  }
`;

const MUTATION_APPROVE_ATTENDANCE_OVERTIME = gql`
  ${ATTENDANCE_OVERTIME_FIELDS}
  mutation ApproveAttendanceOvertime($input: ApproveAttendanceOvertimeInput!) {
    approveAttendanceOvertime(input: $input) {
      ...AttendanceOvertimeFields
    }
  }
`;

const MUTATION_REJECT_ATTENDANCE_OVERTIME = gql`
  ${ATTENDANCE_OVERTIME_FIELDS}
  mutation RejectAttendanceOvertime($input: RejectAttendanceOvertimeInput!) {
    rejectAttendanceOvertime(input: $input) {
      ...AttendanceOvertimeFields
    }
  }
`;

export default function useAttendanceManagement({
  selectedDate,
  status,
  search,
  correctionStatus = "all",
  restaurantId,
  employeeId,
} = {}) {
  const queryVars = useMemo(
    () =>
      buildAttendanceQueryVars({
        selectedDate,
        status,
        search,
        restaurantId,
      }),
    [restaurantId, search, selectedDate, status],
  );

  const correctionFilter = useMemo(
    () =>
      buildAttendanceCorrectionFilter({
        selectedDate,
        correctionStatus,
        search,
        restaurantId,
        employeeId,
      }),
    [correctionStatus, employeeId, restaurantId, search, selectedDate],
  );

  const { data, loading, error, refetch } = useQuery(QUERY_ATTENDANCE_PAGE, {
    variables: queryVars,
    fetchPolicy: "cache-and-network",
    skip: !queryVars.startDate || !queryVars.endDate,
  });

  const {
    data: correctionData,
    loading: correctionsLoading,
    error: correctionsError,
    refetch: refetchCorrections,
  } = useQuery(QUERY_ATTENDANCE_CORRECTIONS, {
    variables: { filter: correctionFilter },
    fetchPolicy: "cache-and-network",
    skip: !correctionFilter.startDate || !correctionFilter.endDate,
  });

  const refreshAttendanceViews = async () =>
    Promise.allSettled([refetch(), refetchCorrections()]);

  const [mutateQuickAttendance, mutationState] = useMutation(
    MUTATION_UPSERT_ATTENDANCE,
  );

  const [createAttendanceCorrectionRequest, createCorrectionState] = useMutation(
    MUTATION_CREATE_ATTENDANCE_CORRECTION,
  );

  const [approveAttendanceCorrectionRequest, approveCorrectionState] =
    useMutation(MUTATION_APPROVE_ATTENDANCE_CORRECTION);

  const [rejectAttendanceCorrectionRequest, rejectCorrectionState] = useMutation(
    MUTATION_REJECT_ATTENDANCE_CORRECTION,
  );

  const [cancelAttendanceCorrectionRequest, cancelCorrectionState] =
    useMutation(MUTATION_CANCEL_ATTENDANCE_CORRECTION);

  const [approveAttendanceOvertime, approveOvertimeState] = useMutation(
    MUTATION_APPROVE_ATTENDANCE_OVERTIME,
  );

  const [rejectAttendanceOvertime, rejectOvertimeState] = useMutation(
    MUTATION_REJECT_ATTENDANCE_OVERTIME,
  );

  const employees = useMemo(() => data?.staffList || [], [data?.staffList]);

  const records = useMemo(
    () => data?.staffAttendanceRecords || [],
    [data?.staffAttendanceRecords],
  );

  const correctionRequests = useMemo(
    () => correctionData?.attendanceCorrectionRequests || [],
    [correctionData?.attendanceCorrectionRequests],
  );

  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter((record) =>
      Boolean(record.actualCheckInAt),
    ).length;
    const lateOrEarly = records.filter(
      (record) =>
        ["late", "early_leave", "late_early_leave"].includes(record.status) ||
        Number(record.latenessMinutes || 0) > 0 ||
        Number(record.earlyLeaveMinutes || 0) > 0,
    ).length;
    const absent = records.filter(
      (record) => record.status === "scheduled_absent",
    ).length;

    return { total, present, lateOrEarly, absent };
  }, [records]);

  const correctionStats = useMemo(() => {
    const total = correctionRequests.length;
    const pending = correctionRequests.filter(
      (item) => item.status === "pending",
    ).length;
    const applied = correctionRequests.filter(
      (item) => item.status === "applied",
    ).length;
    const rejected = correctionRequests.filter(
      (item) => item.status === "rejected",
    ).length;
    const cancelled = correctionRequests.filter(
      (item) => item.status === "cancelled",
    ).length;

    return { total, pending, applied, rejected, cancelled };
  }, [correctionRequests]);

  return {
    employees,
    records,
    correctionRequests,
    stats,
    correctionStats,

    loading,
    error,
    correctionsLoading,
    correctionsError,

    refetch,
    refetchCorrections,
    refreshAttendanceViews,

    mutateQuickAttendance,
    mutationState,

    createAttendanceCorrectionRequest,
    approveAttendanceCorrectionRequest,
    rejectAttendanceCorrectionRequest,
    cancelAttendanceCorrectionRequest,
    approveAttendanceOvertime,
    rejectAttendanceOvertime,

    createCorrectionState,
    approveCorrectionState,
    rejectCorrectionState,
    cancelCorrectionState,
    approveOvertimeState,
    rejectOvertimeState,
  };
}
