import React from "react";
import { ShoppingBag } from "lucide-react";
import "./RecentOrders.scss";

const MAX_ORDERS = 6;
const formatMoney = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(date);
};
const STATUS_LABEL = { pending: "Chờ xử lý", confirmed: "Chờ xử lý", customer_attached: "Chờ xử lý", preparing: "Đang chuẩn bị", ready: "Đang chuẩn bị", served: "Đang chuẩn bị", completed: "Hoàn thành", cancelled: "Đã hủy" };
const STATUS_CLASS = { pending: "pending", confirmed: "pending", customer_attached: "pending", preparing: "preparing", ready: "preparing", served: "preparing", completed: "completed", cancelled: "cancelled" };

const RecentOrders = ({ orders = [], loading, variant = "card" }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const visibleOrders = safeOrders.slice(0, MAX_ORDERS);
  const shellClass = variant === "bare" ? "recent-orders recent-orders--bare" : "dashboard-widget recent-orders";

  return (
    <div className={shellClass}>
      {!loading && safeOrders.length > MAX_ORDERS ? <p className="order-limit-note">Hiển thị 6 đơn gần nhất</p> : null}
      <div className="order-list-body custom-scrollbar">
        {loading ? <div className="empty-state"><p>Đang tải dữ liệu...</p></div> : null}
        {!loading && safeOrders.length === 0 ? <div className="empty-state"><div className="empty-icon"><ShoppingBag size={26} /></div><p>Chưa có đơn hàng trong khoảng thời gian này.</p></div> : null}
        {!loading && visibleOrders.map((order) => {
          const statusRaw = String(order?.status || "").toLowerCase();
          return (
            <div className="order-row" key={order.id}>
              <div className="order-row__main">
                <p className="order-code" title={`#${order.orderCode || order.id}`}>#{order.orderCode || order.id}</p>
                <p className="order-meta">{order.customerName || "Khách"} • {order.tableCode || order.orderType || "Tại quầy"}</p>
              </div>
              <div className={`status-pill status-pill--${STATUS_CLASS[statusRaw] || "unknown"}`}>{STATUS_LABEL[statusRaw] || "Không xác định"}</div>
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
