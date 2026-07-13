import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import s from "./SplitTableModal.module.scss";
import { formatPrice } from "@/utils/formatters";
import useModalKeyboardClose from "./useModalKeyboardClose";

const ACTIVE_TABLE_SESSION_ORDERS = gql`
  query SplitOrderSource($restaurantId: ID!, $tableId: ID!) {
    activeTableSessionOrders(restaurantId: $restaurantId, tableId: $tableId) {
      orders {
        id
        orderCode
        currentStatus
        createdAt
        payment {
          status
        }
        items {
          _id
          name
          quantity
          unitPrice
          lineSubtotal
          status
          voidRequests {
            status
          }
          returnRequests {
            status
          }
        }
      }
    }
  }
`;

const ACTIVE_TABLE_ORDER_SPLIT = gql`
  query ActiveTableOrderSplit($restaurantId: ID!, $tableId: ID!) {
    activeTableOrderSplit(restaurantId: $restaurantId, tableId: $tableId) {
      id
      status
      movedItemCount
      movedPartialItemCount
      movedWholeOrderCount
      canRevert
      createdAt
      sourceTable {
        id
        code
      }
      targetTable {
        id
        code
      }
    }
  }
`;

const SPLIT_TABLE_ORDER = gql`
  mutation SplitTableOrder($input: SplitTableOrderInput!) {
    splitTableOrder(input: $input) {
      ok
      message
      split {
        id
        sourceTable {
          id
          code
        }
        targetTable {
          id
          code
        }
      }
    }
  }
`;

const REVERT_TABLE_ORDER_SPLIT = gql`
  mutation RevertTableOrderSplit($input: RevertTableOrderSplitInput!) {
    revertTableOrderSplit(input: $input) {
      ok
      message
      split {
        id
        status
        sourceTable {
          id
          code
        }
        targetTable {
          id
          code
        }
      }
    }
  }
`;

const itemKey = (orderId, itemId) => `${orderId}:${itemId}`;
const isSelectableItem = (item) =>
  !["cancelled", "returned"].includes(String(item?.status || "").toLowerCase());
const hasPendingAdjustment = (item) =>
  (item?.voidRequests || []).some((request) => request?.status === "pending") ||
  (item?.returnRequests || []).some((request) => request?.status === "pending");

export default function SplitTableModal({
  isOpen,
  restaurantId,
  tables = [],
  initialSourceTable = null,
  onClose,
  onCompleted,
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useModalKeyboardClose({
    isOpen,
    onClose,
    disabled: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setSourceId(initialSourceTable?.id || "");
    setTargetId("");
    setSelected(new Set());
    setError("");
    setNotice("");
  }, [isOpen, initialSourceTable?.id]);

  const sourceTable = useMemo(
    () => tables.find((table) => String(table.id) === String(sourceId)) || null,
    [sourceId, tables],
  );

  const standaloneTables = useMemo(
    () =>
      (tables || []).filter(
        (table) =>
          !table?.joinGroupId &&
          !table?.mergedIntoTableId &&
          !(Array.isArray(table?.mergedFromTableIds) && table.mergedFromTableIds.length),
      ),
    [tables],
  );

  const sourceOptions = useMemo(
    () =>
      standaloneTables.filter((table) =>
        ["occupied", "payment_pending"].includes(
          String(table?.status || "").toLowerCase(),
        ),
      ),
    [standaloneTables],
  );

  const targetOptions = useMemo(
    () =>
      standaloneTables.filter(
        (table) =>
          String(table.id) !== String(sourceId) &&
          String(table.status || "").toLowerCase() === "available" &&
          (!sourceTable?.floorId ||
            String(table.floorId || "") === String(sourceTable.floorId || "")),
      ),
    [sourceId, sourceTable?.floorId, standaloneTables],
  );

  const {
    data: activeSplitData,
    loading: activeSplitLoading,
    refetch: refetchActiveSplit,
  } = useQuery(ACTIVE_TABLE_ORDER_SPLIT, {
    variables: { restaurantId, tableId: sourceId },
    skip: !isOpen || !restaurantId || !sourceId,
    fetchPolicy: "network-only",
  });
  const activeSplit = activeSplitData?.activeTableOrderSplit || null;

  const {
    data: orderData,
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery(ACTIVE_TABLE_SESSION_ORDERS, {
    variables: { restaurantId, tableId: sourceId },
    skip: !isOpen || !restaurantId || !sourceId || Boolean(activeSplit),
    fetchPolicy: "network-only",
  });

  const [splitTableOrder, { loading: splitting }] = useMutation(SPLIT_TABLE_ORDER);
  const [revertTableOrderSplit, { loading: reverting }] = useMutation(
    REVERT_TABLE_ORDER_SPLIT,
  );

  const orders = useMemo(
    () =>
      (orderData?.activeTableSessionOrders?.orders || []).filter(
        (order) =>
          order?.id &&
          !["completed", "cancelled", "failed"].includes(
            String(order?.currentStatus || "").toLowerCase(),
          ),
      ),
    [orderData],
  );

  const selectableRows = useMemo(
    () =>
      orders.flatMap((order, batchIndex) =>
        (order.items || [])
          .filter(isSelectableItem)
          .map((item) => ({
            order,
            item,
            batchIndex,
            key: itemKey(order.id, item._id),
            disabled:
              hasPendingAdjustment(item) ||
              ["payment_requested", "paid"].includes(
                String(order?.payment?.status || "").toLowerCase(),
              ),
          })),
      ),
    [orders],
  );

  const selectedRows = selectableRows.filter((row) => selected.has(row.key));
  const canSplit =
    Boolean(sourceId && targetId) &&
    selectedRows.length > 0 &&
    selectedRows.length < selectableRows.length &&
    !selectedRows.some((row) => row.disabled) &&
    !splitting;

  const toggleItem = (key) => {
    setError("");
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleBatch = (orderId) => {
    const rows = selectableRows.filter(
      (row) => String(row.order.id) === String(orderId) && !row.disabled,
    );
    const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.key));
    setSelected((previous) => {
      const next = new Set(previous);
      rows.forEach((row) => {
        if (allSelected) next.delete(row.key);
        else next.add(row.key);
      });
      return next;
    });
  };

  const handleSplit = async () => {
    if (!canSplit) {
      setError(
        "Cần chọn bàn đích, chọn ít nhất một món và giữ lại ít nhất một món ở bàn nguồn.",
      );
      return;
    }

    setError("");
    setNotice("");
    try {
      const result = await splitTableOrder({
        variables: {
          input: {
            restaurantId,
            sourceTableId: sourceId,
            targetTableId: targetId,
            selectedItems: selectedRows.map((row) => ({
              orderId: row.order.id,
              orderItemId: row.item._id,
            })),
          },
        },
      });
      const payload = result?.data?.splitTableOrder;
      if (!payload?.ok) throw new Error(payload?.message || "Tách order thất bại.");
      setNotice(payload.message || "Đã tách order.");
      await Promise.all([
        refetchActiveSplit?.(),
        refetchOrders?.(),
        onCompleted?.({
          action: "split",
          split: payload.split,
          sourceTable,
          targetTable:
            tables.find((table) => String(table.id) === String(targetId)) || null,
        }),
      ]);
      setSelected(new Set());
      setTargetId("");
    } catch (mutationError) {
      setError(mutationError?.message || "Không thể tách order.");
    }
  };

  const handleRevert = async () => {
    if (!activeSplit?.id || !activeSplit?.canRevert || reverting) return;
    setError("");
    setNotice("");
    try {
      const result = await revertTableOrderSplit({
        variables: {
          input: {
            restaurantId,
            splitId: activeSplit.id,
            reason: "reverted_from_pos",
          },
        },
      });
      const payload = result?.data?.revertTableOrderSplit;
      if (!payload?.ok) throw new Error(payload?.message || "Gộp lại thất bại.");
      setNotice(payload.message || "Đã gộp lại như cũ.");
      await Promise.all([
        refetchActiveSplit?.(),
        onCompleted?.({
          action: "revert",
          split: payload.split,
          sourceTable: activeSplit.sourceTable,
          targetTable: activeSplit.targetTable,
        }),
      ]);
    } catch (mutationError) {
      setError(mutationError?.message || "Không thể gộp order về bàn cũ.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true">
      <div className={s.modal}>
        <header className={s.header}>
          <div>
            <span className={s.eyebrow}>POS · quản lý phiên phục vụ</span>
            <h3>Tách order sang bàn khác</h3>
            <p>
              Mỗi đợt gọi món vẫn giữ quan hệ phiên riêng. Dữ liệu tách được lưu
              trong database để có thể gộp lại an toàn.
            </p>
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className={s.content}>
          <section className={s.steps}>
            <div className={s.step}>
              <span>1</span>
              <label>
                Bàn cần tách
                <select
                  value={sourceId}
                  onChange={(event) => {
                    setSourceId(event.target.value);
                    setTargetId("");
                    setSelected(new Set());
                    setError("");
                  }}
                  disabled={splitting || reverting}
                >
                  <option value="">-- Chọn bàn nguồn --</option>
                  {sourceOptions.map((table) => (
                    <option key={table.id} value={table.id}>
                      Bàn {table.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={s.step}>
              <span>2</span>
              <label>
                Bàn nhận món tách
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  disabled={!sourceId || Boolean(activeSplit) || splitting || reverting}
                >
                  <option value="">-- Chọn bàn trống cùng tầng --</option>
                  {targetOptions.map((table) => (
                    <option key={table.id} value={table.id}>
                      Bàn {table.code} · {table.capacity || 0} chỗ
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {activeSplitLoading ? (
            <div className={s.state}>Đang kiểm tra lịch sử tách bàn…</div>
          ) : activeSplit ? (
            <section className={s.revertCard}>
              <div>
                <span className={s.revertLabel}>Đang có lần tách hoạt động</span>
                <strong>
                  Bàn {activeSplit.sourceTable?.code} → Bàn{" "}
                  {activeSplit.targetTable?.code}
                </strong>
                <p>
                  {activeSplit.movedPartialItemCount || 0} món tách riêng ·{" "}
                  {activeSplit.movedWholeOrderCount || 0} đợt order chuyển nguyên
                </p>
              </div>
              <button
                type="button"
                onClick={handleRevert}
                disabled={!activeSplit.canRevert || reverting}
              >
                {reverting ? "Đang gộp lại…" : "Gộp lại như cũ"}
              </button>
              {!activeSplit.canRevert && (
                <small>
                  Không thể gộp tự động vì order đã thanh toán hoặc bàn đích đã
                  phát sinh món mới.
                </small>
              )}
            </section>
          ) : !sourceId ? (
            <div className={s.state}>Chọn bàn nguồn để tải các phiên order.</div>
          ) : ordersLoading ? (
            <div className={s.state}>Đang tải các đợt gọi món…</div>
          ) : !selectableRows.length ? (
            <div className={s.state}>Bàn này chưa có món đang hoạt động để tách.</div>
          ) : (
            <section className={s.orderList}>
              <div className={s.listHeader}>
                <div>
                  <strong>3. Chọn món chuyển sang bàn mới</strong>
                  <small>
                    Đã chọn {selectedRows.length}/{selectableRows.length} món
                  </small>
                </div>
                <span>Không được chuyển toàn bộ món khỏi bàn nguồn</span>
              </div>

              {orders.map((order, batchIndex) => {
                const rows = selectableRows.filter(
                  (row) => String(row.order.id) === String(order.id),
                );
                if (!rows.length) return null;
                const batchTotal = rows.reduce(
                  (sum, row) =>
                    sum +
                    Number(
                      row.item.lineSubtotal ??
                        Number(row.item.unitPrice || 0) *
                          Number(row.item.quantity || 0),
                    ),
                  0,
                );
                return (
                  <article key={order.id} className={s.batch}>
                    <div className={s.batchHeader}>
                      <div>
                        <strong>Đợt gọi món {batchIndex + 1}</strong>
                        <small>{order.orderCode}</small>
                      </div>
                      <div>
                        <b>{formatPrice(batchTotal)}</b>
                        <button type="button" onClick={() => toggleBatch(order.id)}>
                          Chọn cả đợt
                        </button>
                      </div>
                    </div>

                    {rows.map((row) => (
                      <label
                        key={row.key}
                        className={`${s.item} ${row.disabled ? s.disabled : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(row.key)}
                          onChange={() => toggleItem(row.key)}
                          disabled={row.disabled || splitting}
                        />
                        <span>
                          <strong>{row.item.name}</strong>
                          <small>
                            {row.item.quantity} ×{" "}
                            {formatPrice(row.item.unitPrice || 0)}
                            {row.disabled
                              ? " · Đang có yêu cầu hủy/trả hoặc đã gọi thanh toán"
                              : ""}
                          </small>
                        </span>
                        <b>
                          {formatPrice(
                            row.item.lineSubtotal ??
                              Number(row.item.unitPrice || 0) *
                                Number(row.item.quantity || 0),
                          )}
                        </b>
                      </label>
                    ))}
                  </article>
                );
              })}
            </section>
          )}

          {error && <div className={s.error}>{error}</div>}
          {notice && <div className={s.success}>{notice}</div>}
        </div>

        <footer className={s.footer}>
          <button type="button" className={s.secondary} onClick={onClose}>
            Đóng
          </button>
          {!activeSplit && (
            <button
              type="button"
              className={s.primary}
              disabled={!canSplit}
              onClick={handleSplit}
            >
              {splitting
                ? "Đang tách order…"
                : `Tách ${selectedRows.length || ""} món sang bàn mới`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
