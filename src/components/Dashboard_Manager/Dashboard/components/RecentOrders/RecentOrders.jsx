import React from "react";
import "./RecentOrders.scss";

const OrderItem = ({ orderNumber, customerName, amount, status }) => {
  const getStatusClass = (status) => {
    const statusMap = {
      pending: "status-pending",
      preparing: "status-preparing",
      ready: "status-ready",
      delivered: "status-delivered",
    };
    return statusMap[status] || "status-pending";
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: "Chờ xác nhận",
      preparing: "Đang chuẩn bị",
      ready: "Sẵn sàng",
      delivered: "Đã giao",
    };
    return statusMap[status] || "Chờ xác nhận";
  };

  return (
    <div className="order-item">
      <div className="order-info">
        <h4>Đơn hàng #{orderNumber}</h4>
        <p>
          {customerName} • {amount}
        </p>
      </div>
      <span className={`order-status ${getStatusClass(status)}`}>
        {getStatusLabel(status)}
      </span>
    </div>
  );
};

const RecentOrders = () => {
  const orders = [
    {
      orderNumber: "1234",
      customerName: "Nguyễn Văn A",
      amount: "₫450.000",
      status: "preparing",
    },
    {
      orderNumber: "1235",
      customerName: "Trần Thị B",
      amount: "₫320.000",
      status: "ready",
    },
    {
      orderNumber: "1236",
      customerName: "Lê Văn C",
      amount: "₫280.000",
      status: "pending",
    },
    {
      orderNumber: "1237",
      customerName: "Phạm Thị D",
      amount: "₫520.000",
      status: "delivered",
    },
  ];

  return (
    <div className="orders-card fade-in">
      <div className="orders-header">
        <h3 className="orders-title">🛍️ Đơn Hàng Gần Đây</h3>
        <a href="#" className="view-all-btn">
          Xem tất cả
        </a>
      </div>
      <div className="orders-list">
        {orders.map((order, index) => (
          <OrderItem
            key={index}
            orderNumber={order.orderNumber}
            customerName={order.customerName}
            amount={order.amount}
            status={order.status}
          />
        ))}
      </div>
    </div>
  );
};

export default RecentOrders;
