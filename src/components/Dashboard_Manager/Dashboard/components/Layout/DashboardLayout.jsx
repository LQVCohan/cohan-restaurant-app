import React from "react";
import Chart from "../Chart"; // Giả sử là RevenueChart đã làm
import ActivityFeed from "../ActivityFeed"; // Component activity
import RecentOrders from "../RecentOrders";
import TopDishes from "../TopDishes";
import "./DashboardLayout.scss"; // File style tổng hợp

const DashboardLayout = () => {
  return (
    <div className="dashboard-container fade-in-up">
      {/* Hàng 1: Chart & Activity (Tỉ lệ 3:1) */}
      <section className="grid-row main-stats-row">
        <div className="grid-col col-chart">
          <Chart />
        </div>
        <div className="grid-col col-feed">
          <ActivityFeed />
        </div>
      </section>

      {/* Hàng 2: Orders & Top Dishes (Tỉ lệ 2:1) */}
      <section className="grid-row bottom-data-row">
        <div className="grid-col col-orders">
          <RecentOrders />
        </div>
        <div className="grid-col col-dishes">
          <TopDishes />
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout;
