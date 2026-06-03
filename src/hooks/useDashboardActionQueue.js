import { useCallback, useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { useNotification } from "./useNotification";

export const CONFIRM_DASHBOARD_ORDER = gql`
  mutation ConfirmDashboardOrder($input: ConfirmIncomingOrderInput!) {
    confirmIncomingOrder(input: $input) {
      order { id currentStatus updatedAt }
    }
  }
`;

export const REJECT_DASHBOARD_ORDER = gql`
  mutation RejectDashboardOrder($input: RejectIncomingOrderInput!) {
    rejectIncomingOrder(input: $input) {
      order { id currentStatus updatedAt }
    }
  }
`;

export const UPDATE_DASHBOARD_RESERVATION_STATUS = gql`
  mutation UpdateDashboardReservationStatus($input: UpdateReservationStatusInput!) {
    updateReservationStatus(input: $input) {
      id status depositStatus updatedAt
    }
  }
`;

export const CANCEL_DASHBOARD_RESERVATION = gql`
  mutation CancelDashboardReservation($id: ID!) {
    cancelReservation(id: $id) {
      id status depositStatus updatedAt
    }
  }
`;

export const ACK_DASHBOARD_SUPPORT_REQUEST = gql`
  mutation AcknowledgeDashboardSupportRequest($restaurantId: ID!, $orderId: ID!, $requestId: String!) {
    acknowledgeCustomerServiceRequest(restaurantId: $restaurantId, orderId: $orderId, requestId: $requestId) {
      ok message
    }
  }
`;

export const RESOLVE_DASHBOARD_SUPPORT_REQUEST = gql`
  mutation ResolveDashboardSupportRequest($restaurantId: ID!, $orderId: ID!, $requestId: String!) {
    resolveCustomerServiceRequest(restaurantId: $restaurantId, orderId: $orderId, requestId: $requestId) {
      ok message
    }
  }
`;

export const useDashboardActionQueue = ({ restaurantId, refetchDashboard }) => {
  const { showNotification } = useNotification?.() || { showNotification: () => {} };
  const [busyKey, setBusyKey] = useState("");
  const [confirmOrderMutation] = useMutation(CONFIRM_DASHBOARD_ORDER);
  const [rejectOrderMutation] = useMutation(REJECT_DASHBOARD_ORDER);
  const [updateReservationStatusMutation] = useMutation(UPDATE_DASHBOARD_RESERVATION_STATUS);
  const [cancelReservationMutation] = useMutation(CANCEL_DASHBOARD_RESERVATION);
  const [ackSupportMutation] = useMutation(ACK_DASHBOARD_SUPPORT_REQUEST);
  const [resolveSupportMutation] = useMutation(RESOLVE_DASHBOARD_SUPPORT_REQUEST);

  const runAction = useCallback(
    async (key, action, successMessage, successType = "success") => {
      if (!restaurantId && !key.startsWith("reservation:")) return;
      setBusyKey(key);
      try {
        const result = await action();
        await refetchDashboard?.();
        showNotification(successMessage, successType);
        return result;
      } catch (err) {
        showNotification(err?.message || "Không thể cập nhật hàng đợi dashboard.", "error");
        throw err;
      } finally {
        setBusyKey("");
      }
    },
    [refetchDashboard, restaurantId, showNotification],
  );

  const confirmOrder = useCallback(
    (order) => runAction(
      `order-confirm:${order?.id}`,
      () => confirmOrderMutation({ variables: { input: { id: order.id, restaurantId } } }),
      "Đã nhận đơn đặt món.",
    ),
    [confirmOrderMutation, restaurantId, runAction],
  );

  const rejectOrder = useCallback(
    (order, reason) => runAction(
      `order-reject:${order?.id}`,
      () => rejectOrderMutation({ variables: { input: { id: order.id, restaurantId, reason } } }),
      "Đã từ chối đơn đặt món.",
      "warning",
    ),
    [rejectOrderMutation, restaurantId, runAction],
  );

  const confirmReservation = useCallback(
    (reservation) => runAction(
      `reservation-confirm:${reservation?.id}`,
      () => updateReservationStatusMutation({
        variables: {
          input: {
            id: reservation.id,
            status: "confirmed",
          },
        },
      }),
      "Đã nhận đặt bàn.",
    ),
    [runAction, updateReservationStatusMutation],
  );

  const cancelReservation = useCallback(
    (reservation) => runAction(
      `reservation-cancel:${reservation?.id}`,
      () => cancelReservationMutation({ variables: { id: reservation.id } }),
      "Đã hủy đặt bàn.",
      "warning",
    ),
    [cancelReservationMutation, runAction],
  );

  const acknowledgeSupport = useCallback(
    (request) => runAction(
      `support-ack:${request?.requestId}`,
      () => ackSupportMutation({ variables: { restaurantId, orderId: request.orderId, requestId: request.requestId } }),
      "Đã nhận xử lý yêu cầu hỗ trợ.",
    ),
    [ackSupportMutation, restaurantId, runAction],
  );

  const resolveSupport = useCallback(
    (request) => runAction(
      `support-resolve:${request?.requestId}`,
      () => resolveSupportMutation({ variables: { restaurantId, orderId: request.orderId, requestId: request.requestId } }),
      "Đã hoàn tất yêu cầu hỗ trợ.",
    ),
    [resolveSupportMutation, restaurantId, runAction],
  );

  return useMemo(() => ({
    busyKey,
    confirmOrder,
    rejectOrder,
    confirmReservation,
    cancelReservation,
    acknowledgeSupport,
    resolveSupport,
  }), [busyKey, confirmOrder, rejectOrder, confirmReservation, cancelReservation, acknowledgeSupport, resolveSupport]);
};
