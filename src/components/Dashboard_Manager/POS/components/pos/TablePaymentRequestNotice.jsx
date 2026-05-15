import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { AlertTriangle, BellRing, Loader2 } from "lucide-react";
import { usePos } from "@/context/PosContext";
import { useNotification } from "@/hooks/useNotification";
import { groupPaymentRequests } from "@/utils/paymentRequestGrouping";
import {
  buildTablePaymentRequestMap,
  normalizePosPaymentRequests,
  POS_PAYMENT_REQUESTS_QUERY,
} from "@/utils/posPaymentRequests";
import styles from "./TablePaymentRequestNotice.module.scss";

const CLEAR_TABLE_PAYMENT_REQUEST = gql`
  mutation ClearTablePaymentRequest($input: ClearTablePaymentRequestInput!) {
    clearTablePaymentRequest(input: $input) {
      ok
      message
    }
  }
`;

export default function TablePaymentRequestNotice() {
  const {
    restaurantId,
    currentTable,
    currentOrder,
    currentOrderType,
    selectTableForOrder,
    refetchTables,
    paymentRequests,
    clearPaymentRequest,
  } = usePos();
  const { showNotification } = useNotification?.() || {
    showNotification: (message, type) => console.log(type || "info", message),
  };
  const apolloClient = useApolloClient();
  const previousHadDraftItemsRef = useRef(false);

  const { data, loading } = useQuery(POS_PAYMENT_REQUESTS_QUERY, {
    variables: { restaurantId, limit: 100 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const [clearTablePaymentRequestMutation, { loading: clearingPaymentRequest }] =
    useMutation(CLEAR_TABLE_PAYMENT_REQUEST);

  const hasLoadedPaymentRequests = useMemo(
    () => !loading && Boolean(data),
    [data, loading],
  );

  const livePaymentRequests = useMemo(() => normalizePosPaymentRequests(data), [data]);

  const tablePaymentRequestMap = useMemo(
    () => buildTablePaymentRequestMap(livePaymentRequests),
    [livePaymentRequests],
  );

  const activeTablePaymentRequest = useMemo(() => {
    if (currentOrderType !== "dine_in") return null;
    const tableCode = String(currentTable?.code || "").trim().toUpperCase();
    if (!tableCode) return null;
    return tablePaymentRequestMap.get(tableCode) || null;
  }, [currentOrderType, currentTable?.code, tablePaymentRequestMap]);

  const orderIds = useMemo(() => {
    if (!Array.isArray(activeTablePaymentRequest?.orderIds)) return [];
    return activeTablePaymentRequest.orderIds
      .map((id) => String(id || "").trim())
      .filter(Boolean);
  }, [activeTablePaymentRequest?.orderIds]);

  const refreshPaymentRequestState = useCallback(async () => {
    if (!restaurantId) return;

    await Promise.allSettled([
      apolloClient.refetchQueries({ include: ["PosPaymentRequests"] }),
      Promise.resolve(refetchTables?.()),
    ]);
  }, [apolloClient, restaurantId, refetchTables]);

  const hasDraftItems = useMemo(
    () => Array.isArray(currentOrder) && currentOrder.some((item) => item?.isNew),
    [currentOrder],
  );

  useEffect(() => {
    const previousHadDraftItems = previousHadDraftItemsRef.current;
    previousHadDraftItemsRef.current = hasDraftItems;

    if (
      previousHadDraftItems &&
      !hasDraftItems &&
      currentOrderType === "dine_in" &&
      currentTable?.code
    ) {
      void refreshPaymentRequestState();
    }
  }, [
    hasDraftItems,
    currentOrderType,
    currentTable?.code,
    refreshPaymentRequestState,
  ]);

  useEffect(() => {
    if (!hasLoadedPaymentRequests || !currentTable?.code || activeTablePaymentRequest) {
      return;
    }

    const groupedContextRequests = groupPaymentRequests(
      Array.isArray(paymentRequests) ? paymentRequests : [],
    );
    const tableCode = String(currentTable.code).trim().toUpperCase();
    const staleGroup = groupedContextRequests.find(
      (group) =>
        group?.isTableGroup &&
        String(group?.tableCode || "").trim().toUpperCase() === tableCode,
    );

    if (!staleGroup?.orderIds?.length) return;

    staleGroup.orderIds.forEach((orderId) => clearPaymentRequest?.(orderId));
  }, [
    hasLoadedPaymentRequests,
    currentTable?.code,
    activeTablePaymentRequest,
    paymentRequests,
    clearPaymentRequest,
  ]);

  const handleClearTablePaymentRequest = useCallback(async () => {
    if (!restaurantId || !currentTable?.id || !currentTable?.code) {
      showNotification("Thiếu thông tin bàn để hủy yêu cầu thanh toán.", "error");
      return;
    }

    try {
      const { data: mutationData } = await clearTablePaymentRequestMutation({
        variables: {
          input: {
            restaurantId,
            tableId: currentTable.id,
            tableCode: currentTable.code,
            reason: "staff_clear_request",
          },
        },
      });

      const result = mutationData?.clearTablePaymentRequest;
      if (!result?.ok) {
        throw new Error(result?.message || "Không thể hủy yêu cầu thanh toán.");
      }

      if (Array.isArray(activeTablePaymentRequest?.orderIds)) {
        activeTablePaymentRequest.orderIds.forEach((orderId) => clearPaymentRequest?.(orderId));
      }

      await refreshPaymentRequestState();
      await selectTableForOrder?.(currentTable.code, currentTable.capacity, {
        preserveDraftItems: true,
      });

      showNotification(
        result?.message || "Đã hủy yêu cầu thanh toán cho bàn hiện tại.",
        "success",
      );
    } catch (error) {
      showNotification(error?.message || "Không thể hủy yêu cầu thanh toán.", "error");
    }
  }, [
    restaurantId,
    currentTable?.id,
    currentTable?.code,
    currentTable?.capacity,
    clearTablePaymentRequestMutation,
    activeTablePaymentRequest?.orderIds,
    clearPaymentRequest,
    refreshPaymentRequestState,
    selectTableForOrder,
    showNotification,
  ]);

  if (currentOrderType !== "dine_in" || !currentTable?.code || !activeTablePaymentRequest) {
    return null;
  }

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <div className={styles.iconWrap} aria-hidden="true">
        <BellRing size={18} />
      </div>

      <div className={styles.copy}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Yêu cầu thanh toán</span>
          <span className={styles.tableTag}>Bàn {currentTable.code}</span>
        </div>

        {!!orderIds.length && (
          <div className={styles.orderMeta}>Order: {orderIds.join(", ")}</div>
        )}

        <div className={styles.message}>
          Khách đã yêu cầu thanh toán. Không nên thêm món mới nếu chưa xác nhận với khách.
        </div>
        <div className={styles.meta}>
          <AlertTriangle size={14} />
          <span>Đây là cảnh báo nghiệp vụ, chưa phải thanh toán thành công.</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.clearButton}
        onClick={handleClearTablePaymentRequest}
        disabled={clearingPaymentRequest}
      >
        {clearingPaymentRequest ? (
          <>
            <Loader2 size={15} className={styles.spinner} /> Đang hủy...
          </>
        ) : (
          "Hủy yêu cầu"
        )}
      </button>
    </div>
  );
}
