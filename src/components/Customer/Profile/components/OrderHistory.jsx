import React from "react";
import "./OrderHistory.scss";

const OrderHistory = ({ user }) => {
  return (
    <div className="content-card fade-in">
      <div className="card-header">
        <h2 className="card-title">Lịch sử đơn hàng</h2>
        <div className="spending-tag">
          Tổng chi tiêu: <span>{user.totalSpending?.toLocaleString()}đ</span>
        </div>
      </div>

      <div className="empty-state">
        <div className="icon">🥡</div>
        <p>Bạn chưa có đơn hàng nào.</p>
        <button className="btn-save">Đặt món ngay</button>
      </div>
    </div>
  );
};

export default OrderHistory;
