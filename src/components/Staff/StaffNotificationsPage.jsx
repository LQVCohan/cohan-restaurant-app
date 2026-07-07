import React, { useContext, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarClock,
  CheckCheck,
  Clock3,
  ClipboardList,
  CookingPot,
  CreditCard,
  Inbox,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";
import "./StaffNotificationsPage.scss";

const tabs = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "schedule", label: "Lịch làm" },
  { key: "attendance", label: "Chấm công" },
  { key: "request", label: "Yêu cầu" },
  { key: "system", label: "Hệ thống" },
];

const typeMeta = {
  schedule: { label: "Lịch làm", icon: CalendarClock },
  attendance: { label: "Chấm công", icon: Clock3 },
  request: { label: "Yêu cầu", icon: ClipboardList },
  system: { label: "Hệ thống", icon: BellRing },
  order: { label: "Đơn nội bộ", icon: ShoppingBag },
  kitchen: { label: "Bếp", icon: CookingPot },
  payroll: { label: "Lương", icon: CreditCard },
  profile: { label: "Hồ sơ", icon: UserRound },
};

const statusLabels = {
  new: "Mới",
  action: "Cần xử lý",
  read: "Đã đọc",
};

const getId = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value.id || value._id || null;
  return value;
};

const resolveStaffRestaurantId = (user) =>
  getId(user?.restaurantForStaff) ||
  getId(user?.restaurantId) ||
  null;

const resolveType = (value) => {
  const type = String(value || "").toLowerCase();
  if (type.includes("schedule") || type.includes("shift")) return "schedule";
  if (type.includes("attendance") || type.includes("timesheet") || type.includes("overtime")) return "attendance";
  if (type.includes("handoff") || type.includes("leave") || type.includes("request") || type.includes("appeal") || type.includes("correction")) return "request";
  if (type.includes("payroll") || type.includes("payslip")) return "payroll";
  if (type.includes("kitchen")) return "kitchen";
  if (type.includes("order") || type.includes("payment")) return "order";
  if (type.includes("profile") || type.includes("account")) return "profile";
  return "system";
};

const fallbackRoute = (notificationType, group) => {
  const type = String(notificationType || "").toLowerCase();
  if (type === "ai_chatbot_handoff") return "/staff/ai-handoff";
  if (group === "schedule") return "/staff/schedule";
  if (group === "attendance") return "/staff/attendance";
  if (group === "payroll") return "/staff/payslips";
  if (group === "order") return "/staff/orders";
  if (group === "kitchen") return "/staff/kitchen";
  if (group === "profile") return "/staff/profile";
  if (type.includes("leave")) return "/staff/leave";
  return "/staff/dashboard";
};

const actionLabel = (notificationType, group) => {
  const type = String(notificationType || "").toLowerCase();
  if (type === "ai_chatbot_handoff") return "Mở hỗ trợ";
  if (group === "schedule") return "Xem lịch";
  if (group === "attendance") return "Xem chấm công";
  if (group === "payroll") return "Xem phiếu lương";
  if (group === "order") return "Mở đơn";
  if (group === "kitchen") return "Mở bếp";
  if (group === "profile") return "Xem hồ sơ";
  if (type.includes("leave")) return "Xem nghỉ phép";
  return "Mở chi tiết";
};

const formatTime = (value) => {
  if (!value) return "Vừa xong";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const mapNotification = (notification) => {
  const payload = notification?.payload && typeof notification.payload === "object"
    ? notification.payload
    : {};
  const type = resolveType(notification?.type);
  const actionUrl = String(payload.actionUrl || "");
  const unread = !notification?.readAt;

  return {
    id: String(notification.id),
    type,
    title: payload.title || typeMeta[type]?.label || "Thông báo",
    description:
      payload.message ||
      payload.messagePreview ||
      "Có cập nhật mới liên quan đến công việc của bạn.",
    time: formatTime(notification.createdAt),
    status: unread && ["request", "attendance"].includes(type) ? "action" : unread ? "new" : "read",
    cta: actionLabel(notification.type, type),
    to: actionUrl.startsWith("/") ? actionUrl : fallbackRoute(notification.type, type),
    unread,
  };
};

const removeFromSet = (setter, id) => {
  setter((previous) => {
    const next = new Set(previous);
    next.delete(id);
    return next;
  });
};

const StaffNotificationsPage = () => {
  const { user } = useContext(AuthContext) || {};
  const restaurantId = useMemo(() => resolveStaffRestaurantId(user), [user]);
  const {
    notifications: backendNotifications,
    notificationsLoading,
    notificationsError,
    markNotificationRead,
    markAllNotificationsRead,
    archiveNotification,
    refetchNotifications,
  } = useCommunication({ restaurantId, notificationsEnabled: true });

  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [locallyReadIds, setLocallyReadIds] = useState(() => new Set());
  const [locallyDeletedIds, setLocallyDeletedIds] = useState(() => new Set());
  const [actionError, setActionError] = useState("");

  const notifications = useMemo(
    () => (backendNotifications || [])
      .map(mapNotification)
      .filter((item) => !locallyDeletedIds.has(item.id))
      .map((item) => ({ ...item, unread: item.unread && !locallyReadIds.has(item.id) })),
    [backendNotifications, locallyDeletedIds, locallyReadIds],
  );

  const unreadCount = notifications.filter((item) => item.unread).length;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredNotifications = notifications.filter((item) => {
    const matchesTab = activeTab === "all"
      ? true
      : activeTab === "unread"
        ? item.unread
        : item.type === activeTab || (activeTab === "system" && ["system", "profile", "payroll", "order", "kitchen"].includes(item.type));

    const meta = typeMeta[item.type] || typeMeta.system;
    const haystack = [
      item.title,
      item.description,
      item.time,
      meta.label,
      statusLabels[item.status],
    ].join(" ").toLowerCase();

    return matchesTab && (!normalizedSearch || haystack.includes(normalizedSearch));
  });

  const markRead = async (id) => {
    if (!id || locallyReadIds.has(id)) return;
    setActionError("");
    setLocallyReadIds((previous) => new Set(previous).add(id));
    try {
      const result = await markNotificationRead({ variables: { id } });
      if (result?.data?.markNotificationRead === false) throw new Error("Không thể đánh dấu thông báo đã đọc.");
      await refetchNotifications?.();
    } catch (error) {
      removeFromSet(setLocallyReadIds, id);
      setActionError(error?.message || "Không thể đánh dấu thông báo đã đọc.");
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((item) => item.unread).map((item) => item.id);
    if (!unreadIds.length) return;
    setActionError("");
    setLocallyReadIds((previous) => new Set([...previous, ...unreadIds]));
    try {
      const result = await markAllNotificationsRead({ variables: { restaurantId } });
      if (result?.data?.markAllNotificationsRead === false) throw new Error("Không thể đánh dấu tất cả thông báo.");
      await refetchNotifications?.();
    } catch (error) {
      unreadIds.forEach((id) => removeFromSet(setLocallyReadIds, id));
      setActionError(error?.message || "Không thể đánh dấu tất cả thông báo.");
    }
  };

  const archive = async (id) => {
    setActionError("");
    setLocallyDeletedIds((previous) => new Set(previous).add(id));
    try {
      const result = await archiveNotification({ variables: { id } });
      if (result?.data?.archiveNotification === false) throw new Error("Không thể ẩn thông báo.");
      await refetchNotifications?.();
    } catch (error) {
      removeFromSet(setLocallyDeletedIds, id);
      setActionError(error?.message || "Không thể ẩn thông báo.");
    }
  };

  return (
    <div className="staff-notifications staff-page" aria-labelledby="staff-notifications-title">
      <section className="staff-notifications__toolbar-card" aria-label="Bộ lọc thông báo">
        <div className="staff-notifications__topline">
          <div className="staff-notifications__heading">
            <h1 id="staff-notifications-title">Thông báo</h1>
            <p>Theo dõi lịch làm, chấm công và việc cần xử lý.</p>
          </div>
          <div className="staff-notifications__actions">
            <span className="staff-notifications__total">{notifications.length} thông báo</span>
            <span className="staff-notifications__unread-pill" aria-label={`${unreadCount} thông báo mới`}>
              <BellRing size={15} /> {unreadCount} mới
            </span>
            <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck size={16} /> Đánh dấu đã đọc
            </button>
          </div>
        </div>

        <div className="staff-notifications__search-row">
          <label className="staff-notifications__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm thông báo"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm thông báo, lịch làm, chấm công..."
            />
            {searchTerm ? (
              <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchTerm("")}>
                <X size={15} />
              </button>
            ) : null}
          </label>
          <span className="staff-notifications__filtered-count">{filteredNotifications.length} kết quả</span>
        </div>

        <div className="staff-notifications__filters">
          <nav className="staff-notifications__tabs" aria-label="Lọc thông báo nhân viên">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "is-active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <p className="staff-notifications__local-note" role={actionError ? "alert" : undefined}>
          {actionError || "Thông báo được đồng bộ từ hệ thống và cập nhật theo thời gian thực."}
        </p>
      </section>

      <section className="staff-notifications__list" aria-live="polite">
        {notificationsLoading && !notifications.length ? (
          <div className="staff-notifications__empty" role="status">
            <Inbox size={34} />
            <h2>Đang tải thông báo</h2>
            <p>Hệ thống đang đồng bộ dữ liệu mới nhất.</p>
          </div>
        ) : notificationsError && !notifications.length ? (
          <div className="staff-notifications__empty" role="alert">
            <Inbox size={34} />
            <h2>Không thể tải thông báo</h2>
            <p>Vui lòng tải lại trang hoặc thử lại sau.</p>
          </div>
        ) : filteredNotifications.length ? filteredNotifications.map((item) => {
          const meta = typeMeta[item.type] || typeMeta.system;
          const Icon = meta.icon;
          return (
            <article key={item.id} className={`staff-notification-card ${item.unread ? "is-unread" : ""}`}>
              <div className="staff-notification-card__icon" aria-hidden="true"><Icon size={20} /></div>
              <div className="staff-notification-card__content">
                <div className="staff-notification-card__meta">
                  <span>{meta.label}</span>
                  <span>{item.time}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <div className="staff-notification-card__actions">
                  <Link to={item.to} onClick={() => void markRead(item.id)}>{item.cta}</Link>
                  {item.unread ? <button type="button" onClick={() => void markRead(item.id)}>Đánh dấu đọc</button> : null}
                </div>
              </div>
              <div className="staff-notification-card__state">
                <span className={`staff-notification-card__status is-${item.status}`}>{statusLabels[item.status]}</span>
                {item.unread ? <span className="staff-notification-card__dot" aria-label="Thông báo mới" /> : null}
                <button type="button" aria-label={`Ẩn thông báo: ${item.title}`} title="Ẩn thông báo" onClick={() => void archive(item.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          );
        }) : (
          <div className="staff-notifications__empty" role="status">
            <Inbox size={34} />
            <h2>Chưa có thông báo phù hợp</h2>
            <p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default StaffNotificationsPage;
