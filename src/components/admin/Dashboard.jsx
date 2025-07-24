import React, { useState, useEffect } from "react";
import "../../styles/Dashboard.scss";
import MenuManagement from "./MenuManagement";
const Dashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString("vi-VN"));
  }, []);

  const switchSection = (sectionId) => {
    setActiveSection(sectionId);
  };

  const logout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      alert("Đăng xuất thành công!");
      window.location.href = "/login";
    }
  };

  const getPageTitle = (section) => {
    const titles = {
      dashboard: "Dashboard",
      orders: "Quản lý Đơn hàng",
      menu: "Quản lý Thực đơn",
      tables: "Quản lý Bàn ăn",
      staff: "Quản lý Nhân viên",
      inventory: "Quản lý Kho hàng",
      reports: "Báo cáo",
      restaurants: "Quản Lý Nhà Hàng",
      promotions: "Quản Lý Khuyến Mãi",
      users: "Quản Lý Người Dùng",
      settings: "Cài Đặt",
    };
    return titles[section] || "Dashboard";
  };

  const StatCard = ({ icon, trend, value, title, color }) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        <div className="stat-trend">{trend}</div>
      </div>
      <div className="stat-content">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );

  const ChartBar = ({ height, value, label }) => (
    <div className="chart-bar-container">
      <div className="chart-bar" style={{ height: `${height}%` }}>
        <div className="bar-value">{value}</div>
      </div>
      <div className="bar-label">{label}</div>
    </div>
  );

  const ActivityItem = ({ icon, iconClass, title, desc, time }) => (
    <div className="activity-item">
      <div className={`activity-icon ${iconClass}`}>{icon}</div>
      <div className="activity-content">
        <div className="activity-title">{title}</div>
        <div className="activity-desc">{desc}</div>
      </div>
      <div className="activity-time">{time}</div>
    </div>
  );

  const ActionCard = ({ icon, title, desc, onClick }) => (
    <div className="action-card" onClick={onClick}>
      <div className="action-icon">{icon}</div>
      <div className="action-title">{title}</div>
      <div className="action-desc">{desc}</div>
    </div>
  );

  const ComingSoon = ({ icon, title }) => (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <h2>{title}</h2>
      <p>Tính năng đang được phát triển. Sẽ sớm ra mắt!</p>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-content">
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard
          icon="💰"
          trend="+12.5%"
          value="15.750.000₫"
          title="Doanh thu hôm nay"
          color="success"
        />
        <StatCard
          icon="📋"
          trend="+8.2%"
          value="89"
          title="Đơn hàng"
          color="primary"
        />
        <StatCard
          icon="👥"
          trend="+15.3%"
          value="156"
          title="Khách hàng"
          color="info"
        />
        <StatCard
          icon="📊"
          trend="+5.7%"
          value="176.966₫"
          title="Giá trị TB/đơn"
          color="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="dashboard-row">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Doanh thu 8 tháng gần đây</h3>
            <select className="btn btn-outline">
              <option>8 tháng</option>
              <option>6 tháng</option>
              <option>3 tháng</option>
            </select>
          </div>
          <div className="card-content">
            <div className="revenue-chart">
              <div className="chart-bars">
                <ChartBar height={60} value="450M" label="T1" />
                <ChartBar height={70} value="520M" label="T2" />
                <ChartBar height={65} value="480M" label="T3" />
                <ChartBar height={85} value="610M" label="T4" />
                <ChartBar height={80} value="580M" label="T5" />
                <ChartBar height={90} value="650M" label="T6" />
                <ChartBar height={100} value="720M" label="T7" />
                <ChartBar height={95} value="680M" label="T8" />
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>Hoạt động gần đây</h3>
            <button className="btn btn-outline">Xem tất cả</button>
          </div>
          <div className="card-content">
            <div className="activity-list">
              <ActivityItem
                icon="🛒"
                iconClass="order"
                title="Đơn hàng mới #1234"
                desc="Bàn 5 - 4 món"
                time="2 phút trước"
              />
              <ActivityItem
                icon="🪑"
                iconClass="table"
                title="Đặt bàn mới"
                desc="Nguyễn Văn A - Bàn VIP1"
                time="5 phút trước"
              />
              <ActivityItem
                icon="💳"
                iconClass="payment"
                title="Thanh toán hoàn thành"
                desc="Bàn 3 - 850.000₫"
                time="8 phút trước"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <ActionCard
          icon="🛒"
          title="Đơn hàng mới"
          desc="Tạo đơn hàng cho khách"
          onClick={() => switchSection("orders")}
        />
        <ActionCard
          icon="🪑"
          title="Quản lý bàn"
          desc="Xem trạng thái bàn ăn"
          onClick={() => switchSection("tables")}
        />
        <ActionCard
          icon="📋"
          title="Cập nhật menu"
          desc="Chỉnh sửa thực đơn"
          onClick={() => switchSection("menu")}
        />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return renderDashboard();
      case "orders":
        return <ComingSoon icon="🛒" title="Quản lý Đơn hàng" />;
      case "menu":
        return <MenuManagement />;
      case "tables":
        return <ComingSoon icon="🪑" title="Quản lý Bàn ăn" />;
      case "staff":
        return <ComingSoon icon="👥" title="Quản lý Nhân viên" />;
      case "inventory":
        return <ComingSoon icon="📦" title="Quản lý Kho hàng" />;
      case "reports":
        return <ComingSoon icon="📈" title="Báo cáo" />;
      case "restaurants":
        return <ComingSoon icon="🏠" title="Quản Lý Nhà Hàng" />;
      case "promotions":
        return <ComingSoon icon="🎁" title="Quản Lý Khuyến Mãi" />;
      case "users":
        return <ComingSoon icon="👤" title="Quản Lý Người Dùng" />;
      case "settings":
        return <ComingSoon icon="⚙️" title="Cài Đặt" />;
      default:
        return renderDashboard();
    }
  };

  const sidebarItems = [
    { id: "dashboard", icon: "📊", text: "Dashboard" },
    { id: "orders", icon: "🛒", text: "Đơn hàng" },
    { id: "menu", icon: "📋", text: "Thực đơn" },
    { id: "tables", icon: "🪑", text: "Bàn ăn" },
    { id: "staff", icon: "👥", text: "Nhân viên" },
    { id: "inventory", icon: "📦", text: "Kho hàng" },
    { id: "reports", icon: "📈", text: "Báo cáo" },
    { id: "restaurants", icon: "🏠", text: "Quản Lý Nhà Hàng" },
    { id: "promotions", icon: "🎁", text: "Quản Lý Khuyến Mãi" },
    { id: "users", icon: "👤", text: "Quản Lý Người Dùng" },
    { id: "settings", icon: "⚙️", text: "Cài Đặt" },
  ];

  return (
    <div className="restaurant-dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🍽️</span>
            <span className="logo-text">Cohan Restaurant</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${
                activeSection === item.id ? "active" : ""
              }`}
              onClick={() => switchSection(item.id)}
            >
              <span className="sidebar-text">
                {item.icon} {item.text}
              </span>
            </div>
          ))}
          <div className="sidebar-item" onClick={logout}>
            <span className="sidebar-text">🚪 Đăng Xuất</span>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div className="main-header">
          <div className="header-left">
            <h1>{getPageTitle(activeSection)}</h1>
            <p>Chào mừng trở lại! Hôm nay là {currentDate}</p>
          </div>

          <div className="header-right">
            <div className="user-menu">
              <div className="user-avatar">👤</div>
              <div className="user-info">
                <div className="user-name">Admin</div>
                <div className="user-role">Quản lý</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="content">{renderContent()}</div>
      </div>
    </div>
  );
};

export default Dashboard;
