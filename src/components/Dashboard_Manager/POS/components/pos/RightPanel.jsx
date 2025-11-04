// src/components/Dashboard_Manager/POS/components/panels/RightPanel.jsx
import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { useNotification } from "../../../../../hooks/useNotification";
import { formatPrice } from "../../utils/format";
import PaymentModal from "../modals/PaymentModal";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    currentTable,
    currentOrder,
    updateItemQty,
    removeItem,
    finalTotals,
    clearOrder,
    saveOrder,
    setTableStatus,
    setCurrentTable,
  } = usePos();

  // dùng notification global
  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  const hasItems = Array.isArray(currentOrder) && currentOrder.length > 0;

  // tách nhóm: món đã lưu & món mới
  const { existingItems, newItems } = useMemo(() => {
    const ex = [];
    const nw = [];
    (currentOrder || []).forEach((it) => {
      if (it.isExisting && !it.isNew) ex.push(it);
      else nw.push(it);
    });
    return { existingItems: ex, newItems: nw };
  }, [currentOrder]);
  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
  }, []);
  const handlePaymentConfirm = useCallback(
    (paymentMethod, paymentAmount) => {
      console.log("Thanh toán:", paymentMethod, paymentAmount);
      closePaymentModal();
    },
    [closePaymentModal]
  );

  const handleSaveOrder = async () => {
    if (!currentTable) {
      showNotification("Vui lòng chọn bàn trước khi lưu.", "error");
      return;
    }

    const res = await saveOrder?.({
      persist: true,
      restaurantId: currentTable.restaurantId,
    });

    if (res?.success) {
      // hiệu ứng viền xanh
      setPulse(true);
      setTimeout(() => setPulse(false), 650);

      showNotification(`Đã lưu vào bàn ${currentTable.code}`, "success", 3000);

      // nếu bạn muốn clear/làm trống sau khi lưu thì mở 2 dòng dưới
      // clearOrder();
      // setCurrentTable(null); // nếu context cho phép
    } else {
      showNotification(res?.message || "Lưu đơn hàng thất bại.", "error");
    }
  };

  const handleQtyChange = (item, change) => {
    const next = Math.max(1, Number(item.quantity || 1) + change);
    updateItemQty(item.dishId || item.id, next);
  };

  const handleQtyInput = (e, item) => {
    const v = Math.max(1, Number(e.target.value) || 1);
    updateItemQty(item.dishId || item.id, v);
  };

  const getItemPrice = (item) => {
    const p = Number(item.price || 0);
    return formatPrice(p);
  };

  const getItemTotal = (item) => {
    const t =
      item.total != null
        ? Number(item.total)
        : Number(item.price || 0) * Number(item.quantity || 1);
    return formatPrice(t);
  };
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isClearModalOpen, setClearModalOpen] = useState(false);

  const handleDeleteItem = (action, selectedReason) => {
    // action is provided by modal but for single-item delete it's ignored
    removeItem(itemToDelete._lineId || itemToDelete.dishId || itemToDelete.id);
    setDeleteModalOpen(false);
    setItemToDelete(null);
    showNotification(
      `Đã xóa món${selectedReason ? ` — ${selectedReason}` : ""}`,
      "info"
    );
  };
  const handleShowDeleteModal = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleShowClearModal = () => setClearModalOpen(true);

  const handleClearConfirm = (action, selectedReason, customReason) => {
    // action: 'clear_items' or 'clear_table'
    if (action === "clear_table") {
      // delete all items and mark table as available
      clearOrder();
      if (currentTable?.id && typeof setTableStatus === "function") {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (typeof setCurrentTable === "function") setCurrentTable(null);
      showNotification(`Đã xóa thông tin bàn ${currentTable?.code || ""}`);
    } else {
      // just clear items
      clearOrder();
      showNotification(`Đã xóa tất cả món (giữ thông tin bàn)`);
    }

    setClearModalOpen(false);
  };

  return (
    <div
      className={`${cls.wrapper} ${pulse ? cls.pulse : ""}`}
      data-pos-order-panel
    >
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        onConfirm={handlePaymentConfirm}
        totalAmount={finalTotals?.total || 0}
        order={currentOrder}
        table={currentTable}
      />
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteItem}
      />
      {/* modal for clearing all items / clearing table */}
      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearConfirm}
        showScopeChoice={true}
      />
      {/* HEADER */}
      <div className={cls.header}>
        <div className={cls.headerLeft}>
          <div className={cls.tableName}>
            {currentTable ? `Bàn ${currentTable.code}` : "Chọn bàn"}
          </div>
          {currentTable ? (
            <div className={cls.tableMeta}>
              {currentTable.capacity || 0} chỗ ·{" "}
              <span className={cls.statusBadge}>
                {currentTable.status || "available"}
              </span>
            </div>
          ) : (
            <div className={cls.tableMeta}>Chưa chọn bàn</div>
          )}
        </div>
        <div className={cls.headerRight}>
          <div className={cls.timer}>
            {new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <button
            className={cls.backBtn}
            onClick={() => navigate("/manager/dashboard")}
            title="Quay về Dashboard"
          >
            ←
          </button>
        </div>
      </div>

      {/* BODY SCROLL */}
      <div className={cls.body}>
        {/* nhóm món mới */}
        {newItems.length > 0 && (
          <>
            <div className={cls.groupHeader}>
              Món mới đang nhập{" "}
              <span className={cls.groupCount}>{newItems.length}</span>
            </div>
            <div className={cls.itemsList}>
              {newItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={cls.orderItemNew}
                >
                  <div className={cls.itemHeaderRow}>
                    <div className={cls.itemName}>{item.name}</div>
                    <button
                      className={cls.removeBtn}
                      onClick={() => removeItem(item.dishId || item.id)}
                    >
                      ×
                    </button>
                  </div>

                  <div className={cls.itemControls}>
                    <span className={cls.badgeNew}>Mới</span>
                    <div className={cls.qtyControls}>
                      <button
                        className={cls.qtyBtn}
                        onClick={() => handleQtyChange(item, -1)}
                      >
                        −
                      </button>
                      <input
                        className={cls.qtyInput}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQtyInput(e, item)}
                      />
                      <button
                        className={cls.qtyBtn}
                        onClick={() => handleQtyChange(item, +1)}
                      >
                        +
                      </button>
                    </div>
                    <div className={cls.itemPrice}>{getItemTotal(item)}</div>
                  </div>

                  <div className={cls.itemMetaRow}>
                    <span>
                      {item.unit === "kg" ? "Kg" : "Phần"} ·{" "}
                      {getItemPrice(item)}
                    </span>
                    {item.method || item.cookingOption ? (
                      <span className={cls.method}>
                        {item.method || item.cookingOption}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ngăn cách */}
        {newItems.length > 0 && existingItems.length > 0 && (
          <div className={cls.dividerLabel}>Đã lưu trên bàn</div>
        )}

        {/* nhóm đã lưu */}
        {existingItems.length > 0 && (
          <div className={cls.itemsList}>
            {existingItems.map((item) => (
              <div
                key={item._lineId || item.dishId || item.id}
                className={cls.orderItemExisting}
              >
                <div className={cls.itemHeaderRow}>
                  <div className={cls.itemName}>{item.name}</div>
                  <button
                    className={cls.removeBtn}
                    onClick={() => handleShowDeleteModal(item)}
                  >
                    ×
                  </button>
                </div>

                <div className={cls.itemControls}>
                  <span className={cls.badgeSaved}>ĐÃ LƯU</span>
                  <div className={cls.qtyControls}>
                    <button
                      className={cls.qtyBtn}
                      onClick={() => handleQtyChange(item, -1)}
                    >
                      −
                    </button>
                    <input
                      className={cls.qtyInput}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQtyInput(e, item)}
                    />
                    <button
                      className={cls.qtyBtn}
                      onClick={() => handleQtyChange(item, +1)}
                    >
                      +
                    </button>
                  </div>
                  <div className={cls.itemPrice}>{getItemTotal(item)}</div>
                </div>

                <div className={cls.itemMetaRow}>
                  <span>
                    {item.unit === "kg" ? "Kg" : "Phần"} · {getItemPrice(item)}
                  </span>
                  {item.method || item.cookingOption ? (
                    <span className={cls.method}>
                      {item.method || item.cookingOption}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasItems && (
          <div className={cls.empty}>Chưa có món nào trong order</div>
        )}
      </div>

      {/* FOOTER */}
      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(finalTotals?.subtotal || 0)}</strong>
          </div>
          <div className={cls.row}>
            <span>Giảm giá:</span>
            <strong>{formatPrice(finalTotals?.discount || 0)}</strong>
          </div>
          <div className={cls.row}>
            <span>Thuế VAT (10%):</span>
            <strong>{formatPrice(finalTotals?.tax || 0)}</strong>
          </div>
          <div className={cls.row}>
            <span>Phí phục vụ (5%):</span>
            <strong>{formatPrice(finalTotals?.service || 0)}</strong>
          </div>
          <div className={cls.hr} />
          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(finalTotals?.total || 0)}</strong>
          </div>
        </div>

        <div className={cls.actionsGrid}>
          <button
            type="button"
            className={`${cls.btn} ${cls.secondary}`}
            onClick={handleShowClearModal}
            disabled={!hasItems}
          >
            Xóa
          </button>

          <button
            type="button"
            className={`${cls.btn} ${cls.primary}`}
            onClick={handleSaveOrder}
            disabled={!hasItems}
          >
            Lưu
          </button>

          <button
            type="button"
            className={`${cls.btn} ${cls.violet}`}
            disabled={!hasItems}
            title="In tổng"
          >
            🖨️ In tổng
          </button>

          <button
            type="button"
            className={`${cls.btn} ${cls.primary}`}
            disabled={!hasItems}
            title="In đơn"
          >
            In đơn
          </button>

          <button
            type="button"
            className={`${cls.btn} ${cls.success}`}
            disabled={!hasItems}
            onClick={() => setPaymentModalOpen(true)}
            title="Thanh toán"
          >
            Thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
