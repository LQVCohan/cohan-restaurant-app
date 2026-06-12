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
  ShoppingBag,
  Trash2,
  UserRound,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
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
  order: { label: "Order", icon: ShoppingBag },
  kitchen: { label: "Bếp", icon: CookingPot },
  payroll: { label: "Lương", icon: CreditCard },
  profile: { label: "Hồ sơ", icon: UserRound },
};

const buildNotifications = ({ user, role, canOrder, canKitchen }) => {
  const items = [
    {
      id: "check-week-schedule",
      type: "schedule",
      title: "Kiểm tra lịch tuần",
      description: "Lịch cá nhân là nơi xác nhận ca, xem thay đổi và theo dõi yêu cầu nhận/từ chối ca.",
      time: "Đầu ca",
      status: "new",
      cta: "Kiểm tra lịch",
      to: "/staff/schedule",
      unread: true,
    },
    {
      id: "attendance-reminder",
      type: "attendance",
      title: "Nhắc chấm công",
      description: "Check-in khi sắp vào ca và check-out sau khi hoàn tất để dữ liệu công không bị lệch.",
      time: "Trong ca",
      status: "action",
      cta: "Check-in/out",
      to: "/staff/schedule",
      unread: true,
    },
    {
      id: "availability-window",
      type: "request",
      title: "Gửi availability đúng kỳ",
      description: "Part-time chọn ca có thể làm; full-time báo ca không khả dụng nếu chính sách cho phép.",
      time: "Theo tuần",
      status: "action",
      cta: "Đăng ký lịch",
      to: "/staff/schedule",
      unread: false,
    },
    {
      id: "manager-feedback",
      type: "system",
      title: "Theo dõi phản hồi quản lý",
      description: "Các yêu cầu thay đổi ca, chỉnh công hoặc phản hồi hiệu suất cần được kiểm tra thường xuyên.",
      time: "Hôm nay",
      status: "read",
      cta: "Xem hiệu suất",
      to: "/staff/performance",
      unread: false,
    },
    {
      id: "payroll-preview",
      type: "payroll",
      title: "Kiểm tra phiếu lương đã công bố",
      description: "Xem kỳ lương, trạng thái thanh toán và ghi chú nếu có chênh lệch công.",
      time: "Khi có kỳ lương",
      status: "read",
      cta: "Xem phiếu lương",
      to: "/staff/payslips",
      unread: false,
    },
  ];

  if (!user?.phone || !user?.email || !user?.restaurantForStaff) {
    items.push({
      id: "missing-profile-info",
      type: "profile",
      title: "Hồ sơ cần bổ sung thông tin",
      description: "Một số thông tin liên hệ/cơ sở còn thiếu. Trang hồ sơ chỉ đọc; vui lòng gửi yêu cầu cập nhật cho quản lý.",
      time: "Cần kiểm tra",
      status: "action",
      cta: "Xem hồ sơ",
      to: "/staff/profile",
      unread: true,
    });
  }

  if (canOrder) {
    items.push({
      id: "order-workspace",
      type: "order",
      title: "Order nội bộ đã sẵn sàng",
      description: "Vai trò của bạn có quyền mở order nội bộ để xử lý bàn, order và thanh toán.",
      time: "Theo ca",
      status: "new",
      cta: "Mở order",
      to: "/staff/orders",
      unread: true,
    });
  }

  if (canKitchen) {
    items.push({
      id: "kitchen-workspace",
      type: "kitchen",
      title: "Theo dõi nhịp bếp",
      description: "Vai trò bếp có thể mở khu vực bếp để nhận món chờ, đang làm và hoàn tất.",
      time: "Theo ca",
      status: "new",
      cta: "Mở bếp",
      to: "/staff/kitchen",
      unread: true,
    });
  }

  if (["cleaner", "shipper", "storekeeper", "bartender"].includes(role)) {
    items.push({
      id: "specialty-handoff",
      type: "system",
      title: "Theo dõi bàn giao chuyên môn",
      description: "Vai trò của bạn không mở order/bếp mặc định; ưu tiên lịch, nhắc việc và bàn giao theo ca.",
      time: "Theo vai trò",
      status: "read",
      cta: "Xem lịch",
      to: "/staff/schedule",
      unread: false,
    });
  }

  return items;
};

const statusLabels = {
  new: "Mới",
  action: "Cần xử lý",
  read: "Đã đọc",
  resolved: "Đã xử lý",
};

const StaffNotificationsPage = () => {
  const { user } = useContext(AuthContext) || {};
  const role = useMemo(() => resolveUserRoleName(user), [user]);
  const canOrder = hasStaffOrderAccess(role);
  const canKitchen = hasStaffKitchenAccess(role);
  const generatedNotifications = useMemo(
    () => buildNotifications({ user, role, canOrder, canKitchen }),
    [user, role, canOrder, canKitchen],
  );
  const [activeTab, setActiveTab] = useState("all");
  const [locallyReadIds, setLocallyReadIds] = useState(() => new Set());
  const [locallyDeletedIds, setLocallyDeletedIds] = useState(() => new Set());

  const notifications = useMemo(
    () => generatedNotifications
      .filter((item) => !locallyDeletedIds.has(item.id))
      .map((item) => ({ ...item, unread: item.unread && !locallyReadIds.has(item.id) })),
    [generatedNotifications, locallyDeletedIds, locallyReadIds],
  );
  const unreadCount = notifications.filter((item) => item.unread).length;
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return item.unread;
    return item.type === activeTab || (activeTab === "system" && ["system", "profile", "payroll", "order", "kitchen"].includes(item.type));
  });

  const markRead = (id) => setLocallyReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => setLocallyReadIds(new Set(generatedNotifications.map((item) => item.id)));
  const deleteLocal = (id) => setLocallyDeletedIds((prev) => new Set(prev).add(id));

  return (
    <div className="staff-notifications staff-page" aria-labelledby="staff-notifications-title">
      <section className="staff-notifications__hero">
        <div>
          <span className="staff-notifications__eyebrow">Workspace notifications</span>
          <h1 id="staff-notifications-title">Thông báo trong ca</h1>
          <p>Lịch làm, chấm công, phản hồi quản lý và yêu cầu thay đổi ca cho nhân viên nhà hàng.</p>
        </div>
        <div className="staff-notifications__summary" aria-label={`${unreadCount} thông báo mới`}>
          <BellRing size={24} />
          <strong>{unreadCount}</strong>
          <span>mới</span>
        </div>
      </section>

      <div className="staff-notifications__local-note" role="note">
        Mark read/delete hiện chỉ là trạng thái local UI trong phiên này; chưa ghi lên server thông báo nhân viên.
      </div>

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

      <section className="staff-notifications__toolbar" aria-label="Tác vụ thông báo">
        <span>{filteredNotifications.length} thông báo đang hiển thị</span>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={17} /> Đánh dấu đã đọc
        </button>
      </section>

      <section className="staff-notifications__list" aria-live="polite">
        {filteredNotifications.length ? filteredNotifications.map((item) => {
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
                  <Link to={item.to} onClick={() => markRead(item.id)}>{item.cta}</Link>
                  {item.unread ? <button type="button" onClick={() => markRead(item.id)}>Đánh dấu đọc</button> : null}
                </div>
              </div>
              <div className="staff-notification-card__state">
                <span className={`staff-notification-card__status is-${item.status}`}>{statusLabels[item.status]}</span>
                {item.unread ? <span className="staff-notification-card__dot" aria-label="Thông báo mới" /> : null}
                <button type="button" aria-label={`Ẩn thông báo: ${item.title}`} onClick={() => deleteLocal(item.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          );
        }) : (
          <div className="staff-notifications__empty" role="status">
            <Inbox size={38} />
            <h2>Chưa có thông báo trong ca</h2>
            <p>Không có mục nào phù hợp bộ lọc hiện tại.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default StaffNotificationsPage;
