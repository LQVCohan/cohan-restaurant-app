import React, { useMemo } from "react";
import "./OrderSummary.scss";

export default function OrderSummary({ lines = [], vat = 0.1, discount = 0 }) {
  const sums = useMemo(() => {
    const sub = lines.reduce((acc, l) => acc + (l.lineTotal || 0), 0);
    const vatAmt = Math.max(0, Math.round(sub * vat));
    const total = Math.max(0, sub + vatAmt - discount);
    return { sub, vatAmt, total };
  }, [lines, vat, discount]);

  return (
    <div className="order-summary">
      <div className="summary-row">
        <span>Tạm tính</span>
        <strong>{sums.sub.toLocaleString("vi-VN")}₫</strong>
      </div>
      <div className="summary-row">
        <span>VAT ({Math.round(vat * 100)}%)</span>
        <strong>{sums.vatAmt.toLocaleString("vi-VN")}₫</strong>
      </div>
      {discount ? (
        <div className="summary-row">
          <span>Giảm giá</span>
          <strong>-{discount.toLocaleString("vi-VN")}₫</strong>
        </div>
      ) : null}
      <div className="summary-row summary-row--total">
        <span>Tổng cộng</span>
        <strong>{sums.total.toLocaleString("vi-VN")}₫</strong>
      </div>
    </div>
  );
}
