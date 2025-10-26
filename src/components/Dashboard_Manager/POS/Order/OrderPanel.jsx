import React from "react";
import "./OrderPanel.scss";
import OrderItem from "./OrderItem";
import OrderSummary from "./OrderSummary";
import Button from "../../../common/Button";

export default function OrderPanel({
  table,
  existingLines = [],
  newLines = [],
  onInc,
  onDec,
  onRemove,
  onCheckout,
  onPrint,
  vat = 0.1,
  discount = 0,
}) {
  return (
    <div className="order-panel">
      <div className="order-header">
        <div className="order-info">
          <div className="table-info">
            {table ? `Bàn ${table.code}` : "Chưa chọn bàn"}
          </div>
          <div className="order-time">{new Date().toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <div className="order-items">
        {existingLines.length ? (
          <section className="order-section">
            <div className="order-section-header order-section-header--existing">
              <span className="section-icon">🧾</span>
              <span>Đã gọi (POS xác nhận)</span>
            </div>
            {existingLines.map((l) => (
              <OrderItem
                key={l.id}
                line={{ ...l, isNew: false }}
                onIncrease={onInc}
                onDecrease={onDec}
                onRemove={onRemove}
              />
            ))}
          </section>
        ) : null}

        {newLines.length ? (
          <section className="order-section">
            <div className="order-section-header order-section-header--new">
              <span className="section-icon">✨</span>
              <span>Chưa gửi (Mới chọn)</span>
            </div>
            {newLines.map((l) => (
              <OrderItem
                key={l.id}
                line={{ ...l, isNew: true }}
                onIncrease={onInc}
                onDecrease={onDec}
                onRemove={onRemove}
              />
            ))}
          </section>
        ) : null}

        {!existingLines.length && !newLines.length ? (
          <div className="order-empty">
            <p>Chưa có món trong đơn.</p>
          </div>
        ) : null}
      </div>

      <OrderSummary
        lines={[...existingLines, ...newLines]}
        vat={vat}
        discount={discount}
      />

      <div className="action-buttons">
        <Button variant="secondary" onClick={onPrint}>
          In tạm tính
        </Button>
        <Button variant="success" onClick={onCheckout}>
          Thanh toán
        </Button>
      </div>
    </div>
  );
}
