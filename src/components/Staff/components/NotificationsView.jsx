import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  ShieldAlert,
  Settings,
  Clock,
  CheckCheck,
} from "lucide-react";
import "./NotificationsView.scss";

export default function NotificationsView() {
  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "Quản lý",
      type: "management",
      text: "Bàn VIP 1 khách sắp tới, set up kỹ nhé.",
      time: "10:30",
      isRead: false,
    },
    {
      id: 2,
      from: "Bếp",
      type: "kitchen",
      text: "Bò Wagyu hiện tại hết size lớn, báo khách giúp bếp.",
      time: "11:15",
      isRead: false,
    },
    {
      id: 3,
      from: "Hệ thống",
      type: "system",
      text: "Cập nhật menu thành công. Đã thêm 2 món mới.",
      time: "09:00",
      isRead: true,
    },
  ]);

  const unreadCount = messages.filter((m) => !m.isRead).length;
  const displayedMessages =
    filter === "unread" ? messages.filter((m) => !m.isRead) : messages;

  const markAllAsRead = () => {
    setMessages(messages.map((m) => ({ ...m, isRead: true })));
  };

  const markAsRead = (id) => {
    setMessages(
      messages.map((msg) => (msg.id === id ? { ...msg, isRead: true } : msg)),
    );
  };

  // Hàm render Icon theo loại thông báo
  const renderIcon = (type) => {
    switch (type) {
      case "management":
        return <ShieldAlert size={20} />;
      case "kitchen":
        return <ChefHat size={20} />;
      case "system":
        return <Settings size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  return (
    <div className="staff-pos-notifications">
      {/* Header & Tools */}
      <div className="noti-header">
        <div className="header-title">
          <h3>Thông báo</h3>
          {unreadCount > 0 && <span className="badge">{unreadCount} mới</span>}
        </div>

        {unreadCount > 0 && (
          <button className="btn-mark-all" onClick={markAllAsRead}>
            <CheckCheck size={16} />
            Đã đọc hết
          </button>
        )}
      </div>

      {/* Segmented Control Tabs */}
      <div className="noti-tabs-container">
        <div className="segmented-control">
          <button
            className={`segment-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`segment-btn ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Chưa đọc
          </button>
        </div>
      </div>

      {/* Danh sách thông báo */}
      <div className="noti-list">
        {displayedMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <CheckCircle2 size={40} />
            </div>
            <h4>Bạn đã xem hết thông báo!</h4>
            <p>
              Không có thông báo {filter === "unread" ? "mới" : ""} nào lúc này.
            </p>
          </div>
        ) : (
          displayedMessages.map((m) => (
            <div
              key={m.id}
              className={`noti-card ${!m.isRead ? "is-unread" : ""}`}
              onClick={() => !m.isRead && markAsRead(m.id)}
            >
              {/* Cột Icon */}
              <div className={`noti-icon-wrap type-${m.type}`}>
                {renderIcon(m.type)}
              </div>

              {/* Nội dung */}
              <div className="noti-content">
                <div className="noti-meta">
                  <span className="sender">{m.from}</span>
                  <span className="time">
                    <Clock size={12} /> {m.time}
                  </span>
                </div>
                <p className="message-text">{m.text}</p>
              </div>

              {/* Chấm trạng thái */}
              {!m.isRead && <div className="unread-dot"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
