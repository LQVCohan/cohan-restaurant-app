import React from "react";
import Button from "../../../common/Button";
import "./OrderItem.scss";

export default function OrderItem({ line, onIncrease, onDecrease, onRemove }) {
  const { name, options = [], quantity, lineTotal, isNew } = line;

  return (
    <div
      className={`order-item ${
        isNew ? "order-item--new" : "order-item--existing"
      }`}
    >
      <div className="order-item-info">
        <div className="order-item-name">
          {name}
          {isNew ? <span className="new-badge">MỚI</span> : null}
        </div>
        {options?.length ? (
          <div className="order-item-options">
            {options.map((o, idx) => (
              <span key={`${o.name}-${idx}`}>
                {o.name}
                {o.value ? `: ${o.value}` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="quantity-controls">
        <Button
          size="sm"
          variant="secondary"
          className="qty-btn"
          onClick={() => onDecrease?.(line)}
        >
          -
        </Button>
        <div className="quantity">{quantity}</div>
        <Button
          size="sm"
          variant="secondary"
          className="qty-btn"
          onClick={() => onIncrease?.(line)}
        >
          +
        </Button>
      </div>

      <div className="order-item-price">
        {lineTotal?.toLocaleString?.("vi-VN")}₫
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="remove-btn"
        onClick={() => onRemove?.(line)}
        aria-label="Xóa"
        title="Xóa"
      >
        ✕
      </Button>
    </div>
  );
}
