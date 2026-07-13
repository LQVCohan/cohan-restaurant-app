import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import {
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  canAccessRoute,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import { getStaffRoleDisplayLabel } from "@/utils/staffRoleOptions";
import "./StaffSettingsPage.scss";

const STORAGE_KEY = "staff-workspace-local-settings-v1";

const ROLE_LABEL_FALLBACK = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  hr: "Nhân sự",
  accountant: "Kế toán",
  staff: "Nhân viên",
};

const DEFAULT_LOCAL_SETTINGS = {
  scheduleReminder: true,
  beforeShiftReminder: true,
  publishedScheduleReminder: true,
  handoffReminder: true,
  density: "comfortable",
  fontSize: "standard",
  compactMobileMenu: true,
};

const getRoleLabel = (user) => {
  const normalized = resolveUserRoleName(user);
  return ROLE_LABEL_FALLBACK[normalized] || getStaffRoleDisplayLabel(normalized) || "Nhân viên";
};

const getRestaurantLabel = (user, restaurants = []) => {
  const assignedId = user?.restaurantForStaff;
  const matched = restaurants.find((restaurant) => restaurant?.id === assignedId);
  return matched?.name || user?.restaurantName || "Chưa xác định cơ sở làm việc";
};

const getDeviceLabel = () => {
  if (typeof navigator === "undefined") return "Thiết bị hiện tại";
  const ua = navigator.userAgent || "";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Chrome trên thiết bị hiện tại";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari trên thiết bị hiện tại";
  if (/Firefox/i.test(ua)) return "Firefox trên thiết bị hiện tại";
  if (/Edg/i.test(ua)) return "Edge trên thiết bị hiện tại";
  return "Trình duyệt hiện tại";
};

export default function StaffSettingsPage() {
  const { user, restaurants = [], logout } = useContext(AuthContext) || {};
  const [settings, setSettings] = useState(DEFAULT_LOCAL_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_LOCAL_SETTINGS);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && typeof stored === "object") {
        const next = { ...DEFAULT_LOCAL_SETTINGS, ...stored };
        setSettings(next);
        setSavedSettings(next);
      }
    } catch {
      setSettings(DEFAULT_LOCAL_SETTINGS);
      setSavedSettings(DEFAULT_LOCAL_SETTINGS);
    }
  }, []);

  const roleLabel = useMemo(() => getRoleLabel(user), [user]);
  const restaurantLabel = useMemo(() => getRestaurantLabel(user, restaurants), [restaurants, user]);
  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings],
  );
  const canOpenManagerWorkspace = canAccessRoute(user, "/manager");

  const accessItems = useMemo(
    () => [
      { label: "Đơn nội bộ", enabled: hasStaffOrderAccess(user) },
      { label: "Khu vực bếp", enabled: hasStaffKitchenAccess(user) },
      { label: "Liên lạc", enabled: true },
      { label: "Thông báo", enabled: true },
      { label: "Phiếu lương", enabled: true },
    ],
    [user],
  );

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedSettings(settings);
  };

  const restoreSettings = () => {
    setSettings(savedSettings);
  };

  return (
    <section className="staff-settings staff-page" aria-labelledby="staff-settings-title">
      <header className="staff-settings__intro">
        <div>
          <span className="staff-settings__eyebrow">Lưu trên thiết bị này</span>
          <h1 id="staff-settings-title">Thiết lập làm việc</h1>
          <p>Cá nhân hóa nhắc việc, mật độ hiển thị và các thông tin phiên làm việc của nhân viên.</p>
        </div>
        <div className="staff-settings__intro-actions" aria-label="Điều hướng tài khoản">
          <Link to="/" className="staff-settings__home-link">
            Về trang chủ
          </Link>
          {canOpenManagerWorkspace ? (
            <Link to="/manager#dashboard" className="staff-settings__manager-link">
              Về trang quản lý
            </Link>
          ) : null}
          <Link to="/staff/profile" className="staff-settings__profile-link">
            Xem hồ sơ
          </Link>
        </div>
      </header>

      <div className="staff-settings__grid">
        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Tài khoản & định danh</h2>
            <span>Đang đăng nhập</span>
          </div>
          <dl className="staff-settings-list">
            <div><dt>Tên hiển thị</dt><dd>{user?.fullName || user?.username || "Nhân viên"}</dd></div>
            <div><dt>Vai trò</dt><dd>{roleLabel}</dd></div>
            <div><dt>Cơ sở</dt><dd>{restaurantLabel}</dd></div>
            <div><dt>Trạng thái</dt><dd>{user?.status || "Sẵn sàng"}</dd></div>
            <div><dt>Email</dt><dd>{user?.email || "Chưa cập nhật"}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{user?.phone || "Chưa cập nhật"}</dd></div>
          </dl>
        </article>

        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Ca làm & thông báo</h2>
            <span>Nhắc việc</span>
          </div>
          <div className="staff-toggle-list">
            {[
              ["scheduleReminder", "Nhận nhắc lịch cá nhân"],
              ["beforeShiftReminder", "Nhắc trước ca làm"],
              ["publishedScheduleReminder", "Nhắc khi có lịch công bố"],
              ["handoffReminder", "Nhắc khi có yêu cầu bàn giao/hỗ trợ"],
            ].map(([key, label]) => (
              <label className="staff-toggle-row" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key])}
                  onChange={(event) => updateSetting(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
          <p className="staff-settings-note">Các tùy chọn hiển thị được lưu trên thiết bị này.</p>
        </article>

        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Hiển thị</h2>
            <span>Giao diện</span>
          </div>
          <div className="staff-setting-group">
            <span>Mật độ giao diện</span>
            <div className="staff-segmented-control">
              {[['comfortable', 'Thoải mái'], ['compact', 'Gọn']].map(([value, label]) => (
                <button key={value} type="button" className={settings.density === value ? "is-active" : ""} onClick={() => updateSetting('density', value)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="staff-setting-group">
            <span>Cỡ chữ</span>
            <div className="staff-segmented-control">
              {[['standard', 'Tiêu chuẩn'], ['large', 'Lớn']].map(([value, label]) => (
                <button key={value} type="button" className={settings.fontSize === value ? "is-active" : ""} onClick={() => updateSetting('fontSize', value)}>{label}</button>
              ))}
            </div>
          </div>
          <label className="staff-toggle-row staff-toggle-row--soft">
            <span>Luôn mở menu thu gọn trên điện thoại</span>
            <input
              type="checkbox"
              checked={Boolean(settings.compactMobileMenu)}
              onChange={(event) => updateSetting("compactMobileMenu", event.target.checked)}
            />
          </label>
        </article>

        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Thiết bị & phiên làm việc</h2>
            <span>Đang hoạt động</span>
          </div>
          <dl className="staff-settings-list">
            <div><dt>Thiết bị</dt><dd>{getDeviceLabel()}</dd></div>
            <div><dt>Phiên</dt><dd>Đang hoạt động</dd></div>
          </dl>
          <p className="staff-settings-note">Đăng xuất khỏi thiết bị công cộng sau ca làm.</p>
          {typeof logout === "function" ? (
            <button type="button" className="staff-settings-neutral-action" onClick={logout}>Đăng xuất</button>
          ) : null}
        </article>

        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Quyền truy cập</h2>
            <span>Theo vai trò</span>
          </div>
          <div className="staff-access-grid">
            {accessItems.map((item) => (
              <span key={item.label} className={`staff-access-pill ${item.enabled ? "is-enabled" : "is-disabled"}`}>
                {item.label}
              </span>
            ))}
          </div>
        </article>

        <article className="staff-settings-card staff-card">
          <div className="staff-settings-card__header">
            <h2>Hỗ trợ</h2>
            <span>Trong ca</span>
          </div>
          <div className="staff-support-actions">
            <Link to="/staff/contacts">Liên hệ quản lý</Link>
            <Link to="/staff/ai-handoff">Bàn giao hỗ trợ</Link>
          </div>
          <p className="staff-settings-note">Dùng các kênh hỗ trợ khi có vướng mắc trong ca làm hoặc cần chuyển tiếp yêu cầu khách.</p>
        </article>
      </div>

      {isDirty ? (
        <div className="staff-settings-savebar" role="status">
          <span>Các thay đổi chỉ lưu trên thiết bị này.</span>
          <div>
            <button type="button" onClick={restoreSettings}>Khôi phục</button>
            <button type="button" className="is-primary" onClick={saveSettings}>Lưu thay đổi</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
