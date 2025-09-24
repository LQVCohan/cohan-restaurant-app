import React from "react";
import "./ActivityFeed.scss";

const ActivityItem = ({ icon, iconType, text, time }) => (
  <li className="activity-item">
    <div className={`activity-icon ${iconType}`}>{icon}</div>
    <div className="activity-content">
      <div className="activity-text">{text}</div>
      <div className="activity-time">{time}</div>
    </div>
  </li>
);

const ActivityFeed = () => {
  const activities = [
    {
      icon: "🛍️",
      iconType: "order",
      text: "Đơn hàng #1234 đã được xác nhận",
      time: "2 phút trước",
    },
    {
      icon: "💳",
      iconType: "payment",
      text: "Thanh toán ₫450.000 đã hoàn tất",
      time: "5 phút trước",
    },
    {
      icon: "⭐",
      iconType: "review",
      text: "Nhận đánh giá 5 sao từ khách hàng",
      time: "10 phút trước",
    },
    {
      icon: "⚠️",
      iconType: "alert",
      text: 'Nguyên liệu "Tôm tươi" sắp hết',
      time: "15 phút trước",
    },
    {
      icon: "🛍️",
      iconType: "order",
      text: "3 đơn hàng mới cần xử lý",
      time: "20 phút trước",
    },
  ];

  return (
    <div className="activity-card fade-in">
      <div className="activity-header">
        <h3 className="activity-title">🔔 Hoạt Động Gần Đây</h3>
        <a href="#" className="view-all-btn">
          Xem tất cả
        </a>
      </div>
      <ul className="activity-list">
        {activities.map((activity, index) => (
          <ActivityItem
            key={index}
            icon={activity.icon}
            iconType={activity.iconType}
            text={activity.text}
            time={activity.time}
          />
        ))}
      </ul>
    </div>
  );
};

export default ActivityFeed;
