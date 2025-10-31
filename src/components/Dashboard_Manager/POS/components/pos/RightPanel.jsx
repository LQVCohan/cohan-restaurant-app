// src/components/Dashboard_Manager/POS/components/RightPanel.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import Toast from "../../../../ui/Toast";
import { PaymentModal } from "../modals/PaymentModal";

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    restaurantId,
    currentTable,
    currentOrder,
    updateItemQty,
    removeItem,
    finalTotals,
    clearOrder,
    saveOrder,
  } = usePos();

  const [toastItems, setToastItems] = useState([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);

  const hasItems = currentOrder && currentOrder.length > 0;

  const showToast = (type, text) => {
    setToastItems((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), type, text },
    ]);
  };

  const handleQtyChange = (item, change) => {
    const newQty = Math.max(1, item.quantity + change);
    updateItemQty(item.dishId || item.id, newQty);
  };

  const handleQtyInput = (e, item) => {
    const newQty = Math.max(1, Number(e.target.value) || 1);
    updateItemQty(item.dishId || item.id, newQty);
  };

  const handleSaveOrder = async () => {
    if (!currentTable) {
      showToast("error", "Vui lòng chọn bàn trước khi lưu.");
      return;
    }
    if (!restaurantId) {
      showToast("error", "Thiếu restaurantId, vui lòng kiểm tra PosProvider.");
      return;
    }

    const res = await saveOrder({ restaurantId, persist: true });
    if (res.success) {
      showToast("success", res.message || "Đã lưu đơn.");
    } else {
      showToast("error", res.message || "Lưu đơn thất bại.");
    }
  };

  const getItemMeta = (item) => {
    const unitLabel = item.unit === "kg" || item.unit === "KG" ? "Kg" : "Phần";
    const price =
      typeof item.price === "number" ? formatPrice(item.price) : "₫ 0";
    const method = item.method || item.cookingOption;
    return `${unitLabel} · ${price}${method ? ` · ${method}` : ""}`.trim();
  };

  return (
    <div className={cls.wrapper}>
      <Toast
        items={toastItems}
        onClose={(id) =>
          setToastItems((prev) => prev.filter((t) => t.id !== id))
        }
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={() => setPaymentModalOpen(false)}
        totalAmount={finalTotals.total}
      />

      <div className={cls.header}>
        <div className={cls.headerRow}>
          <div className={cls.headerLeft}>
            <div className={cls.headerTitle}>
              {currentTable
                ? `Bàn ${currentTable.code} (${currentTable.capacity} chỗ)`
                : "Chọn bàn"}
            </div>
            <div className={cls.headerTime}>
              {new Date().toLocaleTimeString("vi-VN")}
            </div>
          </div>
          <button
            type="button"
            className={cls.backBtn}
            onClick={() => navigate("/manager/dashboard")}
          >
            ← Quay về
          </button>
        </div>
      </div>

      <div className={cls.list}>
        {hasItems ? (
          currentOrder.map((item, idx) => (
            <div
              key={(item.dishId || item.id || "") + "-" + idx}
              className={`${cls.itemRow} ${
                item.isNew ? cls.itemNew : cls.itemOld
              }`}
            >
              <div className={cls.itemMain}>
                <div className={cls.itemName}>{item.name}</div>
                <div className={cls.itemMeta}>{getItemMeta(item)}</div>
              </div>
              <div className={cls.itemActions}>
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
                <div className={cls.itemTotal}>
                  {formatPrice(item.total || item.price * item.quantity || 0)}
                </div>
                <button
                  className={cls.removeBtn}
                  onClick={() => removeItem(item.dishId || item.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={cls.empty}>Chưa có món nào được chọn</div>
        )}
      </div>

      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(finalTotals.subtotal)}</strong>
          </div>
          <div className={cls.row}>
            <span>Giảm giá:</span>
            <strong>{formatPrice(finalTotals.discount)}</strong>
          </div>
          <div className={cls.row}>
            <span>Thuế VAT (10%):</span>
            <strong>{formatPrice(finalTotals.tax)}</strong>
          </div>
          <div className={cls.row}>
            <span>Phí phục vụ (5%):</span>
            <strong>{formatPrice(finalTotals.service)}</strong>
          </div>
          <div className={cls.hr} />
          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(finalTotals.total)}</strong>
          </div>
        </div>

        <div className={cls.actionsGrid}>
          <button
            type="button"
            className={`${cls.btn} ${cls.secondary}`}
            onClick={clearOrder}
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
          <button type="button" className={`${cls.btn} ${cls.violet}`}>
            🖨️ In tổng
          </button>
          <button type="button" className={`${cls.btn} ${cls.primary}`}>
            In đơn
          </button>
          <button
            type="button"
            className={`${cls.btn} ${cls.success}`}
            onClick={() => setPaymentModalOpen(true)}
            disabled={!hasItems}
          >
            Thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
