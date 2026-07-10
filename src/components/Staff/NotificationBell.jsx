import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Banknote,
  Bell,
  CheckCheck,
  ChefHat,
  Clock,
  Hand,
} from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import "./NotificationBell.scss";

const toTime = (iso) => {
  if (!iso) return "Vừa xong";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const resolveNotificationVisual = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("customer") && normalized.includes("request")) {
    return { group: "request", icon: <Hand size={16} /> };
  }
  if (normalized.includes("payment") || normalized.includes("order")) {
    return { group: "order", icon: <Banknote size={16} /> };
  }
  if (normalized.includes("kitchen")) {
    return { group: "kitchen", icon: <ChefHat size={16} /> };
  }
  return { group: "system", icon: <AlertCircle size={16} /> };
};

export default function NotificationBell({
  onViewAll,
  restaurantId,
  onOpenThread,
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refetchNotifications,
  } = useCommunication({ restaurantId, notificationsEnabled: true });

  const filteredNotifications = useMemo(() => {
    const rows = (notifications || []).map((notification) => {
      const payload =
        notification?.payload && typeof notification.payload === "object"
          ? notification.payload
          : {};
      const visual = resolveNotificationVisual(notification.type);
      return {
        id: notification.id,
        type: notification.type,
        group: visual.group,
        title:
          payload.title ||
          payload.messagePreview ||
          payload.message ||
          "Thông báo công việc",
        description:
          payload.message && payload.message !== payload.title
            ? payload.message
            : "Có cập nhật mới cần bạn kiểm tra.",
        time: toTime(notification.createdAt),
        isRead: Boolean(notification.readAt),
        icon: visual.icon,
        threadId: payload.threadId || null,
        actionUrl:
          typeof payload.actionUrl === "string" &&
          payload.actionUrl.startsWith("/")
            ? payload.actionUrl
            : null,
      };
    });
    const result =
      activeTab === "unread" ? rows.filter((item) => !item.isRead) : rows;
    return result.slice(0, 5);
  }, [notifications, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const markAllAsRead = async () => {
    if (!unreadCount) return;
    await markAllNotificationsRead({ variables: { restaurantId } });
    await refetchNotifications?.();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markNotificationRead({ variables: { id: notification.id } });
      await refetchNotifications?.();
    }

    setIsOpen(false);
    if (notification.threadId && onOpenThread) {
      onOpenThread(notification.threadId);
      return;
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (onViewAll) {
      onViewAll();
      return;
    }
    navigate("/staff/notifications");
  };

  return (
    <div className="staff-notification-container" ref={dropdownRef}>
      <button
        type="button"
        className="bell-trigger-btn"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={
          unreadCount > 0
            ? `Thông báo nhân viên, ${unreadCount} chưa đọc`
            : "Thông báo nhân viên"
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={22} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="bell-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div
            className="notification-overlay"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="notification-dropdown"
            role="dialog"
            aria-label="Thông báo nhân viên"
          >
            <div className="noti-header">
              <div>
                <h3>Thông báo công việc</h3>
                <p>{unreadCount} thông báo chưa đọc</p>
              </div>
              <button
                type="button"
                className="btn-mark-read"
                onClick={() => void markAllAsRead()}
                disabled={!unreadCount}
              >
                <CheckCheck size={15} /> Đọc tất cả
              </button>
            </div>

            <div className="noti-tabs" role="tablist" aria-label="Lọc thông báo">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={activeTab === "all" ? "active" : ""}
                onClick={() => setActiveTab("all")}
              >
                Tất cả
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "unread"}
                className={activeTab === "unread" ? "active" : ""}
                onClick={() => setActiveTab("unread")}
              >
                Chưa đọc
              </button>
            </div>

            <div className="noti-list" aria-live="polite">
              {filteredNotifications.length === 0 ? (
                <div className="noti-empty">
                  <Bell size={30} aria-hidden="true" />
                  <strong>Không có thông báo mới</strong>
                  <p>Các yêu cầu khách và cập nhật công việc sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={`noti-item ${
                      !notification.isRead ? "unread" : ""
                    }`}
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <span
                      className={`noti-icon-wrapper ${notification.group}`}
                      aria-hidden="true"
                    >
                      {notification.icon}
                    </span>
                    <span className="noti-content">
                      <strong className="noti-title">{notification.title}</strong>
                      <span className="noti-description">
                        {notification.description}
                      </span>
                      <span className="noti-time">
                        <Clock size={12} /> {notification.time}
                      </span>
                    </span>
                    {!notification.isRead ? (
                      <span className="noti-dot" aria-label="Chưa đọc" />
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="noti-footer">
              <button type="button" onClick={handleViewAll}>
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
