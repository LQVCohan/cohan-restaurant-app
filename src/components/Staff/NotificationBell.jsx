import React, { useState, useMemo, useEffect, useRef } from "react";
import { Bell, CheckCheck, Clock, ChefHat, Banknote, AlertCircle } from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import "./NotificationBell.scss";

const iconByType = {
  order: <Banknote size={16} />,
  kitchen: <ChefHat size={16} />,
  system: <AlertCircle size={16} />,
};

const toTime = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";

export default function NotificationBell({ onViewAll, restaurantId, onOpenThread }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refetchNotifications,
  } = useCommunication({ restaurantId });

  const filteredNotifications = useMemo(() => {
    const rows = (notifications || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.payload?.title || n.payload?.message || n.payload?.messagePreview || n.type,
      time: toTime(n.createdAt),
      isRead: !!n.readAt,
      icon: iconByType[n.type] || <Bell size={16} />,
      threadId: n.payload?.threadId || null,
    }));
    const result = activeTab === "unread" ? rows.filter((n) => !n.isRead) : rows;
    return result.slice(0, 3);
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

  const markAllAsRead = async () => {
    await markAllNotificationsRead({ variables: { restaurantId } });
    refetchNotifications?.();
  };

  const handleNotificationClick = async (noti) => {
    await markNotificationRead({ variables: { id: noti.id } });
    refetchNotifications?.();
    if (noti.threadId && onOpenThread) {
      onOpenThread(noti.threadId);
      setIsOpen(false);
    }
  };

  return (
    <div className="staff-notification-container" ref={dropdownRef}>
      <button className="bell-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={24} color="#f9fafb" />
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-overlay" onClick={() => setIsOpen(false)}></div>
          <div className="notification-dropdown">
            <div className="noti-header">
              <h3>Thông báo mới</h3>
              <button className="btn-mark-read" onClick={markAllAsRead}>
                <CheckCheck size={16} /> Đánh dấu đã đọc
              </button>
            </div>

            <div className="noti-tabs">
              <button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>Tất cả</button>
              <button className={activeTab === "unread" ? "active" : ""} onClick={() => setActiveTab("unread")}>Chưa đọc</button>
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
                    onClick={() => handleNotificationClick(noti)}
                  >
                    <div className={`noti-icon-wrapper ${noti.type}`}>{noti.icon}</div>
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
