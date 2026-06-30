import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

export const QUERY_OVERTIME_REQUESTS = gql`
  query OvertimeRequests($filter: OvertimeRequestFilterInput) {
    overtimeRequests(filter: $filter) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      employeeAvatar
      restaurantId
      shiftId
      timesheetId
      workDate

      plannedStartTime
      plannedEndTime
      plannedOvertimeMinutes

      actualStartTime
      actualEndTime
      actualOvertimeMinutes

      approvedOvertimeMinutes

      overtimeType
      reason
      status

      employeeConfirmationRequired
      employeeConfirmedAt
      employeeConfirmedBy
      employeeConfirmedByName
      employeeConfirmationNote

      requestedBy
      requestedByName
      requestedByRole
      requestedAt

      approvedBy
      approvedByName
      approvedAt
      approvalNote

      rejectedBy
      rejectedByName
      rejectedAt
      rejectionReason

      cancelledBy
      cancelledByName
      cancelledAt
      cancelReason

      completedBy
      completedByName
      completedAt
      completionNote

      payrollPeriodId
      createdAt
      updatedAt
    }
  }
`;

const OVERTIME_FIELDS = gql`
  fragment OvertimeFields on OvertimeRequest {
    id
    employeeId
    employeeName
    employeeCode
    employeeRole
    employeeAvatar
    restaurantId
    shiftId
    timesheetId
    workDate

    plannedStartTime
    plannedEndTime
    plannedOvertimeMinutes

    actualStartTime
    actualEndTime
    actualOvertimeMinutes

    approvedOvertimeMinutes

    overtimeType
    reason
    status

    employeeConfirmationRequired
    employeeConfirmedAt
    employeeConfirmedBy
    employeeConfirmedByName
    employeeConfirmationNote

    requestedBy
    requestedByName
    requestedByRole
    requestedAt

    approvedBy
    approvedByName
    approvedAt
    approvalNote

    rejectedBy
    rejectedByName
    rejectedAt
    rejectionReason

    cancelledBy
    cancelledByName
    cancelledAt
    cancelReason

    completedBy
    completedByName
    completedAt
    completionNote

    payrollPeriodId
    createdAt
    updatedAt
  }
`;

const MUTATION_CREATE_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation CreateOvertimeRequest($input: JSON) {
    createOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_CONFIRM_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation ConfirmOvertimeRequest($id: ID!) {
    confirmOvertimeRequest(id: $id) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_APPROVE_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation ApproveOvertimeRequest($input: JSON) {
    approveOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_REJECT_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation RejectOvertimeRequest($input: JSON) {
    rejectOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_CANCEL_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation CancelOvertimeRequest($id: ID!) {
    cancelOvertimeRequest(id: $id) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_COMPLETE_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation CompleteOvertimeRequest($id: ID!) {
    completeOvertimeRequest(id: $id) {
      ...OvertimeFields
    }
  }
`;

export const toOvertimeIsoStartOfDay = (value) =>
  value ? `${value}T00:00:00.000Z` : undefined;

export const toOvertimeIsoEndOfDay = (value) =>
  value ? `${value}T23:59:59.999Z` : undefined;

export const buildOvertimeFilter = ({
  selectedDate,
  startDate,
  endDate,
  status,
  overtimeType,
  restaurantId,
  employeeId,
  search,
}) => ({
  restaurantId: restaurantId || undefined,
  employeeId: employeeId || undefined,
  status: status && status !== "all" ? status : undefined,
  overtimeType:
    overtimeType && overtimeType !== "all" ? overtimeType : undefined,
  startDate:
    startDate ||
    (selectedDate ? toOvertimeIsoStartOfDay(selectedDate) : undefined),
  endDate:
    endDate || (selectedDate ? toOvertimeIsoEndOfDay(selectedDate) : undefined),
  search: search?.trim() || undefined,
});

const normalizeRequestIdInput = (value) => {
  if (!value || typeof value !== "object") return value;
  return value.id || value.requestId || value.input?.requestId || value;
};

const normalizeOvertimeReviewInput = (value) => {
  if (!value || typeof value !== "object") return value;
  return value.input || value;
};

export default function useOvertimeManagement({
  selectedDate,
  startDate,
  endDate,
  status = "all",
  overtimeType = "all",
  restaurantId,
  employeeId,
  search,
} = {}) {
  const filter = useMemo(
    () =>
      buildOvertimeFilter({
        selectedDate,
        startDate,
        endDate,
        status,
        overtimeType,
        restaurantId,
        employeeId,
        search,
      }),
    [
      employeeId,
      endDate,
      overtimeType,
      restaurantId,
      search,
      selectedDate,
      startDate,
      status,
    ],
  );

  const { data, loading, error, refetch } = useQuery(QUERY_OVERTIME_REQUESTS, {
    variables: { filter },
    fetchPolicy: "cache-and-network",
    skip: !filter.startDate || !filter.endDate,
  });

  const refetchAfter = {
    onCompleted: async () => {
      await refetch();
    },
  };

  const [runCreateOvertimeRequest, createState] = useMutation(
    MUTATION_CREATE_OVERTIME,
    refetchAfter,
  );

  const [runConfirmOvertimeRequest, confirmState] = useMutation(
    MUTATION_CONFIRM_OVERTIME,
    refetchAfter,
  );

  const [runApproveOvertimeRequest, approveState] = useMutation(
    MUTATION_APPROVE_OVERTIME,
    refetchAfter,
  );

  const [runRejectOvertimeRequest, rejectState] = useMutation(
    MUTATION_REJECT_OVERTIME,
    refetchAfter,
  );

  const [runCancelOvertimeRequest, cancelState] = useMutation(
    MUTATION_CANCEL_OVERTIME,
    refetchAfter,
  );

  const [runCompleteOvertimeRequest, completeState] = useMutation(
    MUTATION_COMPLETE_OVERTIME,
    refetchAfter,
  );

  const createOvertimeRequest = (options) =>
    runCreateOvertimeRequest({
      ...options,
      variables: { input: normalizeOvertimeReviewInput(options?.variables || options) },
    });

  const approveOvertimeRequest = (options) =>
    runApproveOvertimeRequest({
      ...options,
      variables: { input: normalizeOvertimeReviewInput(options?.variables || options) },
    });

  const rejectOvertimeRequest = (options) =>
    runRejectOvertimeRequest({
      ...options,
      variables: { input: normalizeOvertimeReviewInput(options?.variables || options) },
    });

  const confirmOvertimeRequest = (options) =>
    runConfirmOvertimeRequest({
      ...options,
      variables: { id: normalizeRequestIdInput(options?.variables || options) },
    });

  const cancelOvertimeRequest = (options) =>
    runCancelOvertimeRequest({
      ...options,
      variables: { id: normalizeRequestIdInput(options?.variables || options) },
    });

  const completeOvertimeRequest = (options) =>
    runCompleteOvertimeRequest({
      ...options,
      variables: { id: normalizeRequestIdInput(options?.variables || options) },
    });

  const overtimeRequests = useMemo(
    () => data?.overtimeRequests || [],
    [data?.overtimeRequests],
  );

  const stats = useMemo(() => {
    const total = overtimeRequests.length;
    const pendingEmployeeConfirmation = overtimeRequests.filter(
      (item) => item.status === "pending_employee_confirmation",
    ).length;
    const pendingApproval = overtimeRequests.filter(
      (item) => item.status === "pending_approval",
    ).length;
    const approved = overtimeRequests.filter(
      (item) => item.status === "approved",
    ).length;
    const completed = overtimeRequests.filter(
      (item) => item.status === "completed",
    ).length;
    const rejected = overtimeRequests.filter(
      (item) => item.status === "rejected",
    ).length;
    const cancelled = overtimeRequests.filter(
      (item) => item.status === "cancelled",
    ).length;

    const plannedMinutes = overtimeRequests.reduce(
      (sum, item) => sum + Number(item.plannedOvertimeMinutes || 0),
      0,
    );
    const approvedMinutes = overtimeRequests.reduce(
      (sum, item) => sum + Number(item.approvedOvertimeMinutes || 0),
      0,
    );

    return {
      total,
      pendingEmployeeConfirmation,
      pendingApproval,
      approved,
      completed,
      rejected,
      cancelled,
      plannedMinutes,
      approvedMinutes,
      plannedHours: Number((plannedMinutes / 60).toFixed(2)),
      approvedHours: Number((approvedMinutes / 60).toFixed(2)),
    };
  }, [overtimeRequests]);

  return {
    overtimeRequests,
    stats,
    loading,
    error,
    refetch,

    createOvertimeRequest,
    confirmOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    cancelOvertimeRequest,
    completeOvertimeRequest,

    createState,
    confirmState,
    approveState,
    rejectState,
    cancelState,
    completeState,
  };
}
