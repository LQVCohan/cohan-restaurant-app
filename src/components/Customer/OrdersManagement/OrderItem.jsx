import React from "react";
import "./OrderItem.scss";
import StatusChip from "./StatusChip";
import Icon from "../../ui/Icon";

const OrderItem = ({
  kind,
  status,
  orderId,
  header,
  summary = [],
  details = [],
  actions = [],
  onClick,
}) => {
  const kindIcon =
    kind === "reservation" ? (
      <Icon name="restaurant" size={18} />
    ) : kind === "delivery" ? (
      <Icon name="truck" size={18} />
    ) : (
      <Icon name="receipt" size={18} />
    );

  return (
    <article
      className={`order-card status-${status || "unknown"}`}
      onClick={onClick}
    >
      {/* Header: 2 cột (title-left / status-right) + 2 dòng nội dung */}
      <header className="order-header">
        <div className="order-title">
          <span className="order-kind">{kindIcon}</span>
          <span className="order-id">{header?.id}</span>
        </div>

        {/* chip trạng thái vào luồng layout nên không đè nội dung */}
        <div className="order-status-slot">
          <StatusChip status={status} />
        </div>

        {/* restaurant chiếm toàn hàng, có ellipsis */}
        <div className="order-restaurant" title={header?.restaurant}>
          {header?.restaurant || "—"}
        </div>

        {/* time line */}
        <div className="order-time">{header?.timeText}</div>
      </header>

      {/* Summary block (optional) */}
      {summary?.length > 0 && (
        <section className="order-summary">
          {summary.map((s, i) => (
            <div key={i} className="order-summary-item">
              <span className="label">{s.label}</span>
              <strong className="value">{s.value}</strong>
            </div>
          ))}
        </section>
      )}

      {/* Details block (optional) */}
      {details?.length > 0 && (
        <section className="order-details">
          {details.map((d, i) => (
            <div key={i} className="detail-row">
              <span className="detail-label">{d.label}</span>
              <span className="detail-value">{d.value}</span>
            </div>
          ))}
        </section>
      )}

      {/* Action bar: luôn neo góc phải dưới, sắp xếp gọn */}
      {actions?.length > 0 && (
        <footer
          className="order-actions"
          onClick={(e) => e.stopPropagation()}
          aria-label="Thao tác đơn hàng"
        >
          {actions.map((a, i) => (
            <button
              key={i}
              className={`btn btn-${a.variant || "primary"}`}
              onClick={a.onClick}
              type="button"
            >
              {a.icon && (
                <Icon name={a.icon} size={16} style={{ marginRight: 6 }} />
              )}
              {a.label}
            </button>
          ))}
        </footer>
      )}
    </article>
  );
};

export default OrderItem;
