import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import PaymentModalLegacy from "./PaymentModalLegacy";
import { usePos } from "@/context/PosContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import { groupItemsByBatch } from "@/utils/orderBatchGrouping";
import {
  getAuthoritativeLineTotal,
  normalizeLegacyPaymentDisplayItem,
} from "@/utils/paymentLinePricing";
import {
  calculateReservationDepositSettlement,
  getReservationDepositAvailability,
} from "@/utils/reservationDepositSettlement";
import {
  clearPartialTablePaymentSelection,
  clearTablePartialPaymentHistory,
  markTablePartialPaymentHistory,
  setPartialTablePaymentSelection,
  tableHasPartialPaymentHistory,
} from "@/utils/partialTablePaymentSelection";
import "./PartialTablePayment.scss";

const ACTIVE_RESERVATION_DEPOSIT = gql`
  query PosActiveReservationDeposit($restaurantId: ID!, $tableId: ID!) {
    activeReservationByTable(restaurantId: $restaurantId, tableId: $tableId) {
      id
      orderCode
      status
      customerName
      depositAmount
      tableDepositAmount
      tableDepositRefundEligible
      menuDepositAmount
      depositStatus
      depositAppliedAmount
      depositAppliedAt
      linkedMenuSubtotal
    }
  }
`;

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalizeId = (value) => String(value || "").trim();

const uniqueIds = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeId)
      .filter(Boolean),
  ),
];

export default function PaymentModal(props) {
  const { isOpen, order = [], table, totalAmount, onComplete } = props;
  const pos = usePos?.() || null;
  const orderManagement = useOrderManagement(pos);
  const isDineIn =
    !pos?.currentOrderType || pos?.currentOrderType === "dine_in";

  const payableBatches = useMemo(
    () =>
      groupItemsByBatch(order)
        .filter((batch) => !batch?.isDraft && normalizeId(batch?.orderId))
        .map((batch, index) => ({
          ...batch,
          orderId: normalizeId(batch.orderId),
          batchIndex: Number(batch.batchIndex || index + 1),
          amount: (batch.items || []).reduce(
            (sum, item) => sum + getAuthoritativeLineTotal(item),
            0,
          ),
        })),
    [order],
  );

  const allOrderIds = useMemo(
    () => uniqueIds(payableBatches.map((batch) => batch.orderId)),
    [payableBatches],
  );
  const batchSignature = allOrderIds.join("|");
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => allOrderIds);

  const paymentScope = useMemo(
    () => ({
      restaurantId:
        table?.restaurantId ||
        table?.restaurant_id ||
        pos?.currentTable?.restaurantId ||
        pos?.restaurantId ||
        "",
      tableId:
        table?.id ||
        table?._id ||
        pos?.currentTable?.id ||
        pos?.currentTable?._id ||
        "",
    }),
    [
      table?.restaurantId,
      table?.restaurant_id,
      table?.id,
      table?._id,
      pos?.currentTable?.restaurantId,
      pos?.currentTable?.id,
      pos?.currentTable?._id,
      pos?.restaurantId,
    ],
  );

  const { data: reservationDepositData } = useQuery(
    ACTIVE_RESERVATION_DEPOSIT,
    {
      variables: paymentScope,
      skip:
        !isOpen ||
        !isDineIn ||
        !paymentScope.restaurantId ||
        !paymentScope.tableId,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );
  const reservationDeposit =
    reservationDepositData?.activeReservationByTable || null;

  useEffect(() => {
    if (!isOpen || !isDineIn || !allOrderIds.length) return;
    setSelectedOrderIds(allOrderIds);
  }, [isOpen, isDineIn, batchSignature, allOrderIds]);

  useEffect(() => {
    if (!isOpen || !isDineIn || !allOrderIds.length) {
      clearPartialTablePaymentSelection();
      return;
    }

    setPartialTablePaymentSelection({
      active: true,
      ...paymentScope,
      selectedOrderIds,
      allOrderIds,
    });
  }, [
    isOpen,
    isDineIn,
    paymentScope,
    selectedOrderIds,
    batchSignature,
    allOrderIds,
  ]);

  useEffect(
    () => () => {
      clearPartialTablePaymentSelection();
    },
    [],
  );

  const selectedIdSet = useMemo(
    () => new Set(uniqueIds(selectedOrderIds)),
    [selectedOrderIds],
  );
  const isPartialPayment =
    allOrderIds.length > 0 && selectedIdSet.size < allOrderIds.length;

  const selectedItems = useMemo(() => {
    if (!isPartialPayment) return order;

    return order.filter((item) =>
      selectedIdSet.has(
        normalizeId(item?.sourceOrderId || item?.orderId),
      ),
    );
  }, [isPartialPayment, order, selectedIdSet]);

  const legacyDisplayItems = useMemo(
    () => selectedItems.map(normalizeLegacyPaymentDisplayItem),
    [selectedItems],
  );

  const selectedTotalAmount = useMemo(() => {
    if (!isPartialPayment) return Number(totalAmount || 0);
    return selectedItems.reduce(
      (sum, item) => sum + getAuthoritativeLineTotal(item),
      0,
    );
  }, [isPartialPayment, selectedItems, totalAmount]);

  const reservationSettlement = useMemo(() => {
    if (
      !reservationDeposit ||
      isPartialPayment ||
      String(reservationDeposit.depositStatus || "").toLowerCase() !== "paid" ||
      reservationDeposit.depositAppliedAt
    ) {
      return null;
    }
    return getReservationDepositAvailability(reservationDeposit);
  }, [isPartialPayment, reservationDeposit]);

  const settlementPreview = useMemo(
    () =>
      calculateReservationDepositSettlement({
        grossTotal: selectedTotalAmount,
        ...(reservationSettlement || {}),
      }),
    [reservationSettlement, selectedTotalAmount],
  );

  const reservationDepositCredit = reservationSettlement
    ? settlementPreview.menuDepositCredit
    : 0;
  const amountAfterReservationDeposit = reservationSettlement
    ? settlementPreview.amountToCollect
    : selectedTotalAmount;
  const tableDepositRefund = reservationSettlement
    ? settlementPreview.tableDepositRefund
    : 0;
  const customerPaysBeforeDiscount = reservationSettlement
    ? settlementPreview.customerPays
    : selectedTotalAmount;
  const customerReceivesBeforeDiscount = reservationSettlement
    ? settlementPreview.customerReceives
    : 0;

  const toggleBatch = useCallback((orderId) => {
    const normalized = normalizeId(orderId);
    if (!normalized) return;

    setSelectedOrderIds((current) => {
      const selected = new Set(uniqueIds(current));
      if (selected.has(normalized)) {
        if (selected.size <= 1) return current;
        selected.delete(normalized);
      } else {
        selected.add(normalized);
      }
      return allOrderIds.filter((id) => selected.has(id));
    });
  }, [allOrderIds]);

  const selectAll = useCallback(() => {
    setSelectedOrderIds(allOrderIds);
  }, [allOrderIds]);

  const restoreTableAfterPartialPayment = useCallback(async () => {
    const tableSnapshot = table || pos?.currentTable;
    const restaurantId =
      tableSnapshot?.restaurantId ||
      tableSnapshot?.restaurant_id ||
      pos?.restaurantId ||
      "";
    const tableId = tableSnapshot?.id || tableSnapshot?._id || "";
    const tableCode = tableSnapshot?.code || "";

    if (!restaurantId || !tableId) return;

    await new Promise((resolve) => setTimeout(resolve, 180));

    pos?.setCurrentTable?.({
      ...tableSnapshot,
      status: "occupied",
    });
    try {
      await pos?.setTableStatus?.({ id: tableId, status: "occupied" });
    } catch {
      // Backend payment-by-order keeps the table occupied. This only repairs
      // the legacy POS completion handler when it optimistically released it.
    }

    try {
      await orderManagement.loadGroupsForTable?.({
        restaurantId,
        tableId,
        tableCode,
      });
    } catch {
      // A table refetch below remains available as recovery.
    }

    try {
      await pos?.refetchTables?.();
    } catch {
      // Socket/polling will reconcile the table later.
    }
  }, [orderManagement.loadGroupsForTable, pos, table]);

  const handleComplete = useCallback(
    (payload) => {
      const paidOrderIds = allOrderIds.filter((id) =>
        selectedIdSet.has(id),
      );
      const remainingOrderIds = allOrderIds.filter(
        (id) => !selectedIdSet.has(id),
      );
      const hadPartialHistory =
        tableHasPartialPaymentHistory(paymentScope);

      if (isPartialPayment) {
        markTablePartialPaymentHistory(paymentScope);
      } else if (hadPartialHistory && remainingOrderIds.length === 0) {
        clearTablePartialPaymentHistory(paymentScope);
      }

      onComplete?.({
        ...payload,
        partialPayment: isPartialPayment,
        paidOrderIds,
        remainingOrderIds,
        paidBatchCount: paidOrderIds.length,
        totalBatchCount: allOrderIds.length,
        reservationDepositCredit,
        tableDepositRefund,
        amountCollectedAfterDeposit: amountAfterReservationDeposit,
        customerPaysAfterDeposit: customerPaysBeforeDiscount,
        customerReceivesAfterDeposit: customerReceivesBeforeDiscount,
      });

      if (isPartialPayment) {
        void restoreTableAfterPartialPayment();
      }
    },
    [
      allOrderIds,
      amountAfterReservationDeposit,
      customerPaysBeforeDiscount,
      customerReceivesBeforeDiscount,
      isPartialPayment,
      onComplete,
      paymentScope,
      reservationDepositCredit,
      restoreTableAfterPartialPayment,
      selectedIdSet,
      tableDepositRefund,
    ],
  );

  const showBatchSelector =
    isOpen && isDineIn && payableBatches.length > 1;
  const showDepositPanel =
    isOpen &&
    isDineIn &&
    reservationDeposit &&
    String(reservationDeposit.depositStatus || "").toLowerCase() === "paid" &&
    Number(reservationDeposit.depositAmount || 0) > 0;

  return (
    <>
      <PaymentModalLegacy
        {...props}
        order={legacyDisplayItems}
        totalAmount={selectedTotalAmount}
        reservationSettlement={reservationSettlement}
        onComplete={handleComplete}
      />

      {showDepositPanel && (
        <aside
          className={`reservation-deposit-credit-panel ${
            isPartialPayment ? "is-deferred" : "is-applied"
          }`}
          aria-label="Tiền cọc đặt bàn"
        >
          <div className="reservation-deposit-credit-panel__header">
            <span>TIỀN CỌC ĐÃ GHI NHẬN</span>
            <strong>{formatVnd(reservationDeposit.depositAmount)}</strong>
          </div>
          <div className="reservation-deposit-credit-panel__rows">
            {Number(reservationDeposit.tableDepositAmount || 0) > 0 && (
              <div>
                <span>Cọc bàn</span>
                <strong>{formatVnd(reservationDeposit.tableDepositAmount)}</strong>
              </div>
            )}
            {Number(reservationDeposit.menuDepositAmount || 0) > 0 && (
              <div>
                <span>Cọc món đã trả trước</span>
                <strong>{formatVnd(reservationDeposit.menuDepositAmount)}</strong>
              </div>
            )}
            {!isPartialPayment && reservationDepositCredit > 0 && (
              <div className="reservation-deposit-credit-panel__credit">
                <span>Cọc món dùng thanh toán</span>
                <strong>-{formatVnd(reservationDepositCredit)}</strong>
              </div>
            )}
            {!isPartialPayment && (
              <div>
                <span>Còn lại tiền món trước ưu đãi</span>
                <strong>{formatVnd(amountAfterReservationDeposit)}</strong>
              </div>
            )}
            {!isPartialPayment && tableDepositRefund > 0 && (
              <div className="reservation-deposit-credit-panel__credit">
                <span>Hoàn lại cọc bàn</span>
                <strong>{formatVnd(tableDepositRefund)}</strong>
              </div>
            )}
            {!isPartialPayment && (
              <div className="reservation-deposit-credit-panel__due">
                <span>
                  {customerReceivesBeforeDiscount > 0
                    ? "Khách được nhận trước ưu đãi"
                    : "Khách cần thanh toán trước ưu đãi"}
                </span>
                <strong>
                  {formatVnd(
                    customerReceivesBeforeDiscount > 0
                      ? customerReceivesBeforeDiscount
                      : customerPaysBeforeDiscount,
                  )}
                </strong>
              </div>
            )}
          </div>
          <p>
            {isPartialPayment
              ? "Tiền cọc chỉ được quyết toán khi thanh toán toàn bộ các đợt còn lại của bàn."
              : "Cọc món chỉ trừ đúng phần đã trả trước. Cọc bàn được hoàn riêng; hệ thống hiển thị chênh lệch cuối cùng khách cần trả hoặc được nhận sau coupon/promotion."}
          </p>
        </aside>
      )}

      {showBatchSelector && (
        <aside
          className="partial-table-payment-panel"
          aria-label="Chọn đợt gọi món cần thanh toán"
        >
          <div className="partial-table-payment-panel__header">
            <div>
              <span className="partial-table-payment-panel__eyebrow">
                Phạm vi thanh toán
              </span>
              <h4>Chọn đợt gọi món</h4>
            </div>
            <span className="partial-table-payment-panel__count">
              {selectedIdSet.size}/{allOrderIds.length}
            </span>
          </div>

          <button
            type="button"
            className={`partial-table-payment-panel__all ${
              !isPartialPayment ? "is-selected" : ""
            }`}
            onClick={selectAll}
          >
            <span>
              <strong>Thanh toán toàn bộ</strong>
              <small>Mặc định chọn tất cả các đợt</small>
            </span>
            <span>{formatVnd(Number(totalAmount || 0))}</span>
          </button>

          <div className="partial-table-payment-panel__list">
            {payableBatches.map((batch) => {
              const checked = selectedIdSet.has(batch.orderId);
              const cannotUncheck = checked && selectedIdSet.size <= 1;
              const status = String(batch.status || "").toLowerCase();

              return (
                <label
                  key={batch.orderId}
                  className={`partial-table-payment-panel__batch ${
                    checked ? "is-selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={cannotUncheck}
                    onChange={() => toggleBatch(batch.orderId)}
                  />
                  <span className="partial-table-payment-panel__batch-copy">
                    <strong>
                      Đợt gọi món {batch.batchIndex}
                    </strong>
                    <small>
                      {batch.orderCode || batch.orderId}
                      {status ? ` · ${status}` : ""}
                    </small>
                  </span>
                  <span className="partial-table-payment-panel__amount">
                    {formatVnd(batch.amount)}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="partial-table-payment-panel__footer">
            <span>
              {isPartialPayment
                ? `Chỉ thanh toán ${selectedIdSet.size} đợt đã chọn`
                : "Thanh toán hết các đợt của bàn"}
            </span>
            <strong>{formatVnd(selectedTotalAmount)}</strong>
          </div>
        </aside>
      )}
    </>
  );
}
