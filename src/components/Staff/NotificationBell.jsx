import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  ChefHat,
  Banknote,
  AlertCircle,
} from "lucide-react";
import "./NotificationBell.scss";

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: "order",
    title: "Bàn 01 gọi thanh toán",
    time: "Vừa xong",
    isRead: false,
    icon: <Banknote size={16} />,
  },
  {
    id: 2,
    type: "kitchen",
    title: "Bếp đã làm xong món: Lẩu Thái Tomyum (Bàn 03)",
    time: "2 phút trước",
    isRead: false,
    icon: <ChefHat size={16} />,
  },
  {
    id: 3,
    type: "system",
    title: "Hết món: Nước Ép Dưa Hấu",
    time: "15 phút trước",
    isRead: true,
    icon: <AlertCircle size={16} />,
  },
  {
    id: 4,
    type: "order",
    title: "Bàn VIP 01 yêu cầu phục vụ thêm nước đá",
    time: "1 giờ trước",
    isRead: true,
    icon: <Bell size={16} />,
  },
];

export default function NotificationBell({ onViewAll }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    let result = notifications;
    if (activeTab === "unread") {
      result = notifications.filter((n) => !n.isRead);
    }
    return result.slice(0, 3); // Chỉ lấy 3 thông báo mới nhất
  }, [notifications, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (id) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  return (
    <div className="staff-notification-container" ref={dropdownRef}>
      <button className="bell-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={24} color="#f9fafb" />
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="notification-overlay"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="notification-dropdown">
            <div className="noti-header">
              <h3>Thông báo mới</h3>
              <button className="btn-mark-read" onClick={markAllAsRead}>
                <CheckCheck size={16} /> Đánh dấu đã đọc
              </button>
            </div>

            <div className="noti-tabs">
              <button
                className={activeTab === "all" ? "active" : ""}
                onClick={() => setActiveTab("all")}
              >
                Tất cả
              </button>
              <button
                className={activeTab === "unread" ? "active" : ""}
                onClick={() => setActiveTab("unread")}
              >
                Chưa đọc
              </button>
            </div>

            <div className="noti-list">
              {filteredNotifications.length === 0 ? (
                <div className="noti-empty">
                  <Bell size={32} color="#4b5563" />
                  <p>Không có thông báo nào</p>
                </div>
              ) : (
                filteredNotifications.map((noti) => (
                  <div
                    key={noti.id}
                    className={`noti-item ${!noti.isRead ? "unread" : ""}`}
                    onClick={() => handleNotificationClick(noti.id)}
                  >
                    <div className={`noti-icon-wrapper ${noti.type}`}>
                      {noti.icon}
                    </div>
                    <div className="noti-content">
                      <p className="noti-title">{noti.title}</p>
                      <p className="noti-time">
                        <Clock size={12} /> {noti.time}
                      </p>
                    </div>
                    {!noti.isRead && <div className="noti-dot"></div>}
                  </div>
                ))
              )}
            </div>

            <div className="noti-footer">
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onViewAll) onViewAll();
                }}
              >
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
