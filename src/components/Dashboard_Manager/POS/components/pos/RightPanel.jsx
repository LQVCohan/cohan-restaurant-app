import React from "react";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    currentTable,
    currentOrder,
    updateItemQty,
    removeItem,
    totals,
    clearOrder,
    saveOrder,
  } = usePos();

  const hasItems = currentOrder && currentOrder.length > 0;

  return (
    <div className={cls.wrapper}>
      {/* HEADER */}
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

          {/* Nút back nằm ngoài cùng bên phải */}
          <button
            type="button"
            className={cls.backBtn}
            onClick={() => navigate("/manager/dashboard")}
            aria-label="Quay về Dashboard"
            title="Quay về Dashboard"
          >
            ← Quay về
          </button>
        </div>
      </div>

      {/* DANH SÁCH MÓN */}
      <div className={cls.list}>
        {hasItems ? (
          currentOrder.map((item) => (
            <div key={item.id} className={cls.itemRow}>
              <div className={cls.itemMain}>
                <div className={cls.itemName}>{item.name}</div>
                <div className={cls.itemMeta}>
                  {item.unit || "Phần"} · {formatPrice(item.price)}
                </div>
              </div>

              <div className={cls.itemActions}>
                <button
                  className={cls.qtyBtn}
                  onClick={() => updateItemQty(item.id, -1)}
                >
                  −
                </button>
                <span className={cls.qty}>{item.quantity}</span>
                <button
                  className={cls.qtyBtn}
                  onClick={() => updateItemQty(item.id, +1)}
                >
                  +
                </button>

                <div className={cls.itemTotal}>{formatPrice(item.total)}</div>

                <button
                  className={cls.removeBtn}
                  onClick={() => removeItem(item.id)}
                  aria-label="Xóa món"
                  title="Xóa món"
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

      {/* FOOTER: Tổng kết + nút hành động */}
      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(totals.subtotal)}</strong>
          </div>
          <div className={cls.row}>
            <span>Giảm giá:</span>
            <strong>{formatPrice(totals.discount)}</strong>
          </div>
          <div className={cls.row}>
            <span>Thuế VAT (10%):</span>
            <strong>{formatPrice(totals.tax)}</strong>
          </div>
          <div className={cls.row}>
            <span>Phí phục vụ (5%):</span>
            <strong>{formatPrice(totals.service)}</strong>
          </div>
          <div className={cls.hr} />
          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(totals.total)}</strong>
          </div>
        </div>

        {/* NÚT HÀNH ĐỘNG: auto-fit grid */}
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
            onClick={saveOrder}
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
            title="Thanh toán"
          >
            Thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
