import React from "react";
import { ShoppingBag, Monitor, Utensils, TableProperties } from "lucide-react";
import "./RecentOrders.scss";

const MAX_ORDERS = 6;

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const STATUS_LABEL = {
  pending: "Chờ xử lý",
  confirmed: "Chờ xử lý",
  customer_attached: "Chờ xử lý",
  preparing: "Đang chuẩn bị",
  ready: "Đang chuẩn bị",
  served: "Đang chuẩn bị",
  completed: "Hoàn thành",
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

const RecentOrders = ({
  orders = [],
  loading,
  variant = "card",
  onOpenPOS,
  onGoToMenu,
  onGoToTables,
}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const visibleOrders = safeOrders.slice(0, MAX_ORDERS);
  const shellClass =
    variant === "bare"
      ? "recent-orders recent-orders--bare"
      : "dashboard-widget recent-orders";
  const isEmpty = !loading && safeOrders.length === 0;
  const hasEmptyActions =
    typeof onOpenPOS === "function" ||
    typeof onGoToMenu === "function" ||
    typeof onGoToTables === "function";
  const bodyClass = [
    "order-list-body",
    "custom-scrollbar",
    loading ? "order-list-body--loading" : "",
    isEmpty ? "order-list-body--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {!loading && safeOrders.length > MAX_ORDERS ? (
        <p className="order-limit-note">Hiển thị {MAX_ORDERS} đơn gần nhất</p>
      ) : null}

      <div className={bodyClass}>
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

        {!loading && safeOrders.length === 0 ? (
          <div className="empty-state empty-state--operation">
            <div className="empty-icon empty-icon--operation">
              <ShoppingBag size={28} />
            </div>

            <div className="empty-state__content">
              <h4>Chưa có đơn hàng trong khoảng thời gian này</h4>
              <p>
                Mở POS để tạo đơn mới hoặc kiểm tra menu và bàn trước giờ vận
                hành.
              </p>
            </div>

            {hasEmptyActions ? (
              <div className="empty-state__actions">
                {typeof onOpenPOS === "function" ? (
                <button
                  type="button"
                  className="empty-action empty-action--primary"
                  onClick={onOpenPOS}
                  aria-label="Mở POS để tạo đơn mới"
                >
                  <Monitor size={15} />
                  <span>Mở POS</span>
                </button>
                ) : null}

                {typeof onGoToMenu === "function" ? (
                <button
                  type="button"
                  className="empty-action"
                  onClick={onGoToMenu}
                  aria-label="Đi tới quản lý menu để kiểm tra món"
                >
                  <Utensils size={15} />
                  <span>Quản lý menu</span>
                </button>
                ) : null}

                {typeof onGoToTables === "function" ? (
                <button
                  type="button"
                  className="empty-action"
                  onClick={onGoToTables}
                  aria-label="Đi tới quản lý bàn để kiểm tra bàn"
                >
                  <TableProperties size={15} />
                  <span>Quản lý bàn</span>
                </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading &&
          visibleOrders.map((order) => {
            const statusRaw = String(order?.status || "").toLowerCase();
            const statusClass = STATUS_CLASS[statusRaw] || "unknown";
            const displayCode = order?.orderCode ? `#${order.orderCode}` : "Đơn chưa có mã";
            const tableOrType = order?.tableCode || order?.tableName || order?.orderType || "Tại quầy";

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
                    {order.customerName || "Khách"} • {tableOrType}
                  </p>
                </div>

                <div className={`status-pill status-pill--${statusClass}`}>
                  {STATUS_LABEL[statusRaw] || "Không xác định"}
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
