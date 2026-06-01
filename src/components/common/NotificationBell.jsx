import React, { useMemo, useRef, useState, useEffect } from "react";
import { AlertCircle, Bell, CheckCheck, Clock, MessageCircle, Star } from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import "./NotificationBell.scss";

const iconByType = {
  "review.negative.created": <AlertCircle size={16} />,
  "review.published": <Star size={16} />,
  "review.rejected": <AlertCircle size={16} />,
  "review.reported": <AlertCircle size={16} />,
  "review.official_reply.created": <MessageCircle size={16} />,
  chat_message: <MessageCircle size={16} />,
};

const titleByType = {
  "review.negative.created": "Review tiêu cực mới",
  "review.published": "Review đã được duyệt",
  "review.rejected": "Review bị từ chối",
  "review.reported": "Review bị báo cáo",
  "review.official_reply.created": "Nhà hàng đã phản hồi review",
};

const toTime = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

export default function NotificationBell({ restaurantId = null, title = "Thông báo", onOpenNotification, enabled = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, refetchNotifications } = useCommunication({ restaurantId, notificationsEnabled: enabled });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rows = useMemo(() => {
    const mapped = (notifications || []).map((n) => {
      const payload = n.payload || {};
      const detailParts = [
        payload.restaurantName,
        payload.reviewTitle ? `Review: ${payload.reviewTitle}` : "",
        payload.rating ? `${payload.rating} sao` : "",
        payload.reason || payload.moderationReason ? `Lý do: ${payload.reason || payload.moderationReason}` : "",
      ].filter(Boolean);
      return {
        id: n.id,
        type: n.type,
        title: payload.title || payload.message || payload.messagePreview || titleByType[n.type] || n.type,
        detail: detailParts.join(" • "),
        time: toTime(n.createdAt),
        isRead: Boolean(n.readAt),
        icon: iconByType[n.type] || <Bell size={16} />,
        raw: n,
      };
    });
    return (activeTab === "unread" ? mapped.filter((n) => !n.isRead) : mapped).slice(0, 6);
  }, [activeTab, notifications]);

  const markAllAsRead = async () => {
    if (!enabled) return;
    await markAllNotificationsRead({ variables: { restaurantId } });
    await refetchNotifications?.();
  };

  const handleClick = async (notification) => {
    if (!enabled) return;
    await markNotificationRead({ variables: { id: notification.id } });
    await refetchNotifications?.();
    setIsOpen(false);
    onOpenNotification?.(notification.raw);
  };

  return (
    <div className="app-notification-bell" ref={dropdownRef}>
      <button type="button" className="app-notification-bell__trigger" aria-label="Mở thông báo" disabled={!enabled} onClick={() => enabled && setIsOpen((v) => !v)}>
        <Bell size={21} />
        {unreadCount > 0 && <span className="app-notification-bell__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="app-notification-bell__dropdown" role="dialog" aria-label="Danh sách thông báo">
          <div className="app-notification-bell__header">
            <h3>{title}</h3>
            <button type="button" onClick={markAllAsRead}><CheckCheck size={15} /> Đọc hết</button>
          </div>
          <div className="app-notification-bell__tabs">
            <button type="button" className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>Tất cả</button>
            <button type="button" className={activeTab === "unread" ? "active" : ""} onClick={() => setActiveTab("unread")}>Chưa đọc</button>
          </div>
          <div className="app-notification-bell__list">
            {rows.length === 0 ? (
              <div className="app-notification-bell__empty">Không có thông báo mới.</div>
            ) : rows.map((n) => (
              <button type="button" key={n.id} className={`app-notification-bell__item ${n.isRead ? "" : "unread"}`} onClick={() => handleClick(n)}>
                <span className={`app-notification-bell__icon app-notification-bell__icon--${String(n.type).replaceAll(".", "-")}`}>{n.icon}</span>
                <span className="app-notification-bell__content"><strong>{n.title}</strong>{n.detail && <small>{n.detail}</small>}<em><Clock size={12} /> {n.time}</em></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
