// src/components/Sidebar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Sidebar.scss";

const Sidebar = () => {
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <h2>Admin Menu</h2>
      <ul>
        <li onClick={() => navigate("/admin/dashboard")}>Dashboard</li>
        <li onClick={() => navigate("/restaurants")}>Quản Lý Nhà Hàng</li>
        <li onClick={() => navigate("/menu")}>Quản Lý Menu</li>
        <li onClick={() => navigate("/employees")}>Quản Lý Nhân Viên</li>
        <li onClick={() => navigate("/inventory")}>Quản Lý Kho</li>
        <li onClick={() => navigate("/orders")}>Quản Lý Đơn Hàng</li>
        <li onClick={() => navigate("/reservations")}>Quản Lý Đặt Bàn</li>
        <li onClick={() => navigate("/promotions")}>Quản Lý Khuyến Mãi</li>
        <li onClick={() => navigate("/users")}>Quản Lý Người Dùng</li>
        <li onClick={() => navigate("/analytics")}>Phân Tích/Báo Cáo</li>
        <li onClick={() => navigate("/settings")}>Cài Đặt</li>
        <li onClick={() => navigate("/logout")}>Đăng Xuất</li>
      </ul>
    </div>
  );
};

export default Sidebar;
