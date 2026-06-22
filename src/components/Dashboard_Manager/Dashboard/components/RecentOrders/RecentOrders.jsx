import React from "react";
import { ShoppingBag, Monitor } from "lucide-react";
import "./RecentOrders.scss";

const MAX_ORDERS = 6;

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatTime = (value) => {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  customer_attached: "Chờ xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng phục vụ",
  served: "Đã phục vụ",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const STATUS_CLASS = {
  pending: "pending",
  confirmed: "pending",
  customer_attached: "pending",
  preparing: "preparing",
  ready: "preparing",
  served: "preparing",
  completed: "completed",
  cancelled: "cancelled",
};

const ORDER_TYPE_LABEL = {
  DINE_IN: "Dùng tại bàn",
  TAKEAWAY: "Mang đi",
  DELIVERY: "Giao hàng",
  PICKUP: "Nhận tại quầy",
  dine_in: "Dùng tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
  pickup: "Nhận tại quầy",
};

const RecentOrders = ({
  orders = [],
  loading,
  variant = "card",
  onOpenPOS,
}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const visibleOrders = safeOrders.slice(0, MAX_ORDERS);
  const shellClass =
    variant === "bare"
      ? "recent-orders recent-orders--bare"
      : "dashboard-widget recent-orders";
  const isEmpty = !loading && safeOrders.length === 0;
  const orderDensityClass =
    !loading && safeOrders.length > 0 && safeOrders.length <= 3
      ? "order-list-body--compact"
      : "order-list-body--scrollable";
  const bodyClass = [
    "order-list-body",
    "custom-scrollbar",
    orderDensityClass,
    loading ? "order-list-body--loading" : "",
    isEmpty ? "order-list-body--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {!loading && safeOrders.length > MAX_ORDERS ? (
        <p className="order-limit-note">
          Đang hiển thị {MAX_ORDERS} đơn gần nhất
        </p>
      ) : null}

      <div className={bodyClass}>
        {!loading && visibleOrders.length > 1 ? (
          <div className="order-table-head" aria-hidden="true">
            <span>Đơn hàng và khách</span>
            <span>Trạng thái</span>
            <span>Giá trị và thời gian</span>
          </div>
        ) : null}

        {loading ? (
          <div className="orders-skeleton" role="status" aria-live="polite">
            {[0, 1, 2, 3].map((item) => (
              <div className="orders-skeleton__row" key={item}>
                <span />
                <span />
                <span />
              </div>
            ))}
            <p className="sr-only">Đang tải dữ liệu đơn hàng</p>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="empty-state empty-state--operation">
            <div className="empty-icon empty-icon--operation" aria-hidden="true">
              <ShoppingBag size={19} />
            </div>
            <div className="empty-state__content">
              <h4>Chưa có đơn hàng trong thời gian đã chọn</h4>
              <p>Đơn mới sẽ xuất hiện tại đây sau khi được tạo.</p>
            </div>
            {typeof onOpenPOS === "function" ? (
              <div className="empty-state__actions">
                <button
                  type="button"
                  className="empty-action empty-action--primary"
                  onClick={onOpenPOS}
                >
                  <Monitor size={15} />
                  <span>Mở bán hàng</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading &&
          visibleOrders.map((order) => {
            const statusRaw = String(order?.status || "").toLowerCase();
            const statusClass = STATUS_CLASS[statusRaw] || "unknown";
            const displayCode = order?.orderCode
              ? `#${order.orderCode}`
              : "Đơn chưa có mã";
            const orderType =
              ORDER_TYPE_LABEL[order?.orderType] ||
              order?.orderType ||
              "Dùng tại quầy";
            const tableOrType =
              order?.tableCode || order?.tableName || orderType;

            return (
              <div
                className={`order-row order-row--${statusClass}`}
                key={order.id || order.orderCode}
              >
                <div className="order-row__main">
                  <p className="order-code" title={displayCode}>
                    {displayCode}
                  </p>
                  <p className="order-meta">
                    {order.customerName || "Khách lẻ"} • {tableOrType}
                  </p>
                </div>
                <div className={`status-pill status-pill--${statusClass}`}>
                  {STATUS_LABEL[statusRaw] || "Chưa xác định"}
                </div>
                <div className="order-row__side">
                  <p className="order-amount">{formatMoney(order.total)}</p>
                  <p className="order-time">{formatTime(order.createdAt)}</p>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default RecentOrders;
