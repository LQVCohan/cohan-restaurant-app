import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Bell, CheckCheck } from "lucide-react";
import "./NotificationsPage.scss";
import { useCustomerNotifications } from "@/context/CustomerNotificationContext";

const NotificationsPage = () => {
  const [filter, setFilter] = useState("all"); // 'all' hoặc 'unread'
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useCustomerNotifications();

  // Lọc thông báo dựa trên tab đang chọn
  const displayedNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notif) => !notif.isRead);
    }
    return notifications;
  }, [notifications, filter]);


  return (
    <div className="notifications-page">
      <div className="notif-container">
        {/* HEADER GIAO DIỆN */}
        <div className="notif-header">
          <div className="title-wrapper">
            <h1>Thông báo của bạn</h1>
            {unreadCount > 0 && (
              <span className="badge">{unreadCount} mới</span>
            )}
          </div>

          <button
            className="btn-mark-all"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} />
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        {/* TABS LỌC THÔNG BÁO */}
        <div className="notif-tabs">
          <button
            className={`tab-item ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`tab-item ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Chưa đọc
          </button>
        </div>

        {/* DANH SÁCH THÔNG BÁO */}
        <div className="notif-list">
          {displayedNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Bell size={48} />
              </div>
              <h3>Không có thông báo nào</h3>
              <p>Bạn đã xem hết tất cả các thông báo.</p>
            </div>
          ) : (
            displayedNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`notif-card ${!notif.isRead ? "unread" : ""}`}
                onClick={() => {
                  markAsRead(notif.id);
                  if (notif.threadId) navigate(`/help?threadId=${notif.threadId}`);
                }}
              >
                <div className="notif-icon">
                  <img src={notif.image} alt="icon" />
                </div>

                <div className="notif-content">
                  <p className="notif-text">{notif.text}</p>
                  <span className="notif-time">{notif.time}</span>
                </div>

                <div className="notif-actions">
                  {!notif.isRead && <div className="dot-unread"></div>}

                  <button
                    className="btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif.id);
                    }}
                    title="Xóa thông báo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
