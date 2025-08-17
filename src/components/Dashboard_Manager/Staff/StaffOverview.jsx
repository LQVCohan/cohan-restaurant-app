import React from "react";
import "./StaffOverview.scss";

const StaffOverview = () => {
  // Mock data
  const stats = [
    {
      title: "Tổng nhân viên",
      value: "24",
      change: "+2",
      changeType: "increase",
      icon: "fas fa-users",
      color: "blue",
    },
    {
      title: "Đang làm việc",
      value: "18",
      change: "+1",
      changeType: "increase",
      icon: "fas fa-user-check",
      color: "green",
    },
    {
      title: "Nghỉ phép",
      value: "3",
      change: "-1",
      changeType: "decrease",
      icon: "fas fa-calendar-times",
      color: "yellow",
    },
    {
      title: "Nghỉ việc",
      value: "3",
      change: "+1",
      changeType: "increase",
      icon: "fas fa-user-times",
      color: "red",
    },
  ];

  const departments = [
    { name: "Bếp", count: 8, percentage: 33 },
    { name: "Phục vụ", count: 10, percentage: 42 },
    { name: "Thu ngân", count: 3, percentage: 13 },
    { name: "Quản lý", count: 3, percentage: 12 },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "join",
      message: "Nguyễn Văn A đã gia nhập công ty",
      time: "2 giờ trước",
      icon: "fas fa-user-plus",
      color: "green",
    },
    {
      id: 2,
      type: "leave",
      message: "Trần Thị B đã xin nghỉ phép",
      time: "4 giờ trước",
      icon: "fas fa-calendar-alt",
      color: "yellow",
    },
    {
      id: 3,
      type: "promotion",
      message: "Lê Văn C được thăng chức Bếp trưởng",
      time: "1 ngày trước",
      icon: "fas fa-arrow-up",
      color: "blue",
    },
    {
      id: 4,
      type: "attendance",
      message: "Phạm Thị D đã check-in muộn",
      time: "2 ngày trước",
      icon: "fas fa-clock",
      color: "red",
    },
  ];

  const topPerformers = [
    {
      id: 1,
      name: "Nguyễn Văn A",
      position: "Bếp trưởng",
      score: 98,
      avatar: "👨‍🍳",
    },
    {
      id: 2,
      name: "Trần Thị B",
      position: "Phục vụ trưởng",
      score: 95,
      avatar: "👩‍💼",
    },
    {
      id: 3,
      name: "Lê Văn C",
      position: "Thu ngân",
      score: 92,
      avatar: "👨‍💼",
    },
  ];

  return (
    <div className="staff-overview">
      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card stat-card--${stat.color}`}>
            <div className="stat-card__icon">
              <i className={stat.icon} />
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{stat.value}</h3>
              <p className="stat-card__title">{stat.title}</p>
              <div
                className={`stat-card__change stat-card__change--${stat.changeType}`}
              >
                <i
                  className={`fas fa-arrow-${
                    stat.changeType === "increase" ? "up" : "down"
                  }`}
                />
                <span>{stat.change} so với tháng trước</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overview-grid">
        {/* Department Distribution */}
        <div className="overview-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-chart-pie" />
              Phân bổ theo bộ phận
            </h3>
          </div>
          <div className="card-content">
            <div className="department-list">
              {departments.map((dept, index) => (
                <div key={index} className="department-item">
                  <div className="department-info">
                    <span className="department-name">{dept.name}</span>
                    <span className="department-count">{dept.count} người</span>
                  </div>
                  <div className="department-progress">
                    <div
                      className="progress-bar"
                      style={{ width: `${dept.percentage}%` }}
                    />
                  </div>
                  <span className="department-percentage">
                    {dept.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="overview-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-history" />
              Hoạt động gần đây
            </h3>
          </div>
          <div className="card-content">
            <div className="activity-list">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div
                    className={`activity-icon activity-icon--${activity.color}`}
                  >
                    <i className={activity.icon} />
                  </div>
                  <div className="activity-content">
                    <p className="activity-message">{activity.message}</p>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="overview-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-trophy" />
              Nhân viên xuất sắc
            </h3>
          </div>
          <div className="card-content">
            <div className="performer-list">
              {topPerformers.map((performer, index) => (
                <div key={performer.id} className="performer-item">
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-avatar">{performer.avatar}</div>
                  <div className="performer-info">
                    <h4 className="performer-name">{performer.name}</h4>
                    <p className="performer-position">{performer.position}</p>
                  </div>
                  <div className="performer-score">
                    <span className="score-value">{performer.score}</span>
                    <span className="score-label">điểm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="overview-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-bolt" />
              Thao tác nhanh
            </h3>
          </div>
          <div className="card-content">
            <div className="quick-actions">
              <button className="quick-action-btn quick-action-btn--primary">
                <i className="fas fa-user-plus" />
                <span>Thêm nhân viên</span>
              </button>
              <button className="quick-action-btn quick-action-btn--secondary">
                <i className="fas fa-calendar-check" />
                <span>Chấm công</span>
              </button>
              <button className="quick-action-btn quick-action-btn--success">
                <i className="fas fa-file-export" />
                <span>Xuất báo cáo</span>
              </button>
              <button className="quick-action-btn quick-action-btn--warning">
                <i className="fas fa-cog" />
                <span>Cài đặt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default StaffOverview;
