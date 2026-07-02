import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import { AlertCircle, Bell, CheckCheck, Clock, MessageCircle, Star } from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import loadGsapRuntime from "@/utils/gsapRuntime";
import { NOTIFICATION_TYPES, notificationTitleByType } from "@/constants/notificationTypes";
import "./NotificationBell.scss";

const iconByType = {
  [NOTIFICATION_TYPES.REVIEW_NEGATIVE_CREATED]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.REVIEW_PUBLISHED]: <Star size={16} />,
  [NOTIFICATION_TYPES.REVIEW_REJECTED]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.REVIEW_REPORTED]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.REVIEW_OFFICIAL_REPLY_CREATED]: <MessageCircle size={16} />,
  [NOTIFICATION_TYPES.CHAT_MESSAGE]: <MessageCircle size={16} />,
  [NOTIFICATION_TYPES.PERFORMANCE_APPEAL_SUBMITTED]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.PERFORMANCE_APPEAL_NEEDS_MORE_INFO]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.PERFORMANCE_APPEAL_ACCEPTED]: <Star size={16} />,
  [NOTIFICATION_TYPES.PERFORMANCE_APPEAL_REJECTED]: <AlertCircle size={16} />,
  [NOTIFICATION_TYPES.PERFORMANCE_APPEAL_SCORE_REVERSED]: <Star size={16} />,
  [NOTIFICATION_TYPES.ATTENDANCE_CORRECTION_REQUESTED]: <Clock size={16} />,
  [NOTIFICATION_TYPES.OVERTIME_REQUEST_SUBMITTED]: <Clock size={16} />,
};

const toTime = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

export default function NotificationBell({
  restaurantId = null,
  title = "Thông báo",
  onOpenNotification,
  enabled = true,
  notificationState = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);
  const panelRef = useRef(null);
  const gsapRef = useRef(null);
  const communicationState = useCommunication({
    restaurantId,
    notificationsEnabled: enabled && !notificationState,
  });
  const notifications = notificationState?.notifications ?? communicationState.notifications;
  const unreadCount = notificationState?.unreadCount ?? communicationState.unreadCount;

  useEffect(() => {
    let isMounted = true;
    loadGsapRuntime()
      .then((gsap) => {
        if (isMounted) gsapRef.current = gsap;
      })
      .catch(() => {
        // Progressive enhancement: the dropdown remains fully usable without GSAP.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rows = useMemo(() => {
    const mapped = (notifications || []).map((notification) => {
      const source = notification.raw || notification;
      const payload = source.payload || {};
      const type = notification.type || source.type;
      const detailParts = [
        payload.restaurantName,
        payload.reviewTitle ? `Review: ${payload.reviewTitle}` : "",
        payload.rating ? `${payload.rating} sao` : "",
        payload.reason || payload.moderationReason ? `Lý do: ${payload.reason || payload.moderationReason}` : "",
      ].filter(Boolean);
      return {
        id: notification.id || source.id,
        type,
        title: notification.text || payload.title || payload.message || payload.messagePreview || notificationTitleByType[type] || type,
        detail: detailParts.join(" • "),
        time: notification.time || toTime(source.createdAt),
        isRead: typeof notification.isRead === "boolean" ? notification.isRead : Boolean(source.readAt),
        icon: iconByType[type] || <Bell size={16} />,
        raw: notification,
      };
    });
    return (activeTab === "unread" ? mapped.filter((notification) => !notification.isRead) : mapped).slice(0, 6);
  }, [activeTab, notifications]);

  useLayoutEffect(() => {
    const gsap = gsapRef.current;
    const panel = panelRef.current;
    if (!isOpen || !gsap || !panel) return undefined;

    const mediaContext = gsap.matchMedia();
    mediaContext.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const items = Array.from(panel.querySelectorAll(".app-notification-bell__item"));
        const animatedTargets = [panel, ...items];

        gsap.set(panel, {
          transformOrigin: "top right",
          willChange: "transform, opacity",
        });
        if (items.length) gsap.set(items, { willChange: "transform, opacity" });

        const timeline = gsap.timeline({
          defaults: { overwrite: "auto" },
          onComplete: () => {
            gsap.set(animatedTargets, {
              clearProps: "transform,opacity,visibility,willChange",
            });
          },
        });

        timeline.fromTo(
          panel,
          { autoAlpha: 0, y: -8, scale: 0.965 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.26, ease: "power3.out" },
        );

        if (items.length) {
          timeline.fromTo(
            items,
            { autoAlpha: 0, y: -4 },
            { autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.025, ease: "power2.out" },
            "<0.08",
          );
        }
      }, panel);

      return () => ctx.revert();
    });

    return () => mediaContext.revert();
  }, [isOpen]);

  const markAllAsRead = async () => {
    if (!enabled) return;
    if (notificationState?.markAllAsRead) {
      await notificationState.markAllAsRead();
      return;
    }
    await communicationState.markAllNotificationsRead({ variables: { restaurantId } });
    await communicationState.refetchNotifications?.();
  };

  const handleClick = async (notification) => {
    if (!enabled) return;
    if (notificationState?.markAsRead) {
      await notificationState.markAsRead(notification.id);
    } else {
      await communicationState.markNotificationRead({ variables: { id: notification.id } });
      await communicationState.refetchNotifications?.();
    }
    setIsOpen(false);
    onOpenNotification?.(notification.raw);
  };

  return (
    <div className="app-notification-bell" ref={dropdownRef}>
      <button
        type="button"
        className="app-notification-bell__trigger"
        aria-label="Mở thông báo"
        aria-expanded={isOpen}
        disabled={!enabled}
        onClick={() => enabled && setIsOpen((value) => !value)}
      >
        <Bell size={21} />
        {unreadCount > 0 && <span className="app-notification-bell__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {isOpen && (
        <div ref={panelRef} className="app-notification-bell__dropdown" role="dialog" aria-label="Danh sách thông báo">
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
            ) : rows.map((notification) => (
              <button type="button" key={notification.id} className={`app-notification-bell__item ${notification.isRead ? "" : "unread"}`} onClick={() => handleClick(notification)}>
                <span className={`app-notification-bell__icon app-notification-bell__icon--${String(notification.type).replaceAll(".", "-")}`}>{notification.icon}</span>
                <span className="app-notification-bell__content"><strong>{notification.title}</strong>{notification.detail && <small>{notification.detail}</small>}<em><Clock size={12} /> {notification.time}</em></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
