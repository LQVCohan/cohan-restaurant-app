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
    currentTable,
    currentOrder,
    updateItemQty,
    removeItem,
    totals,
    clearOrder,
    saveOrder,
  } = usePos();

  const [toastItems, setToastItems] = useState([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);

  const handlePaymentConfirm = (paymentMethod, paymentAmount) => {
    // Thực hiện thanh toán logic ở đây (có thể gửi paymentMethod và paymentAmount vào backend)
    console.log(
      "Thanh toán với phương thức:",
      paymentMethod,
      "Số tiền thanh toán:",
      paymentAmount
    );
    closePaymentModal(); // Đóng modal sau khi xác nhận thanh toán
  };
  const closePaymentModal = () => {
    setPaymentModalOpen(false); // Close the Payment Modal
  };
  const hasItems = currentOrder && currentOrder.length > 0;
  const getItemPrice = (item) => {
    if (item && !isNaN(item.price) && item.price > 0) {
      return formatPrice(item.price);
    }
    return "₫ 0"; // Giá trị mặc định khi không có giá hợp lệ
  };
  const getItemTotal = (item) => {
    if (item && !isNaN(item.total) && item.total > 0) {
      return formatPrice(item.total);
    }
    return "₫ 0"; // Giá trị mặc định khi không có tổng hợp lệ
  };
  const handleQtyChange = (item, change) => {
    const newQty = Math.max(1, item.quantity + change); // Số lượng không được nhỏ hơn 1
    updateItemQty(item.id, newQty);
  };
  const handleQtyInput = (e, item) => {
    const newQty = Math.max(1, Number(e.target.value) || 1); // Số lượng không được nhỏ hơn 1
    updateItemQty(item.id, newQty);
  };

  const handleSaveOrder = () => {
    // Lưu đơn hàng

    if (!currentTable) {
      setToastItems([
        ...toastItems,
        {
          id: new Date().getTime(),
          type: "error",
          text: "Vui lòng chọn bàn trước khi lưu.",
        },
      ]);
      return;
    }
    try {
      saveOrder();
      const newToastItem = {
        id: new Date().getTime(), // Unique ID for the toast item
        type: "success",
        text: `Đã lưu vào bàn ${currentTable?.code}`,
      };
      setToastItems((prevItems) => [...prevItems, newToastItem]);
    } catch (error) {
      setToastItems([
        ...toastItems,
        {
          id: new Date().getTime(),
          type: "error",
          text: "Lưu đơn hàng thất bại.",
          error: error.message,
        },
      ]);
      console.error("Error saving order:", error);
      return;
    }

    // Tạo thông báo và hiển thị
  };
  return (
    <div className={cls.wrapper}>
      <Toast
        items={toastItems}
        onClose={(id) =>
          setToastItems((prevItems) =>
            prevItems.filter((item) => item.id !== id)
          )
        }
      />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        onConfirm={handlePaymentConfirm}
        totalAmount={totals.total}
      />
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
                  {item.unit || "Phần"} · {getItemPrice(item)}{" "}
                  {/* Hiển thị giá hợp lệ */}
                </div>
              </div>

              <div className={cls.itemActions}>
                <button
                  className={cls.qtyBtn}
                  onClick={() => handleQtyChange(item, -1)}
                >
                  −
                </button>
                <input
                  className={cls.qtyInput}
                  type="number"
                  value={item.quantity}
                  min="1"
                  onChange={(e) => handleQtyInput(e, item)} // Cập nhật số lượng trực tiếp
                />
                <button
                  className={cls.qtyBtn}
                  onClick={() => handleQtyChange(item, +1)}
                >
                  +
                </button>
                <div className={cls.itemTotal}>{getItemTotal(item)}</div>{" "}
                {/* Hiển thị tổng hợp lệ */}
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
