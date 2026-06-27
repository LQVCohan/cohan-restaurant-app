import React from "react";
import "./OrderItem.scss";
import { Receipt, Truck, CalendarCheck, ArrowRight } from "lucide-react";

const CUSTOMER_CANCEL_ALLOWED_STATUSES = new Set([
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
]);

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
  const normalizedStatus = String(status || "unknown").toLowerCase();
  const statusLabels = {
    draft: "Đang tạo",
    pending: "Đang xử lý",
    pending_payment: "Chờ cọc",
    pending_change: "Chờ nhà hàng duyệt",
    confirmed: "Đã xác nhận",
    customer_attached: "Đã gắn khách hàng",
    preparing: "Bếp đang chuẩn bị",
    ready: "Sẵn sàng phục vụ",
    served: "Đã phục vụ",
    shipping: "Đang giao",
    delivering: "Đang giao",
    completed: "Hoàn tất",
    seated: "Đã nhận bàn",
    cancelled: "Đã hủy",
    rejected: "Từ chối",
    expired: "Hết hạn",
    no_show: "Không đến",
  };
  const statusLabel = statusLabels[normalizedStatus] || status || "--";
  const displayRestaurantName = restaurantName || "Nhà hàng";
  const visibleActions = actions
    .filter((action) => {
      if (normalizedStatus !== "pending_change") return true;
      return !["Đổi giờ", "Đổi bàn"].includes(action?.label);
    })
    .filter((action) => {
      if (action?.label !== "Hủy đơn") return true;
      return CUSTOMER_CANCEL_ALLOWED_STATUSES.has(normalizedStatus);
    });

  const handleKeyDown = (event) => {
    if (!onClick) return;
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

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
    takeaway: { icon: <Receipt size={14} />, color: "blue", label: "Mang đi" },
    dinein: { icon: <Receipt size={14} />, color: "green", label: "Tại quán" },
  };
  const currentKind = kindConfig[kind] || kindConfig.dinein;

  return (
    <article
      className={`order-card order-card--${kind || "order"}`}
      aria-label={`Mở chi tiết ${orderId || "đơn hàng"}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="card-header">
        <div className="header-left">
          <div className={`kind-badge ${currentKind.color}`}>
            {currentKind.icon}
            <span>{currentKind.label}</span>
          </div>
          <span className="order-time">{header?.timeText}</span>
        </div>
        <div className="header-right">
          <span className={`status-pill status-${normalizedStatus}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="card-body">
        <div className="res-info">
          <div className="res-avatar">{displayRestaurantName.charAt(0)}</div>
          <div>
            <h3 className="res-name">{displayRestaurantName}</h3>
            <span className="order-id">#{orderId}</span>
          </div>
        </div>

        {normalizedStatus === "pending_change" && (
          <div className="items-list">
            <div className="more-items">Lịch cũ vẫn giữ hiệu lực cho đến khi nhà hàng duyệt yêu cầu.</div>
          </div>
        )}

        {itemsPreview.length > 0 && (
          <div className="items-list">
            {itemsPreview.map((item, idx) => (
              <div key={idx} className="item-row">
                <span className="qty">{item.quantity}x</span>
                <span className="name">{item.name}</span>
              </div>
            ))}
            {(header?.moreItemsCount || 0) > 0 && (
              <div className="more-items">
                +{header?.moreItemsCount} món khác
              </div>
            )}
          </div>
        )}

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

      <div className="card-footer">
        <div className="detail-link">
          Xem chi tiết <ArrowRight size={14} />
        </div>
        <div className="action-group">
          {visibleActions.map((action, idx) => (
            <button
              type="button"
              key={`${action.label}-${idx}`}
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
