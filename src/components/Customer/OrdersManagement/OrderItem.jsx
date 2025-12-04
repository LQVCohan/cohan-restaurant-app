import React from "react";
import "./OrderItem.scss";
import StatusChip from "./StatusChip";
import Icon from "../../ui/Icon";

const OrderItem = ({
  kind,
  status,
  orderId,
  header,
  restaurantName,
  itemsPreview = [],
  mainInfo = [],
  actions = [],
  onClick,
}) => {
  const kindConfig = {
    reservation: { icon: "restaurant", color: "blue", label: "Đặt bàn" },
    delivery: { icon: "truck", color: "orange", label: "Giao hàng" },
    dinein: { icon: "receipt", color: "green", label: "Tại quán" },
  };
  const currentKind = kindConfig[kind] || kindConfig.dinein;

  return (
    <article
      className={`order-card status-${status || "unknown"}`}
      onClick={onClick}
    >
      {/* HEADER */}
      <div className="card-header">
        <div className="header-left">
          <div className={`kind-badge ${currentKind.color}`}>
            <Icon name={currentKind.icon} size={14} />
            <span>{currentKind.label}</span>
          </div>
          <span className="order-id">{header?.id}</span>
          <span className="dot-separator">•</span>
          <span className="order-time">{header?.timeText}</span>
        </div>
        <div className="header-right">
          <StatusChip status={status} />
        </div>
      </div>

      {/* BODY */}
      <div className="card-body">
        {/* Tên nhà hàng - Hiển thị đúng dữ liệu từ props */}
        <h3 className="restaurant-name" title={restaurantName}>
          {restaurantName || "Thông tin nhà hàng chưa cập nhật"}
        </h3>

        {/* List món ăn */}
        {itemsPreview.length > 0 && (
          <div className="items-preview">
            {itemsPreview.map((item, idx) => (
              <div key={idx} className="item-row">
                <span className="qty">{item.quantity}x</span>
                <span className="name">{item.name}</span>
              </div>
            ))}
            {header.moreItemsCount > 0 && (
              <div className="more-items">
                ...và {header.moreItemsCount} món khác
              </div>
            )}
          </div>
        )}

        {/* Grid Info */}
        <div className="info-grid">
          {mainInfo.map((info, idx) => (
            <div key={idx} className="info-item">
              <span className="label">{info.label}</span>
              <span className={`value ${info.highlight ? "highlight" : ""}`}>
                {info.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      {actions.length > 0 && (
        <div className="card-footer" onClick={(e) => e.stopPropagation()}>
          <div className="divider"></div>
          <div className="action-buttons">
            {actions.map((action, idx) => (
              <button
                key={idx}
                className={`btn-action btn-${action.variant || "default"}`}
                onClick={action.onClick}
              >
                {action.icon && <Icon name={action.icon} size={14} />}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default OrderItem;
