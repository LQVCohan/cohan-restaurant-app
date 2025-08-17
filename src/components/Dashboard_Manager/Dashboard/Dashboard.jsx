import React, { useState, useEffect } from "react";
import Card from "../Common/Card/Card";
import Button from "../Common/Button/Button";
import { useRouter } from "../../hooks/useRouter";
import "./Dashboard.scss";

const Dashboard = () => {
  const { navigate } = useRouter();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalStaff: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setStats({
        totalRevenue: 125000000,
        totalOrders: 1234,
        totalCustomers: 567,
        totalStaff: 25,
      });
      setLoading(false);
    }, 1000);
  }, []);

  const statsCards = [
    {
      title: "Doanh thu hôm nay",
      value: stats.totalRevenue.toLocaleString("vi-VN"),
      unit: "VNĐ",
      icon: "💰",
      color: "success",
      change: "+12.5%",
      changeType: "increase",
    },
    {
      title: "Đơn hàng",
      value: stats.totalOrders.toLocaleString("vi-VN"),
      unit: "đơn",
      icon: "📋",
      color: "primary",
      change: "+8.2%",
      changeType: "increase",
    },
    {
      title: "Khách hàng",
      value: stats.totalCustomers.toLocaleString("vi-VN"),
      unit: "người",
      icon: "👥",
      color: "warning",
      change: "+15.3%",
      changeType: "increase",
    },
    {
      title: "Nhân viên",
      value: stats.totalStaff.toLocaleString("vi-VN"),
      unit: "người",
      icon: "👨‍💼",
      color: "info",
      change: "0%",
      changeType: "stable",
    },
  ];

  const quickActions = [
    {
      title: "Quản lý Nhân viên",
      description: "Xem danh sách, chấm công và quản lý lương thưởng",
      icon: "👥",
      color: "primary",
      action: () => navigate("/manager/staff/overview"),
    },
    {
      title: "Quản lý Thực đơn",
      description: "Thêm, sửa, xóa món ăn và cập nhật giá cả",
      icon: "🍽️",
      color: "success",
      action: () => navigate("/manager/menu"),
    },
    {
      title: "Xem Đơn hàng",
      description: "Theo dõi và xử lý các đơn hàng mới",
      icon: "📋",
      color: "warning",
      action: () => navigate("/manager/orders"),
    },
    {
      title: "Báo cáo Doanh thu",
      description: "Xem thống kê và phân tích doanh thu",
      icon: "📈",
      color: "info",
      action: () => navigate("/manager/reports"),
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "order",
      title: "Đơn hàng mới #1234",
      description: "Khách hàng Nguyễn Văn A đã đặt 3 món",
      time: "5 phút trước",
      icon: "🛒",
    },
    {
      id: 2,
      type: "staff",
      title: "Nhân viên check-in",
      description: "Trần Thị B đã check-in ca sáng",
      time: "10 phút trước",
      icon: "👤",
    },
    {
      id: 3,
      type: "inventory",
      title: "Cảnh báo tồn kho",
      description: 'Nguyên liệu "Thịt bò" sắp hết',
      time: "15 phút trước",
      icon: "⚠️",
    },
    {
      id: 4,
      type: "payment",
      title: "Thanh toán thành công",
      description: "Đơn hàng #1230 đã được thanh toán",
      time: "20 phút trước",
      icon: "💳",
    },
  ];

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">
          <div className="loading-spinner" />
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__title">
          <h1>Tổng quan hệ thống</h1>
          <p>Chào mừng bạn quay trở lại! Đây là tình hình hoạt động hôm nay.</p>
        </div>
        <div className="dashboard__actions">
          <Button variant="secondary">
            <i className="fas fa-download" />
            Xuất báo cáo
          </Button>
          <Button variant="primary">
            <i className="fas fa-plus" />
            Thêm mới
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dashboard__stats">
        {statsCards.map((stat, index) => (
          <Card key={index} className="stat-card" hover>
            <div className="stat-card__content">
              <div className="stat-card__header">
                <div className="stat-card__icon">
                  <span>{stat.icon}</span>
                </div>
                <div
                  className={`stat-card__change stat-card__change--${stat.changeType}`}
                >
                  <i
                    className={`fas fa-arrow-${
                      stat.changeType === "increase"
                        ? "up"
                        : stat.changeType === "decrease"
                        ? "down"
                        : "right"
                    }`}
                  />
                  {stat.change}
                </div>
              </div>
              <div className="stat-card__body">
                <h3 className="stat-card__title">{stat.title}</h3>
                <div className="stat-card__value">
                  <span className="value">{stat.value}</span>
                  <span className="unit">{stat.unit}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="dashboard__content">
        {/* Quick Actions */}
        <div className="dashboard__section">
          <Card>
            <div className="section-header">
              <h2>Thao tác nhanh</h2>
              <p>Các tính năng thường sử dụng</p>
            </div>
            <div className="quick-actions">
              {quickActions.map((action, index) => (
                <div
                  key={index}
                  className="quick-action"
                  onClick={action.action}
                >
                  <div className="quick-action__icon">
                    <span>{action.icon}</span>
                  </div>
                  <div className="quick-action__content">
                    <h3>{action.title}</h3>
                    <p>{action.description}</p>
                  </div>
                  <div className="quick-action__arrow">
                    <i className="fas fa-chevron-right" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Activities */}
        <div className="dashboard__section">
          <Card>
            <div className="section-header">
              <h2>Hoạt động gần đây</h2>
              <Button variant="secondary" size="sm">
                Xem tất cả
              </Button>
            </div>
            <div className="recent-activities">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-item__icon">
                    <span>{activity.icon}</span>
                  </div>
                  <div className="activity-item__content">
                    <h4>{activity.title}</h4>
                    <p>{activity.description}</p>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
