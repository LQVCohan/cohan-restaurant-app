import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

const RECONCILIATION_FIELDS = `
  id
  restaurantId
  cashierId
  cashierName
  cashierCode
  shiftId
  timesheetId
  registerCode
  status
  openedAt
  closedAt
  submittedAt
  reviewedAt
  lockedAt
  openingCash
  actualCash
  cashSalesAmount
  cashRefundAmount
  movementNetAmount
  managerAdjustmentAmount
  expectedCash
  varianceAmount
  varianceRate
  attributableToCashier
  cashierNote
  reviewNote
  evidenceAttachments
  movements {
    id
    type
    amount
    reason
    occurredAt
    createdBy
  }
  transactionIds
  refundIds
  calculatedAt
  openedBy
  submittedBy
  reviewedBy
  auditTrail {
    action
    actorId
    previousStatus
    nextStatus
    note
    metadata
    at
  }
  createdAt
  updatedAt
`;

export const QUERY_CASHIER_SHIFT_RECONCILIATIONS = gql`
  query CashierShiftReconciliations(
    $filter: CashierShiftReconciliationFilterInput!
  ) {
    cashierShiftReconciliations(filter: $filter) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export const MUTATION_OPEN_CASHIER_SHIFT_RECONCILIATION = gql`
  mutation OpenCashierShiftReconciliation(
    $input: OpenCashierShiftReconciliationInput!
  ) {
    openCashierShiftReconciliation(input: $input) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export const MUTATION_ADD_CASHIER_SHIFT_CASH_MOVEMENT = gql`
  mutation AddCashierShiftCashMovement(
    $input: AddCashierShiftCashMovementInput!
  ) {
    addCashierShiftCashMovement(input: $input) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export const MUTATION_REFRESH_CASHIER_SHIFT_RECONCILIATION = gql`
  mutation RefreshCashierShiftReconciliation($id: ID!) {
    refreshCashierShiftReconciliation(id: $id) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export const MUTATION_SUBMIT_CASHIER_SHIFT_RECONCILIATION = gql`
  mutation SubmitCashierShiftReconciliation(
    $input: SubmitCashierShiftReconciliationInput!
  ) {
    submitCashierShiftReconciliation(input: $input) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export const MUTATION_REVIEW_CASHIER_SHIFT_RECONCILIATION = gql`
  mutation ReviewCashierShiftReconciliation(
    $input: ReviewCashierShiftReconciliationInput!
  ) {
    reviewCashierShiftReconciliation(input: $input) {
      ${RECONCILIATION_FIELDS}
    }
  }
`;

export default function useCashierShiftReconciliation({
  restaurantId,
  cashierId,
  status,
  dateFrom,
  dateTo,
} = {}) {
  const filter = useMemo(
    () => ({
      restaurantId,
      cashierId: cashierId || undefined,
      status: status && status !== "ALL" ? status : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: 100,
    }),
    [cashierId, dateFrom, dateTo, restaurantId, status],
  );

  const query = useQuery(QUERY_CASHIER_SHIFT_RECONCILIATIONS, {
    variables: { filter },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const mutationOptions = { onCompleted: () => query.refetch?.() };
  const [openMutation, openState] = useMutation(
    MUTATION_OPEN_CASHIER_SHIFT_RECONCILIATION,
    mutationOptions,
  );
  const [movementMutation, movementState] = useMutation(
    MUTATION_ADD_CASHIER_SHIFT_CASH_MOVEMENT,
    mutationOptions,
  );
  const [refreshMutation, refreshState] = useMutation(
    MUTATION_REFRESH_CASHIER_SHIFT_RECONCILIATION,
    mutationOptions,
  );
  const [submitMutation, submitState] = useMutation(
    MUTATION_SUBMIT_CASHIER_SHIFT_RECONCILIATION,
    mutationOptions,
  );
  const [reviewMutation, reviewState] = useMutation(
    MUTATION_REVIEW_CASHIER_SHIFT_RECONCILIATION,
    mutationOptions,
  );

  return {
    items: query.data?.cashierShiftReconciliations || [],
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    openReconciliation: (input) => openMutation({ variables: { input } }),
    addMovement: (input) => movementMutation({ variables: { input } }),
    refreshReconciliation: (id) => refreshMutation({ variables: { id } }),
    submitReconciliation: (input) => submitMutation({ variables: { input } }),
    reviewReconciliation: (input) => reviewMutation({ variables: { input } }),
    actionLoading:
      openState.loading ||
      movementState.loading ||
      refreshState.loading ||
      submitState.loading ||
      reviewState.loading,
    actionError:
      openState.error ||
      movementState.error ||
      refreshState.error ||
      submitState.error ||
      reviewState.error,
  };
}
