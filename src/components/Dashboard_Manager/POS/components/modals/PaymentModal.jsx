import React, { useState, useEffect, memo } from "react";
import s from "./PaymentModal.module.scss"; // Đảm bảo file SCSS này tồn tại
import { formatPrice } from "@/utils/formatters"; // Đảm bảo đường dẫn này đúng

// --- Component QR Code (Nội tuyến) ---
const QRCodePlaceholder = ({ value }) => (
  <div className={s.qrImage}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="140"
      height="140"
    >
      <rect width="100" height="100" fill="#f0f9ff" />
      <text
        x="50"
        y="50"
        dy=".3em"
        textAnchor="middle"
        fontSize="10"
        fill="#0c4a6e"
      >
        QR Placeholder
      </text>
      <text
        x="50"
        y="65"
        dy=".3em"
        textAnchor="middle"
        fontSize="8"
        fill="#0284c7"
      >
        {value}
      </text>
    </svg>
  </div>
);

// --- Component Chính ---
function PaymentModal({
  isOpen,
  order, // Đây là 'currentOrder' (mảng)
  table, // Đây là 'currentTable'
  onClose,
  onComplete,
  totalAmount,
  loading,
}) {
  const [method, setMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);

  // Lấy totalAmount từ order đó, hoặc từ prop 'totalAmount' nếu bạn truyền riêng

  // Lấy danh sách món ăn từ order đó

  const changeAmount = Math.max(0, paidAmount - totalAmount);

  useEffect(() => {
    if (method === "card" || method === "transfer") {
      setPaidAmount(totalAmount);
    } else {
      // Khi chuyển về tiền mặt, reset về 0
      setPaidAmount(0);
    }
  }, [method, isOpen, totalAmount]); // Thêm isOpen để reset khi mở lại

  const handleSuggestion = (value) => {
    if (value === "exact") {
      setPaidAmount(totalAmount);
    } else {
      setPaidAmount(value);
    }
  };

  const handleComplete = () => {
    if (loading) return;
    onComplete?.({
      orderId: order.id,
      method,
      paidAmount: paidAmount,
      total: totalAmount,
      change: changeAmount,
      status: "COMPLETED",
    });
  };

  // Tạo gợi ý tiền
  const getSuggestions = (total) => {
    if (total === 0) return [50000, 100000, 200000];
    const suggestions = new Set();
    suggestions.add(Math.ceil(total / 1000) * 1000); // Làm tròn

    if (total < 100000) {
      suggestions.add(100000);
      suggestions.add(200000);
      suggestions.add(500000);
    } else if (total < 500000) {
      suggestions.add(Math.ceil(total / 100000) * 100000);
      suggestions.add(500000);
      suggestions.add(1000000);
    } else {
      suggestions.add(Math.ceil(total / 100000) * 100000);
      suggestions.add(1000000);
      suggestions.add(2000000);
    }
    return Array.from(suggestions)
      .filter((val) => val >= total) // Bao gồm cả tiền đủ
      .slice(0, 3);
  };

  const suggestions = getSuggestions(totalAmount);
  if (!isOpen) return null;

  const isCash = method === "cash";
  const isTransfer = method === "transfer";

  return (
    <div className={s.backdrop_overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <button className={s.closeButton} onClick={onClose} disabled={loading}>
          &times;
        </button>
        <h3 className={s.title}>🧾 Thanh Toán Hóa Đơn</h3>
        <p className={s.orderInfo}>
          Bàn: <b>{table?.code || "..."}</b> | Hóa đơn:{" "}
          <b>{order[0]?.orderCode || "..."}</b>
        </p>

        {/* Bố cục 2 cột */}
        <div className={s.mainContent}>
          {/* --- CỘT TRÁI (CHI TIẾT MÓN) --- */}
          <div className={s.leftPanel}>
            <h4 className={s.panelTitle}>Chi tiết Hóa đơn</h4>
            <div className={s.itemsList}>
              {order.length > 0 ? (
                order.map((item, index) => (
                  <div
                    key={item._lineId || item.dishId || index}
                    className={s.itemRow}
                  >
                    <div className={s.itemInfo}>
                      <span className={s.itemName}>
                        {item.quantity} x {item.name}
                      </span>
                      <span className={s.itemPrice}>
                        {formatPrice(item.price + (item.modifiersPrice || 0))}
                      </span>
                    </div>
                    <div className={s.itemTotal}>
                      {formatPrice(
                        (item.price + (item.modifiersPrice || 0)) *
                          item.quantity
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className={s.itemRow}>
                  <span className={s.itemName}>Chưa có món nào...</span>
                </div>
              )}
            </div>
          </div>

          {/* --- CỘT PHẢI (THANH TOÁN) --- */}
          <div className={s.rightPanel}>
            {/* TỔNG KẾT */}
            <div className={s.summary}>
              <div className={s.row}>
                <span>Tạm tính:</span>
                <span>{formatPrice(totalAmount.subtotal)}</span>
              </div>
              <div className={s.row}>
                <span>Giảm giá:</span>
                <span className={s.discount}>
                  - {formatPrice(totalAmount.discount)}
                </span>
              </div>
              <div className={s.row}>
                <span>VAT/Phí:</span>
                <span>
                  {formatPrice(totalAmount.tax + totalAmount.service)}
                </span>
              </div>
              <div className={`${s.row} ${s.totalRow}`}>
                <span className={s.label}>Khách cần trả</span>
                <span className={s.totalAmount}>
                  {formatPrice(totalAmount)}
                </span>
              </div>
            </div>

            {/* PHƯƠNG THỨC */}
            <div className={s.group}>
              <label className={s.label}>Chọn phương thức</label>
              <div className={s.grid}>
                {["cash", "card", "transfer"].map((m) => (
                  <button
                    key={m}
                    className={`${s.btn} ${method === m ? s.active : ""}`}
                    onClick={() => setMethod(m)}
                  >
                    {m === "cash"
                      ? "Tiền mặt"
                      : m === "card"
                      ? "Thẻ"
                      : "Chuyển khoản"}
                  </button>
                ))}
              </div>
            </div>

            {/* THÔNG TIN CHUYỂN KHOẢN */}
            {isTransfer && (
              <div className={s.transferInfo}>
                <div className={s.paymentDetails}>
                  <div className={s.detailItem}>
                    <span>Ngân hàng:</span> <b>Vietcombank</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số TK:</span> <b>1234567890</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số tiền:</span> <b>{formatPrice(totalAmount)}</b>
                  </div>
                </div>
                <div className={s.qrCode}>
                  <QRCodePlaceholder value={formatPrice(totalAmount)} />
                </div>
              </div>
            )}

            {/* SỐ TIỀN (TIỀN MẶT) */}
            {isCash && (
              <div className={s.group}>
                <label className={s.label}>Số tiền khách đưa</label>
                <input
                  type="number"
                  className={s.input}
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  autoFocus
                />
                <div className={s.suggestions}>
                  {suggestions.map((val) => (
                    <button
                      key={val}
                      className={s.suggestionBtn}
                      onClick={() => handleSuggestion(val)}
                    >
                      {formatPrice(val)}
                    </button>
                  ))}
                </div>
                <div className={`${s.row} ${s.changeRow}`}>
                  <span className={s.label}>Tiền thối lại</span>
                  <span className={s.changeAmount}>
                    {formatPrice(changeAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* HÀNH ĐỘNG */}
        <div className={s.actions}>
          <button className={s.secondary} onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button
            className={`${s.success} ${loading ? s.loading : ""}`}
            onClick={handleComplete}
            disabled={loading || (isCash && paidAmount < totalAmount)}
          >
            {loading ? (
              <span className={s.spinner}></span>
            ) : (
              "Hoàn tất thanh toán"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Bọc component bằng memo khi export
export default memo(PaymentModal);
