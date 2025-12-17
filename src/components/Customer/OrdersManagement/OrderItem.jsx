import React from "react";
import "./OrderItem.scss";
import StatusChip from "./StatusChip"; // Giả sử bạn đã có component này hoặc dùng span đơn giản
import {
  Receipt,
  Truck,
  CalendarCheck,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";

const OrderItem = ({
  kind, // 'reservation' | 'delivery' | 'dinein'
  status,
  orderId,
  header,
  restaurantName,
  itemsPreview = [],
  mainInfo = [],
  actions = [],
  onClick,
}) => {
  // Config icon và màu sắc theo loại đơn
  const kindConfig = {
    reservation: {
      icon: <CalendarCheck size={14} />,
      color: "purple",
      label: "Đặt bàn",
    },
    delivery: {
      icon: <Truck size={14} />,
      color: "orange",
      label: "Giao hàng",
    },
    dinein: { icon: <Receipt size={14} />, color: "green", label: "Tại quán" },
  };
  const currentKind = kindConfig[kind] || kindConfig.dinein;

  return (
    <article className="order-card" onClick={onClick}>
      {/* HEADER: Loại đơn + Ngày giờ + Trạng thái */}
      <div className="card-header">
        <div className="header-left">
          <div className={`kind-badge ${currentKind.color}`}>
            {currentKind.icon}
            <span>{currentKind.label}</span>
          </div>
          <span className="order-time">{header?.timeText}</span>
        </div>
        <div className="header-right">
          {/* Bạn có thể dùng component StatusChip riêng hoặc span này */}
          <span className={`status-pill status-${status}`}>{status}</span>
        </div>
      </div>

      {/* BODY: Thông tin chính */}
      <div className="card-body">
        <div className="res-info">
          <div className="res-avatar">{restaurantName.charAt(0)}</div>
          <div>
            <h3 className="res-name">{restaurantName}</h3>
            <span className="order-id">#{orderId}</span>
          </div>
        </div>

        {/* List món ăn (Chỉ hiện cho Delivery/Dinein) */}
        {itemsPreview.length > 0 && (
          <div className="items-list">
            {itemsPreview.map((item, idx) => (
              <div key={idx} className="item-row">
                <span className="qty">{item.quantity}x</span>
                <span className="name">{item.name}</span>
              </div>
            ))}
            {header.moreItemsCount > 0 && (
              <div className="more-items">
                +{header.moreItemsCount} món khác
              </div>
            )}
          </div>
        )}

        {/* Thông tin Grid (Ngày giờ, Số khách, Tổng tiền...) */}
        <div className="info-grid">
          {mainInfo.map((info, idx) => (
            <div key={idx} className="info-cell">
              <span className="label">{info.label}</span>
              <span className={`value ${info.highlight ? "highlight" : ""}`}>
                {info.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER: Nút bấm hành động */}
      <div className="card-footer">
        <div className="detail-link">
          Xem chi tiết <ArrowRight size={14} />
        </div>
        <div className="action-group">
          {actions.map((action, idx) => (
            <button
              key={idx}
              className={`btn-action btn-${action.variant || "default"}`}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick && action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
};

export default OrderItem;
