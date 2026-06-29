import React, { useState } from "react";
import { Copy, X } from "lucide-react";
import { formatDate } from "./couponUtils";

const CouponDetailModal = ({ coupon, onClose }) => {
  const [message, setMessage] = useState("");
  if (!coupon) return null;

  const titleId = "coupon-detail-title";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code || "");
      setMessage("Đã sao chép mã coupon");
    } catch {
      setMessage("Không thể sao chép, vui lòng sao chép thủ công");
    }
  };

  return (
    <div className="coupon-modal" role="presentation" onClick={onClose}>
      <div
        className="coupon-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="coupon-modal__close" type="button" onClick={onClose} aria-label="Đóng chi tiết coupon"><X size={22} aria-hidden="true" /></button>
        <div className="coupon-modal__hero">
          <span>{coupon.discountLabel}</span>
          <h2 id={titleId}>{coupon.name}</h2>
          <p>Hạn sử dụng: {formatDate(coupon.endAt)}</p>
        </div>
        <div className="coupon-modal__code">
          <code aria-label={`Mã coupon ${coupon.code || "không có mã"}`}>{coupon.code || "Không có mã"}</code>
          <button type="button" onClick={copyCode} disabled={!coupon.code}><Copy size={16} aria-hidden="true" /> Copy mã</button>
        </div>
        {message && <p className="coupon-modal__message" role="status" aria-live="polite">{message}</p>}
        <h3>Điều kiện áp dụng</h3>
        <ul>{coupon.conditions.map((line, index) => <li key={`${coupon.id}-condition-${index}`}>{line}</li>)}</ul>
      </div>
    </div>
  );
};

export default CouponDetailModal;
