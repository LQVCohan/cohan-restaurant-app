import { gql, useMutation, useQuery } from "@apollo/client";
import { useContext, useMemo } from "react";
import { AttendanceScopeContext } from "@/context/AttendanceScopeContext";

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
      offScheduleApprovalStatus
      offScheduleReasonCategory
      offScheduleReason
      offScheduleReviewedBy
      offScheduleReviewedAt
      offScheduleReviewNote
      source
      note
      approved
      createdAt
      updatedAt
    }
  }
`;

export const QUERY_OFF_SCHEDULE_ATTENDANCES = gql`
  query OffScheduleAttendances($input: OffScheduleAttendanceFilterInput!) {
    offScheduleAttendances(input: $input) {
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
      offScheduleApprovalStatus
      offScheduleReasonCategory
      offScheduleReason
      offScheduleReviewedBy
      offScheduleReviewedAt
      offScheduleReviewNote
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

export const buildOffScheduleAttendanceFilter = ({
  selectedDate,
  restaurantId,
  employeeId,
  search,
  approvalStatus,
  onlyPending = true,
}) => ({
  restaurantId: restaurantId || undefined,
  employeeId: employeeId || undefined,
  startDate: toAttendanceIsoStartOfDay(selectedDate),
  endDate: toAttendanceIsoEndOfDay(selectedDate),
  approvalStatus:
    approvalStatus && approvalStatus !== "all" ? approvalStatus : undefined,
  onlyPending: Boolean(onlyPending),
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
      offScheduleApprovalStatus
      offScheduleReasonCategory
      offScheduleReason
      offScheduleReviewedBy
      offScheduleReviewedAt
      offScheduleReviewNote
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
    offScheduleApprovalStatus
    offScheduleReasonCategory
    offScheduleReason
    offScheduleReviewedBy
    offScheduleReviewedAt
    offScheduleReviewNote
    source
    note
    approved
    createdAt
    updatedAt
  }
`;

const OFF_SCHEDULE_ATTENDANCE_FIELDS = gql`
  fragment OffScheduleAttendanceFields on StaffAttendanceRecord {
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
    offScheduleApprovalStatus
    offScheduleReasonCategory
    offScheduleReason
    offScheduleReviewedBy
    offScheduleReviewedAt
    offScheduleReviewNote
    source
    note
    approved
    createdAt
    updatedAt
  }
`;

const MUTATION_APPROVE_OFF_SCHEDULE_ATTENDANCE = gql`
  ${OFF_SCHEDULE_ATTENDANCE_FIELDS}
  mutation ApproveOffScheduleAttendance($timesheetId: ID!, $note: String) {
    approveOffScheduleAttendance(timesheetId: $timesheetId, note: $note) {
      ...OffScheduleAttendanceFields
    }
  }
`;

const MUTATION_REJECT_OFF_SCHEDULE_ATTENDANCE = gql`
  ${OFF_SCHEDULE_ATTENDANCE_FIELDS}
  mutation RejectOffScheduleAttendance($timesheetId: ID!, $note: String) {
    rejectOffScheduleAttendance(timesheetId: $timesheetId, note: $note) {
      ...OffScheduleAttendanceFields
    }
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
  offScheduleApprovalStatus = "pending",
  restaurantId,
  employeeId,
} = {}) {
  const scopedRestaurantId = useContext(AttendanceScopeContext);
  const effectiveRestaurantId = restaurantId || scopedRestaurantId || undefined;

  const queryVars = useMemo(
    () =>
      buildAttendanceQueryVars({
        selectedDate,
        status,
        search,
        restaurantId: effectiveRestaurantId,
      }),
    [effectiveRestaurantId, search, selectedDate, status],
  );

  const correctionFilter = useMemo(
    () =>
      buildAttendanceCorrectionFilter({
        selectedDate,
        correctionStatus,
        search,
        restaurantId: effectiveRestaurantId,
        employeeId,
      }),
    [
      correctionStatus,
      effectiveRestaurantId,
      employeeId,
      search,
      selectedDate,
    ],
  );

  const offScheduleFilter = useMemo(
    () =>
      buildOffScheduleAttendanceFilter({
        selectedDate,
        restaurantId: effectiveRestaurantId,
        employeeId,
        search,
        approvalStatus: offScheduleApprovalStatus,
        onlyPending: offScheduleApprovalStatus === "pending",
      }),
    [
      effectiveRestaurantId,
      employeeId,
      offScheduleApprovalStatus,
      search,
      selectedDate,
    ],
  );

  const { data, loading, error, refetch } = useQuery(QUERY_ATTENDANCE_PAGE, {
    variables: queryVars,
    fetchPolicy: "cache-and-network",
    skip:
      !queryVars.restaurantId || !queryVars.startDate || !queryVars.endDate,
  });

  const {
    data: correctionData,
    loading: correctionsLoading,
    error: correctionsError,
    refetch: refetchCorrections,
  } = useQuery(QUERY_ATTENDANCE_CORRECTIONS, {
    variables: { filter: correctionFilter },
    fetchPolicy: "cache-and-network",
    skip:
      !correctionFilter.restaurantId ||
      !correctionFilter.startDate ||
      !correctionFilter.endDate,
  });

  const {
    data: offScheduleData,
    loading: offScheduleLoading,
    error: offScheduleError,
    refetch: refetchOffScheduleAttendances,
  } = useQuery(QUERY_OFF_SCHEDULE_ATTENDANCES, {
    variables: { input: offScheduleFilter },
    fetchPolicy: "cache-and-network",
    skip:
      !offScheduleFilter.restaurantId ||
      !offScheduleFilter.startDate ||
      !offScheduleFilter.endDate,
  });

  const refreshAttendanceViews = async () =>
    Promise.allSettled([
      refetch(),
      refetchCorrections(),
      refetchOffScheduleAttendances(),
    ]);

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

  const [approveOffScheduleAttendance, approveOffScheduleState] = useMutation(
    MUTATION_APPROVE_OFF_SCHEDULE_ATTENDANCE,
  );

  const [rejectOffScheduleAttendance, rejectOffScheduleState] = useMutation(
    MUTATION_REJECT_OFF_SCHEDULE_ATTENDANCE,
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

  const offScheduleRecords = useMemo(
    () => offScheduleData?.offScheduleAttendances || [],
    [offScheduleData?.offScheduleAttendances],
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

  const offScheduleStats = useMemo(() => {
    const total = offScheduleRecords.length;
    const pending = offScheduleRecords.filter(
      (item) => item.offScheduleApprovalStatus === "pending",
    ).length;
    const approved = offScheduleRecords.filter(
      (item) => item.offScheduleApprovalStatus === "approved",
    ).length;
    const rejected = offScheduleRecords.filter(
      (item) => item.offScheduleApprovalStatus === "rejected",
    ).length;

    return { total, pending, approved, rejected };
  }, [offScheduleRecords]);

  return {
    employees,
    records,
    correctionRequests,
    offScheduleRecords,
    stats,
    correctionStats,
    offScheduleStats,

    loading,
    error,
    correctionsLoading,
    correctionsError,
    offScheduleLoading,
    offScheduleError,

    refetch,
    refetchCorrections,
    refetchOffScheduleAttendances,
    refreshAttendanceViews,

    mutateQuickAttendance,
    mutationState,

    createAttendanceCorrectionRequest,
    approveAttendanceCorrectionRequest,
    rejectAttendanceCorrectionRequest,
    cancelAttendanceCorrectionRequest,
    approveAttendanceOvertime,
    rejectAttendanceOvertime,
    approveOffScheduleAttendance,
    rejectOffScheduleAttendance,

    createCorrectionState,
    approveCorrectionState,
    rejectCorrectionState,
    cancelCorrectionState,
    approveOvertimeState,
    rejectOvertimeState,
    approveOffScheduleState,
    rejectOffScheduleState,
  };
}
