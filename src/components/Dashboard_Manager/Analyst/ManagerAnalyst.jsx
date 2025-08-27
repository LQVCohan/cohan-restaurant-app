import React, { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import KPICard from "./components/KPICard";
import ProductItem from "./components/ProductItem";
import ServiceItem from "./components/ServiceItem";
import RevenueChart from "./components/RevenueChart";
import "./ManagerAnalyst.scss";

const ManagerAnalyst = () => {
  const [activeFilter, setActiveFilter] = useState("today");
  const [activeChart, setActiveChart] = useState("revenue");

  const kpiData = [
    {
      icon: "fas fa-dollar-sign",
      iconClass: "revenue",
      value: "2,450,000₫",
      label: "Doanh thu hôm nay",
      change: "+12.5%",
      changeType: "positive",
      comparison: "So với hôm qua: +305,000₫",
    },
    {
      icon: "fas fa-shopping-cart",
      iconClass: "orders",
      value: "156",
      label: "Đơn hàng hôm nay",
      change: "+8.3%",
      changeType: "positive",
      comparison: "So với hôm qua: +12 đơn",
    },
    {
      icon: "fas fa-users",
      iconClass: "customers",
      value: "89",
      label: "Khách hàng mới",
      change: "+15.2%",
      changeType: "positive",
      comparison: "So với hôm qua: +11 khách",
    },
    {
      icon: "fas fa-chart-line",
      iconClass: "average",
      value: "157,000₫",
      label: "Giá trị đơn TB",
      change: "-2.1%",
      changeType: "negative",
      comparison: "So với hôm qua: -3,500₫",
    },
  ];

  const topProducts = [
    {
      rank: "first",
      name: "Phở Bò Tái",
      quantity: "89 phần",
      revenue: "890,000₫",
      change: "+15%",
      changeType: "positive",
    },
    {
      rank: "second",
      name: "Cơm Gà Xối Mỡ",
      quantity: "67 phần",
      revenue: "670,000₫",
      change: "+8%",
      changeType: "positive",
    },
    {
      rank: "third",
      name: "Bánh Mì Thịt Nướng",
      quantity: "54 phần",
      revenue: "270,000₫",
      change: "-3%",
      changeType: "negative",
    },
    {
      rank: "fourth",
      name: "Trà Sữa Trân Châu",
      quantity: "43 ly",
      revenue: "215,000₫",
      change: "+22%",
      changeType: "positive",
    },
  ];

  const serviceData = [
    {
      type: "dine-in",
      icon: "fas fa-utensils",
      name: "Ăn tại chỗ",
      orders: "89 đơn",
      percentage: "57%",
      change: "+8%",
      changeType: "positive",
    },
    {
      type: "delivery",
      icon: "fas fa-motorcycle",
      name: "Giao hàng",
      orders: "52 đơn",
      percentage: "33%",
      change: "+15%",
      changeType: "positive",
    },
    {
      type: "reservation",
      icon: "fas fa-calendar-check",
      name: "Đặt bàn",
      orders: "15 bàn",
      percentage: "10%",
      change: "-2%",
      changeType: "negative",
    },
  ];

  const peakHours = [
    { time: "11:00 - 13:00", percentage: 80, level: "high" },
    { time: "18:00 - 20:00", percentage: 75, level: "medium-high" },
    { time: "07:00 - 09:00", percentage: 50, level: "medium" },
    { time: "14:00 - 17:00", percentage: 35, level: "low" },
  ];

  const paymentMethods = [
    {
      type: "credit",
      icon: "fas fa-credit-card",
      method: "Thẻ tín dụng",
      percentage: "45%",
      amount: "1,102,500₫",
    },
    {
      type: "cash",
      icon: "fas fa-money-bill",
      method: "Tiền mặt",
      percentage: "35%",
      amount: "857,500₫",
    },
    {
      type: "ewallet",
      icon: "fas fa-mobile-alt",
      method: "Ví điện tử",
      percentage: "20%",
      amount: "490,000₫",
    },
  ];

  const tableData = [
    {
      date: "Hôm nay",
      revenue: "2,450,000₫",
      orders: "156",
      customers: "89",
      avg: "157,000₫",
      growth: "+12.5%",
      growthType: "positive",
    },
    {
      date: "Hôm qua",
      revenue: "2,145,000₫",
      orders: "144",
      customers: "78",
      avg: "149,000₫",
      growth: "+8.2%",
      growthType: "positive",
    },
    {
      date: "2 ngày trước",
      revenue: "1,980,000₫",
      orders: "133",
      customers: "71",
      avg: "148,500₫",
      growth: "-2.1%",
      growthType: "negative",
    },
  ];

  return (
    <div className="manager-analyst">
      {/* Header */}
      <div className="header">
        <h1>📊 Phân Tích Kinh Doanh</h1>
        <p>Theo dõi hiệu suất và xu hướng kinh doanh nhà hàng</p>
      </div>

      {/* Time Filter */}
      <div className="time-filter-container">
        <div className="time-filter-content">
          <label className="filter-label">Thời gian:</label>
          <div className="filter-buttons">
            {["today", "week", "month", "quarter"].map((period) => (
              <button
                key={period}
                className={`filter-btn ${
                  activeFilter === period ? "active" : ""
                }`}
                onClick={() => setActiveFilter(period)}
              >
                {period === "today"
                  ? "Hôm nay"
                  : period === "week"
                  ? "7 ngày"
                  : period === "month"
                  ? "30 ngày"
                  : "3 tháng"}
              </button>
            ))}
          </div>
          <div className="date-filter">
            <input type="date" className="date-input" />
            <span>đến</span>
            <input type="date" className="date-input" />
            <button className="search-btn">
              <i className="fas fa-search"></i>Lọc
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiData.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Doanh Thu Theo Thời Gian</h3>
            <div className="chart-toggles">
              <button
                className={`chart-toggle ${
                  activeChart === "revenue" ? "active" : ""
                }`}
                onClick={() => setActiveChart("revenue")}
              >
                Doanh thu
              </button>
              <button
                className={`chart-toggle ${
                  activeChart === "orders" ? "active" : ""
                }`}
                onClick={() => setActiveChart("orders")}
              >
                Đơn hàng
              </button>
            </div>
          </div>
          <RevenueChart />
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Món Ăn Bán Chạy</h3>
          <div className="top-products">
            {topProducts.map((product, index) => (
              <ProductItem key={index} {...product} />
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="analytics-grid">
        {/* Service Statistics */}
        <div className="chart-card">
          <h3 className="chart-title">Thống Kê Dịch Vụ</h3>
          <div className="service-stats">
            {serviceData.map((service, index) => (
              <ServiceItem key={index} {...service} />
            ))}
            <div className="summary-box">
              <div className="summary-row">
                <span className="summary-label">Tổng món ăn đã bán:</span>
                <span className="summary-value">342 món</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Tổng đơn hàng:</span>
                <span className="summary-value">156 đơn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="chart-card">
          <h3 className="chart-title">Giờ Cao Điểm</h3>
          <div className="peak-hours">
            {peakHours.map((hour, index) => (
              <div key={index} className="hour-item">
                <span className="hour-label">{hour.time}</span>
                <div className="hour-progress">
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${hour.level}`}
                      style={{ width: `${hour.percentage}%` }}
                    ></div>
                  </div>
                  <span className="progress-percentage">
                    {hour.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="chart-card">
          <h3 className="chart-title">Phương Thức Thanh Toán</h3>
          <div className="payment-methods">
            {paymentMethods.map((payment, index) => (
              <div key={index} className={`payment-item ${payment.type}`}>
                <div className="payment-left">
                  <i
                    className={`${payment.icon} payment-icon ${payment.type}`}
                  ></i>
                  <span className="payment-method">{payment.method}</span>
                </div>
                <div className="payment-right">
                  <p className="payment-percentage">{payment.percentage}</p>
                  <p className="payment-amount">{payment.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="table-container">
        <div className="table-header">
          <h3 className="table-title">Chi Tiết Phân Tích</h3>
          <div className="table-actions">
            <button className="action-btn secondary">
              <i className="fas fa-download"></i>Xuất Excel
            </button>
            <button className="action-btn primary">
              <i className="fas fa-chart-bar"></i>Tạo báo cáo
            </button>
          </div>
        </div>

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Doanh thu</th>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Giá trị TB</th>
                <th>Tăng trưởng</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td className={row.date === "Hôm nay" ? "highlight" : ""}>
                    {row.revenue}
                  </td>
                  <td>{row.orders}</td>
                  <td>{row.customers}</td>
                  <td>{row.avg}</td>
                  <td>
                    <span className={`growth-badge ${row.growthType}`}>
                      <i
                        className={`fas ${
                          row.growthType === "positive"
                            ? "fa-arrow-up"
                            : "fa-arrow-down"
                        }`}
                      ></i>
                      {row.growth}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerAnalyst;
