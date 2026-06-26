import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

const LEAVE_REQUEST_SELECTION = `
  id
  employeeId
  employeeName
  employeeCode
  employeeRole
  employeeAvatar
  restaurantId
  leaveType
  startDate
  endDate
  startSession
  endSession
  requestedDays
  requestedHours
  reason
  status
  approverId
  approverName
  approvedAt
  rejectedAt
  rejectionReason
  replacementManagerId
  replacementManagerName
  replacementStatus
  replacementConfirmedAt
  replacementConfirmedBy
  payrollFlags {
    isPaidLeave
    deductLeaveBalance
    payrollCountable
    halfDayFactor
    maternityTreatment
    holidayTreatment
    compensatoryTreatment
    unpaidFactor
  }
  quotaImpact {
    deductAnnualDays
    deductSickDays
    deductCompensatoryDays
    totalDeductDays
  }
  auditLogs {
    action
    actorId
    actorName
    note
    at
  }
  createdAt
  updatedAt
`;

export const Q_LEAVE_PAGE = gql`
  query LeavePageData($restaurantId: ID!, $filter: LeaveRequestFilterInput) {
    staffList(restaurantId: $restaurantId) {
      id
      fullName
      employeeCode
      positionTitle
      roleName
      department
      avatarUrl
      restaurantForStaff
    }
    leaveRequests(filter: $filter) {
      ${LEAVE_REQUEST_SELECTION}
    }
  }
`;

export const Q_STAFF_LEAVE_PAGE = gql`
  query StaffLeavePageData($filter: LeaveRequestFilterInput) {
    leaveRequests(filter: $filter) {
      ${LEAVE_REQUEST_SELECTION}
    }
  }
`;

const M_CREATE = gql`
  mutation CreateLeave($input: CreateLeaveRequestInput!) {
    createLeaveRequest(input: $input) {
      id
      status
      replacementStatus
    }
  }
`;

const M_APPROVE = gql`
  mutation ApproveLeave($requestId: ID!, $note: String) {
    approveLeaveRequest(requestId: $requestId, note: $note) {
      id
      status
      approvedAt
    }
  }
`;

const M_REJECT = gql`
  mutation RejectLeave($requestId: ID!, $reason: String!) {
    rejectLeaveRequest(requestId: $requestId, reason: $reason) {
      id
      status
      rejectedAt
      rejectionReason
    }
  }
`;

const M_CONFIRM_REPLACEMENT = gql`
  mutation ConfirmReplacement($requestId: ID!, $note: String) {
    confirmReplacementLeaveRequest(requestId: $requestId, note: $note) {
      id
      status
      replacementStatus
      replacementConfirmedAt
    }
  }
`;

export const useLeaveManagement = ({
  selectedDate,
  status,
  search,
  restaurantId,
  employeeId,
}) => {
  const filter = useMemo(
    () => ({
      restaurantId: restaurantId || undefined,
      employeeId: employeeId || undefined,
      startDate: selectedDate || undefined,
      endDate: selectedDate || undefined,
      status: status === "all" ? undefined : status,
      search: search?.trim() || undefined,
    }),
    [employeeId, restaurantId, search, selectedDate, status],
  );
  const isSelfService = Boolean(employeeId);

  const { data, loading, error, refetch } = useQuery(
    isSelfService ? Q_STAFF_LEAVE_PAGE : Q_LEAVE_PAGE,
    {
      variables: isSelfService ? { filter } : { restaurantId, filter },
      skip: !restaurantId,
      fetchPolicy: "cache-and-network",
    },
  );

  const [createLeaveMutation, createState] = useMutation(M_CREATE);
  const [approveLeaveMutation, approveState] = useMutation(M_APPROVE);
  const [rejectLeaveMutation, rejectState] = useMutation(M_REJECT);
  const [confirmReplacementMutation, confirmState] = useMutation(
    M_CONFIRM_REPLACEMENT,
  );

  const leaveRequests = useMemo(
    () => data?.leaveRequests || [],
    [data?.leaveRequests],
  );
  const staffList = useMemo(() => data?.staffList || [], [data?.staffList]);

  const refetchIfReady = async () => {
    if (restaurantId && refetch) {
      await refetch();
    }
  };

  const submitLeaveRequest = async (input) => {
    await createLeaveMutation({ variables: { input } });
    await refetchIfReady();
  };

  const approveLeave = async (requestId, note) => {
    await approveLeaveMutation({
      variables: { requestId, note: note || undefined },
    });
    await refetchIfReady();
  };

  const rejectLeave = async (requestId, reason) => {
    await rejectLeaveMutation({ variables: { requestId, reason } });
    await refetchIfReady();
  };

  const confirmReplacement = async (requestId, note) => {
    await confirmReplacementMutation({
      variables: { requestId, note: note || undefined },
    });
    await refetchIfReady();
  };

  const isMutating =
    createState.loading ||
    approveState.loading ||
    rejectState.loading ||
    confirmState.loading;

  return {
    leaveRequests,
    staffList,
    loading,
    error,
    isMutating,
    submitLeaveRequest,
    approveLeave,
    rejectLeave,
    confirmReplacement,
    refetch,
  };
};
