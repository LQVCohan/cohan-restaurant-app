import React from "react";
import { ShoppingBag } from "lucide-react";
import "./RecentOrders.scss";

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const RecentOrders = ({ orders = [], loading }) => {
  return (
    <div className="dashboard-widget recent-orders">
      <div className="widget-header">
        <h3 className="widget-title">Đơn Hàng Gần Đây</h3>
      </div>
      <div className="table-header-row">
        <span className="th-1">Khách hàng / Mã</span>
        <span className="th-2">Thực đơn gọi</span>
        <span className="th-3">Trạng thái</span>
        <span className="th-4">Tổng tiền</span>
        <span className="th-5"></span>
      </div>
      <div className="order-list-body custom-scrollbar">
        {loading ? <div className="empty-state"><p>Đang tải...</p></div> : null}
        {!loading && orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ShoppingBag size={40} />
            </div>
            <p>Chưa có đơn hàng nào</p>
          </div>
        ) : null}
        {!loading &&
          orders.map((order) => (
            <div className="order-row fade-in-item" key={order.id}>
              <div className="col-info">
                <div className="text-wrapper">
                  <div className="row-top">
                    <span className="customer-name">{order.customerName || "Khách"}</span>
                    <span className="dot">•</span>
                    <span className="order-id">#{order.orderCode || order.id}</span>
                  </div>
                  <div className="row-bottom">
                    <span className="location-tag">{order.tableCode || order.orderType}</span>
                    <span className="time-ago">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-menu">
                <span className="menu-text">{(order.itemNames || []).slice(0, 2).join(", ")}</span>
              </div>
              <div className="col-status">
                <div className="status-pill">
                  <span>{order.status || "pending"}</span>
                </div>
              </div>
              <div className="col-total">
                <span className="amount">{formatMoney(order.total)}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default RecentOrders;
