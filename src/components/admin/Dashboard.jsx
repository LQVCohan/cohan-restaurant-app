import React from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../../styles/Dashboard.scss";

const Dashboard = () => {
  const navigate = useNavigate();
  console.log("ok");
  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-content">
        <h1>Admin Dashboard</h1>
        <p>Overview of revenue, orders, and analytics.</p>
        {/* Add full features: charts, metrics, etc. */}
        <div className="metrics">
          <div className="metric-card">
            <h3>Doanh Thu</h3>
            <p>100,000,000 VND</p>
          </div>
          <div className="metric-card">
            <h3>Đơn Hàng</h3>
            <p>150</p>
          </div>
          <div className="metric-card">
            <h3>Bàn Trống</h3>
            <p>20/50</p>
          </div>
        </div>
        {/* Additional sections: reports, quick links */}
        <button onClick={() => navigate("/restaurants")}>
          Quản Lý Nhà Hàng
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
