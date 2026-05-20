import React from "react";
import { ShoppingBag } from "lucide-react";
import "./RecentOrders.scss";

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

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

const RecentOrders = ({ orders = [], loading, variant = "card" }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const shellClass = variant === "bare" ? "recent-orders recent-orders--bare" : "dashboard-widget recent-orders";

  return (
    <div className={shellClass}>
      {variant !== "bare" ? (
        <div className="widget-header">
          <h3 className="widget-title">Đơn hàng gần đây</h3>
        </div>
      ) : null}

      <div className="order-list-body custom-scrollbar">
        {loading ? <div className="empty-state"><p>Đang tải dữ liệu...</p></div> : null}
        {!loading && safeOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ShoppingBag size={28} />
            </div>
            <p>Chưa có đơn hàng trong khoảng thời gian này.</p>
          </div>
        ) : null}

        {!loading && safeOrders.map((order) => {
          const statusRaw = String(order?.status || "").toLowerCase();
          const statusClass = STATUS_CLASS[statusRaw] || "unknown";
          const statusLabel = STATUS_LABEL[statusRaw] || "Không xác định";

          return (
            <div className="order-row" key={order.id}>
              <div className="order-row__main">
                <p className="order-code">#{order.orderCode || order.id}</p>
                <p className="order-meta">
                  {order.customerName || "Khách"} • {order.tableCode || order.orderType || "Tại quầy"}
                </p>
              </div>
              <div className={`status-pill status-pill--${statusClass}`}>{statusLabel}</div>
              <div className="order-row__side">
                <p className="order-amount">{formatMoney(order.total)}</p>
                <p className="order-time">{order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "—"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentOrders;
