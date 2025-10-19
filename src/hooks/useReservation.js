import { gql } from "@apollo/client";
import { useLazyQuery, useMutation } from "@apollo/client/react";

// Query trạng thái reservation
export const GET_RESERVATION_STATUS = gql`
  query GetReservationStatus($id: ID!) {
    reservation(id: $id) {
      id
      status
      depositStatus
      pendingPaymentExpiresAt
      orderCode
      depositAmount
    }
  }
`;

// (Tuỳ chọn) mutation xác nhận từ staff
export const CONFIRM_RESERVATION_DEPOSIT = gql`
  mutation ConfirmReservationDeposit($input: ConfirmReservationDepositInput!) {
    confirmReservationDeposit(input: $input) {
      id
      status
      depositStatus
    }
  }
`;

export function useReservation() {
  const [runGetStatus, getStatusState] = useLazyQuery(GET_RESERVATION_STATUS, {
    fetchPolicy: "network-only",
  });

  const [runConfirm, confirmState] = useMutation(CONFIRM_RESERVATION_DEPOSIT);

  // kiểm tra 1 lần
  const checkReservationStatus = async (reservationId) => {
    const { data } = await runGetStatus({ variables: { id: reservationId } });
    return data?.reservation || null;
  };

  // auto polling
  const startStatusPolling = (reservationId, onPaid, intervalMs = 5000) => {
    if (!reservationId) return () => {};
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const resv = await checkReservationStatus(reservationId);
        const paid =
          resv?.depositStatus === "paid" ||
          ["confirmed", "seated", "completed"].includes(resv?.status);
        if (paid) {
          onPaid?.(resv);
          return;
        }
      } catch {
        // bỏ qua lỗi nhỏ
      }
      if (!stopped) {
        timer = setTimeout(tick, intervalMs);
      }
    };

    let timer = setTimeout(tick, intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  };

  return {
    checkReservationStatus,
    startStatusPolling,
    getStatusState,
    confirmReservationDeposit: runConfirm,
    isConfirming: confirmState.loading,
  };
}
