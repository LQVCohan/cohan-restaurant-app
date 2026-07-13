import React, { useCallback, useEffect, useMemo, useState } from "react";
import PaymentModalLegacy from "./PaymentModalLegacy";
import { usePos } from "@/context/PosContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import { groupItemsByBatch } from "@/utils/orderBatchGrouping";
import {
  clearPartialTablePaymentSelection,
  clearTablePartialPaymentHistory,
  markTablePartialPaymentHistory,
  setPartialTablePaymentSelection,
  tableHasPartialPaymentHistory,
} from "@/utils/partialTablePaymentSelection";
import "./PartialTablePayment.scss";

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getLineTotal = (item) => {
  if (Number.isFinite(Number(item?.lineSubtotal))) {
    return Math.max(0, Number(item.lineSubtotal));
  }

  return Math.max(
    0,
    (Number(item?.price ?? item?.unitPrice ?? item?.basePrice ?? 0) +
      Number(item?.modifiersPrice || 0)) *
      Number(item?.quantity || 0),
  );
};

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
            (sum, item) => sum + getLineTotal(item),
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
    ],
  );

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

  const selectedTotalAmount = useMemo(() => {
    if (!isPartialPayment) return Number(totalAmount || 0);
    return selectedItems.reduce((sum, item) => sum + getLineTotal(item), 0);
  }, [isPartialPayment, selectedItems, totalAmount]);

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
      });

      if (isPartialPayment) {
        void restoreTableAfterPartialPayment();
      }
    },
    [
      allOrderIds,
      isPartialPayment,
      onComplete,
      paymentScope,
      restoreTableAfterPartialPayment,
      selectedIdSet,
    ],
  );

  const showBatchSelector =
    isOpen && isDineIn && payableBatches.length > 1;

  return (
    <>
      <PaymentModalLegacy
        {...props}
        order={selectedItems}
        totalAmount={selectedTotalAmount}
        onComplete={handleComplete}
      />

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
