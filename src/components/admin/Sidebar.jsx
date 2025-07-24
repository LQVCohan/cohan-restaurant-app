// src/components/Sidebar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Sidebar.scss";

const Sidebar = () => {
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <h1 className="sidebar-title">🍽️ RestaurantPro</h1>
        <nav className="sidebar-nav">
          <div className="sidebar-item active" data-section="dashboard">
            <span className="sidebar-text">📊 Dashboard</span>
          </div>
          <div className="sidebar-item" data-section="orders">
            <span className="sidebar-text">🛒 Đơn hàng</span>
          </div>
          <div className="sidebar-item" data-section="menu">
            <span className="sidebar-text">📋 Thực đơn</span>
          </div>
          <div className="sidebar-item" data-section="tables">
            <span className="sidebar-text">🪑 Bàn ăn</span>
          </div>
          <div className="sidebar-item" data-section="staff">
            <span className="sidebar-text">👥 Nhân viên</span>
          </div>
          <div className="sidebar-item" data-section="inventory">
            <span className="sidebar-text">📦 Kho hàng</span>
          </div>
          <div className="sidebar-item" data-section="reports">
            <span className="sidebar-text">📈 Báo cáo</span>
          </div>
          <div className="sidebar-item" data-section="restaurants">
            <span className="sidebar-text">🏠 Quản Lý Nhà Hàng</span>
          </div>
          <div className="sidebar-item" data-section="promotions">
            <span className="sidebar-text">🎁 Quản Lý Khuyến Mãi</span>
          </div>
          <div className="sidebar-item" data-section="users">
            <span className="sidebar-text">👤 Quản Lý Người Dùng</span>
          </div>
          <div className="sidebar-item" data-section="settings">
            <span className="sidebar-text">⚙️ Cài Đặt</span>
          </div>
          <div className="sidebar-item" onClick={() => navigate("/logout")}>
            <span className="sidebar-text">🚪 Đăng Xuất</span>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
