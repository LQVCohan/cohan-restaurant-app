import React, { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  ShieldAlert,
  Settings,
  Clock,
  CheckCheck,
} from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import "./NotificationsView.scss";

const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

export default function NotificationsView({ restaurantId, onOpenThread }) {
  const [filter, setFilter] = useState("all");
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadCount,
    refetchNotifications,
  } = useCommunication({ restaurantId });

  const displayedMessages = useMemo(() => {
    const mapped = (notifications || []).map((n) => ({
      id: n.id,
      isRead: !!n.readAt,
      from: n.payload?.senderName || n.toRole || "Hệ thống",
      text: n.payload?.messagePreview || n.type,
      time: formatTime(n.createdAt),
      type: n.payload?.channel || n.type || "system",
      threadId: n.payload?.threadId || null,
    }));
    return filter === "unread" ? mapped.filter((m) => !m.isRead) : mapped;
  }, [notifications, filter]);

  const markAsRead = async (id, threadId) => {
    await markNotificationRead({ variables: { id } });
    refetchNotifications?.();
    if (threadId && onOpenThread) onOpenThread(threadId);
  };

  const markAllAsRead = async () => {
    await markAllNotificationsRead({ variables: { restaurantId } });
    refetchNotifications?.();
  };

  const renderIcon = (type) => {
    switch (String(type || "").toLowerCase()) {
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

      <div className="noti-list">
        {displayedMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <CheckCircle2 size={40} />
            </div>
            <h4>Bạn đã xem hết thông báo!</h4>
            <p>Không có thông báo {filter === "unread" ? "mới" : ""} nào lúc này.</p>
          </div>
        ) : (
          displayedMessages.map((m) => (
            <div
              key={m.id}
              className={`noti-card ${!m.isRead ? "is-unread" : ""}`}
              onClick={() => markAsRead(m.id, m.threadId)}
            >
              <div className={`noti-icon-wrap type-${m.type}`}>{renderIcon(m.type)}</div>

              <div className="noti-content">
                <div className="noti-meta">
                  <span className="sender">{m.from}</span>
                  <span className="time">
                    <Clock size={12} /> {m.time}
                  </span>
                </div>
                <p className="message-text">{m.text}</p>
              </div>

              {!m.isRead && <div className="unread-dot"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
