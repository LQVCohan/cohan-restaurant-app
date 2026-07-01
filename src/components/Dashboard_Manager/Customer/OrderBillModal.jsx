// components/OrderBillModal.jsx
import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, Download, X, Share2 } from "lucide-react";
import "./OrderBillModal.scss";

/* --- 1. Helpers & Meta --- */

const ORDER_STATUS_META = {
  pending: { label: "CHỜ XÁC NHẬN" },
  confirmed: { label: "ĐÃ XÁC NHẬN" },
  preparing: { label: "ĐANG CHẾ BIẾN" },
  ready: { label: "SẴN SÀNG" },
  served: { label: "ĐÃ PHỤC VỤ" },
  paid: { label: "ĐÃ THANH TOÁN" },
  completed: { label: "HOÀN TẤT" },
  cancelled: { label: "ĐÃ HỦY" },
  default: { label: "KHÔNG RÕ" },
};

const normalizeEpochToMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
    const len = String(Math.floor(v)).length;
    return len === 10 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return String(n).length === 10 ? n * 1000 : n;
    }
    const p = Date.parse(s);
    return Number.isFinite(p) ? p : null;
  }
  return null;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
    .format(amount)
    .replace("₫", ""); // Bỏ ký hiệu đ để style tay cho đẹp nếu muốn, hoặc giữ lại
};

const toDateTimeVI = (ts) => {
  const ms = normalizeEpochToMs(ts);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("vi-VN");
};

/* --- 2. Component --- */

const OrderBillModal = ({ customer, order, onClose }) => {
  const printRef = useRef();

  // Parse Data
  const raw = order?.raw || {};
  const createdAt = raw?.createdAt ?? order?.date ?? Date.now();
  const createdAtStr = toDateTimeVI(createdAt);

  const statusKey = (
    raw?.currentStatus ||
    order?.status ||
    "default"
  ).toLowerCase();
  const statusLabel = (
    ORDER_STATUS_META[statusKey] || ORDER_STATUS_META.default
  ).label;

  // Items Parsing
  const billItems =
    Array.isArray(raw?.items) && raw.items.length
      ? raw.items.map((it) => ({
          name: it?.name || "Món chưa đặt tên",
          price: Math.round(
            (Number(it?.price) || 0) + (Number(it?.modifiersPrice) || 0)
          ),
          quantity: Number(it?.quantity || 1),
        }))
      : (order?.items || []).map((item) => ({
          name: typeof item === "string" ? item : "Món mẫu",
          price: 50000,
          quantity: 1,
        }));

  // Calculations
  const subtotal = billItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = Math.floor(subtotal * 0.08); // Giả sử 8% VAT
  const total =
    raw?.totals?.grandTotal != null
      ? Number(raw.totals.grandTotal)
      : subtotal + tax;

  // Format Bill ID: #CUS-ID-CODE
  const billNo = `${(customer?.id || "001").toString().slice(-3)}${(
    order?.orderCode || "ABC"
  )
    .toString()
    .slice(-4)
    .toUpperCase()}`;

  const handlePrint = () => {
    // Logic in đơn giản (hoặc gọi API in)
    window.print();
  };

  return createPortal(
    <div className="bill-overlay">
      <div className="bill-container">
        {/* === TOOLBAR (Nằm ngoài tờ giấy) === */}
        <div className="bill-actions">
          <button className="bill-btn btn-print" onClick={handlePrint}>
            <Printer size={16} />
            <span>In hóa đơn</span>
          </button>
          <button className="bill-btn btn-print">
            <Download size={16} />
            <span>Tải về</span>
          </button>
          <button className="bill-btn btn-close" onClick={onClose}>
            <X size={20} />
            <span>Đóng</span>
          </button>
        </div>

        {/* === BILL PAPER (Tờ giấy hóa đơn) === */}
        <div className="bill-paper" ref={printRef}>
          <div className="bill-content">
            {/* Header */}
            <div className="bill-brand">
              <h2>Cohan Bistro</h2>
              <p>123 Nguyễn Huệ, Quận 1, TP.HCM</p>
              <p>Hotline: 1900 123 456</p>
            </div>

            <div className="bill-divider" />

            {/* Meta Info */}
            <div className="bill-info-section">
              <div className="bill-info-row">
                <span className="label">Ngày:</span>
                <span className="val">{createdAtStr}</span>
              </div>
              <div className="bill-info-row">
                <span className="label">Số HĐ:</span>
                <span className="val">#{billNo}</span>
              </div>
              <div className="bill-info-row">
                <span className="label">Khách:</span>
                <span className="val">{customer?.name || "Khách lẻ"}</span>
              </div>
              <div className="bill-info-row">
                <span className="label">Trạng thái:</span>
                <span className="val">{statusLabel}</span>
              </div>
            </div>

            <div className="bill-divider" />

            {/* Items Table */}
            <div className="bill-items-section">
              <div className="bill-table-header">
                <span style={{ flex: 1 }}>Món</span>
                <span style={{ width: 30, textAlign: "center" }}>SL</span>
                <span style={{ width: 70, textAlign: "right" }}>
                  Thành tiền
                </span>
              </div>

              {billItems.map((item, idx) => (
                <div key={idx} className="bill-item">
                  <div className="item-name">{item.name}</div>
                  <div className="item-qty">{item.quantity}</div>
                  <div className="item-price">
                    {formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="bill-divider" />

            {/* Summary */}
            <div className="bill-summary">
              <div className="sum-row">
                <span className="label">Tạm tính</span>
                <span className="val mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="sum-row">
                <span className="label">VAT (8%)</span>
                <span className="val mono">{formatCurrency(tax)}</span>
              </div>
              <div className="sum-row total">
                <span>TỔNG CỘNG</span>
                <span className="mono">{formatCurrency(total)} đ</span>
              </div>
            </div>

            {/* Footer */}
            <div className="bill-footer">
              <div className="barcode-fake" />
              <div className="thank-you">*** CẢM ƠN QUÝ KHÁCH ***</div>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>
                Wifi: Cohan_Free / Pass: 12345678
              </p>
            </div>
          </div>
          {/* Zigzag bottom được tạo bởi CSS ::after */}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderBillModal;
