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
  mutation CreateOvertimeRequest($input: CreateOvertimeRequestInput!) {
    createOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_CONFIRM_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation ConfirmOvertimeRequest($input: ConfirmOvertimeRequestInput!) {
    confirmOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_APPROVE_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation ApproveOvertimeRequest($input: ApproveOvertimeRequestInput!) {
    approveOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_REJECT_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation RejectOvertimeRequest($input: RejectOvertimeRequestInput!) {
    rejectOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_CANCEL_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation CancelOvertimeRequest($input: CancelOvertimeRequestInput!) {
    cancelOvertimeRequest(input: $input) {
      ...OvertimeFields
    }
  }
`;

const MUTATION_COMPLETE_OVERTIME = gql`
  ${OVERTIME_FIELDS}
  mutation CompleteOvertimeRequest($input: CompleteOvertimeRequestInput!) {
    completeOvertimeRequest(input: $input) {
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

  const [createOvertimeRequest, createState] = useMutation(
    MUTATION_CREATE_OVERTIME,
    refetchAfter,
  );

  const [confirmOvertimeRequest, confirmState] = useMutation(
    MUTATION_CONFIRM_OVERTIME,
    refetchAfter,
  );

  const [approveOvertimeRequest, approveState] = useMutation(
    MUTATION_APPROVE_OVERTIME,
    refetchAfter,
  );

  const [rejectOvertimeRequest, rejectState] = useMutation(
    MUTATION_REJECT_OVERTIME,
    refetchAfter,
  );

  const [cancelOvertimeRequest, cancelState] = useMutation(
    MUTATION_CANCEL_OVERTIME,
    refetchAfter,
  );

  const [completeOvertimeRequest, completeState] = useMutation(
    MUTATION_COMPLETE_OVERTIME,
    refetchAfter,
  );

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
