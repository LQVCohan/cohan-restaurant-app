import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Copy,
  KeyRound,
  Laptop,
  LifeBuoy,
  MonitorCog,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import "./ManagerAccountCenter.scss";

const Q_MY_ACCOUNT = gql`
  query ManagerMyAccount {
    me {
      id
      fullName
      email
      phone
      avatarUrl
      roleName
      status
      emailVerified
      phoneVerified
    }
  }
`;

const M_UPDATE_ACCOUNT = gql`
  mutation ManagerUpdateAccount($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      email
      phone
      avatarUrl
    }
  }
`;

const M_CHANGE_PASSWORD = gql`
  mutation ManagerChangePassword($currentPassword: String!, $newPassword: String!) {
    changeMyPassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

const Q_LOGIN_SESSIONS = gql`
  query ManagerLoginSessions($limit: Int) {
    myLoginSessions(limit: $limit) {
      id
      userAgent
      ip
      createdAt
      isCurrent
      isActive
    }
  }
`;

const M_REVOKE_SESSION = gql`
  mutation ManagerRevokeSession($id: ID!) {
    revokeMyLoginSession(id: $id)
  }
`;

const M_REVOKE_OTHER_SESSIONS = gql`
  mutation ManagerRevokeOtherSessions {
    revokeOtherMyLoginSessions
  }
`;

const TABS = new Set(["profile", "security", "notifications", "support"]);
const DEFAULT_NOTIFICATION_PREFERENCES = { showBadge: true, browser: false };

const readNotificationPreferences = () => {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...JSON.parse(localStorage.getItem("manager.notificationPreferences") || "{}"),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

const formatDate = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Không xác định";

const ManagerAccountCenter = () => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab = TABS.has(requestedTab) ? requestedTab : "profile";
  const [profileForm, setProfileForm] = useState({ fullName: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [notificationPreferences, setNotificationPreferences] = useState(readNotificationPreferences);

  const { data, loading, error, refetch } = useQuery(Q_MY_ACCOUNT, { fetchPolicy: "network-only" });
  const { data: sessionData, loading: sessionsLoading, refetch: refetchSessions } = useQuery(Q_LOGIN_SESSIONS, {
    variables: { limit: 20 },
    skip: activeTab !== "security",
    fetchPolicy: "network-only",
  });
  const [updateAccount, updateState] = useMutation(M_UPDATE_ACCOUNT);
  const [changePassword, passwordState] = useMutation(M_CHANGE_PASSWORD);
  const [revokeSession, revokeState] = useMutation(M_REVOKE_SESSION);
  const [revokeOtherSessions, revokeOtherState] = useMutation(M_REVOKE_OTHER_SESSIONS);

  const user = data?.me;
  const sessions = sessionData?.myLoginSessions || [];
  const initials = useMemo(() => String(user?.fullName || "QL").split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase(), [user?.fullName]);

  useEffect(() => {
    if (user) setProfileForm({ fullName: user.fullName || "" });
  }, [user]);

  const navigateManagerPage = (page, query = {}) => {
    window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, query, source: "manager-account" } }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const fullName = profileForm.fullName.trim();
    if (!fullName) {
      showNotification("Họ và tên không được để trống.", "warning");
      return;
    }
    try {
      await updateAccount({ variables: { input: { fullName } } });
      await refetch();
      showNotification("Đã cập nhật thông tin cá nhân.", "success");
    } catch (mutationError) {
      showNotification(mutationError.message || "Không thể cập nhật thông tin cá nhân.", "error");
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.next.length < 8) {
      showNotification("Mật khẩu mới cần ít nhất 8 ký tự.", "warning");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      showNotification("Mật khẩu xác nhận không khớp.", "warning");
      return;
    }
    try {
      await changePassword({ variables: { currentPassword: passwordForm.current, newPassword: passwordForm.next } });
      setPasswordForm({ current: "", next: "", confirm: "" });
      showNotification("Đã đổi mật khẩu.", "success");
    } catch (mutationError) {
      showNotification(mutationError.message || "Không thể đổi mật khẩu.", "error");
    }
  };

  const saveNotificationPreferences = (next) => {
    setNotificationPreferences(next);
    localStorage.setItem("manager.notificationPreferences", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("manager:notification-preferences", { detail: next }));
  };

  const toggleBrowserNotifications = async () => {
    if (!notificationPreferences.browser && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showNotification("Trình duyệt chưa cho phép gửi thông báo.", "warning");
        return;
      }
    }
    const next = { ...notificationPreferences, browser: !notificationPreferences.browser };
    saveNotificationPreferences(next);
    showNotification("Đã lưu cài đặt thông báo.", "success");
  };

  const handleRevokeSession = async (id) => {
    try {
      await revokeSession({ variables: { id } });
      await refetchSessions();
      showNotification("Đã đăng xuất phiên được chọn.", "success");
    } catch (mutationError) {
      showNotification(mutationError.message || "Không thể đăng xuất phiên này.", "error");
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await revokeOtherSessions();
      await refetchSessions();
      showNotification("Đã đăng xuất các phiên khác.", "success");
    } catch (mutationError) {
      showNotification(mutationError.message || "Không thể đăng xuất các phiên khác.", "error");
    }
  };

  const copySupportInfo = async () => {
    const text = `Cohan Manager | User: ${user?.email || "N/A"} | Role: ${user?.roleName || "N/A"} | Page: ${window.location.href}`;
    await navigator.clipboard.writeText(text);
    showNotification("Đã sao chép thông tin hỗ trợ.", "success");
  };

  if (loading) return <div className="manager-account__state">Đang tải thông tin tài khoản...</div>;
  if (error) return <div className="manager-account__state manager-account__state--error">Không thể tải tài khoản: {error.message}</div>;

  return (
    <main className="manager-account">
      <header className="manager-account__hero">
        <div>
          <span className="manager-account__eyebrow">TÀI KHOẢN QUẢN LÝ</span>
          <h1>Hồ sơ và bảo mật</h1>
          <p>Quản lý thông tin cá nhân, phiên đăng nhập và tùy chọn làm việc trong hệ thống Cohan.</p>
        </div>
        <div className="manager-account__identity">
          <div className="manager-account__avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials}</span>}</div>
          <div>
            <strong>{user?.fullName}</strong>
            <span>{user?.email}</span>
          </div>
          <span className="manager-account__status"><CheckCircle2 size={14} /> {user?.status || "active"}</span>
        </div>
      </header>

      <div className="manager-account__layout">
        <nav className="manager-account__nav" aria-label="Cài đặt tài khoản">
          <button className={activeTab === "profile" ? "active" : ""} onClick={() => navigateManagerPage("account", { tab: "profile" })} type="button"><UserRound size={18} /><span>Thông tin cá nhân</span></button>
          <button className={activeTab === "security" ? "active" : ""} onClick={() => navigateManagerPage("account", { tab: "security" })} type="button"><ShieldCheck size={18} /><span>Bảo mật tài khoản</span></button>
          <button className={activeTab === "notifications" ? "active" : ""} onClick={() => navigateManagerPage("account", { tab: "notifications" })} type="button"><Bell size={18} /><span>Thông báo</span></button>
          <button className={activeTab === "support" ? "active" : ""} onClick={() => navigateManagerPage("account", { tab: "support" })} type="button"><LifeBuoy size={18} /><span>Hỗ trợ</span></button>
        </nav>

        <section className="manager-account__content">
          {activeTab === "profile" && (
            <form className="manager-account__panel" onSubmit={saveProfile}>
              <div className="manager-account__panel-heading"><div><span>HỒ SƠ</span><h2>Thông tin cá nhân</h2><p>Dữ liệu này được lấy trực tiếp từ tài khoản đang đăng nhập.</p></div><UserRound size={22} /></div>
              <div className="manager-account__form-grid">
                <label><span>Họ và tên</span><input value={profileForm.fullName} onChange={(event) => setProfileForm({ fullName: event.target.value })} /></label>
                <label><span>Email</span><input value={user?.email || ""} disabled /></label>
                <label><span>Số điện thoại</span><input value={user?.phone || "Chưa cập nhật"} disabled /></label>
                <label><span>Vai trò hệ thống</span><input value={user?.roleName || "manager"} disabled /></label>
              </div>
              <div className="manager-account__actions"><button className="manager-account__primary" disabled={updateState.loading} type="submit"><Save size={16} />{updateState.loading ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
            </form>
          )}

          {activeTab === "security" && (
            <div className="manager-account__stack">
              <form className="manager-account__panel" onSubmit={savePassword}>
                <div className="manager-account__panel-heading"><div><span>BẢO MẬT</span><h2>Đổi mật khẩu</h2><p>Cập nhật mật khẩu cho tài khoản quản lý hiện tại.</p></div><KeyRound size={22} /></div>
                <div className="manager-account__form-grid">
                  <label><span>Mật khẩu hiện tại</span><input type="password" autoComplete="current-password" value={passwordForm.current} onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))} /></label>
                  <label><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" value={passwordForm.next} onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))} /></label>
                  <label><span>Xác nhận mật khẩu</span><input type="password" autoComplete="new-password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))} /></label>
                </div>
                <div className="manager-account__actions"><button className="manager-account__primary" disabled={passwordState.loading} type="submit"><KeyRound size={16} />{passwordState.loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</button></div>
              </form>

              <section className="manager-account__panel">
                <div className="manager-account__panel-heading"><div><span>PHIÊN ĐĂNG NHẬP</span><h2>Thiết bị đang hoạt động</h2><p>Kiểm tra và thu hồi các phiên không còn sử dụng.</p></div><Laptop size={22} /></div>
                <div className="manager-account__session-actions"><button type="button" onClick={handleRevokeOtherSessions} disabled={revokeOtherState.loading}>Đăng xuất các thiết bị khác</button></div>
                <div className="manager-account__sessions">
                  {sessionsLoading && <p>Đang tải phiên đăng nhập...</p>}
                  {!sessionsLoading && sessions.length === 0 && <p>Chưa có phiên đăng nhập nào.</p>}
                  {sessions.map((session) => (
                    <article key={session.id}>
                      <MonitorCog size={18} />
                      <div><strong>{session.userAgent || "Thiết bị không xác định"}</strong><span>{session.ip || "IP không rõ"} · {formatDate(session.createdAt)}</span></div>
                      {session.isCurrent ? <em>Hiện tại</em> : session.isActive ? <button type="button" onClick={() => handleRevokeSession(session.id)} disabled={revokeState.loading}>Đăng xuất</button> : <em>Đã thu hồi</em>}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "notifications" && (
            <section className="manager-account__panel">
              <div className="manager-account__panel-heading"><div><span>THÔNG BÁO</span><h2>Tùy chọn nhận thông báo</h2><p>Điều chỉnh cách hệ thống hiển thị cập nhật trong phiên quản lý.</p></div><Bell size={22} /></div>
              <div className="manager-account__setting-row"><div><strong>Hiện số chưa đọc trên header</strong><span>Hiển thị badge đếm thông báo ở biểu tượng chuông.</span></div><button type="button" className={`manager-account__switch ${notificationPreferences.showBadge ? "active" : ""}`} aria-pressed={notificationPreferences.showBadge} onClick={() => saveNotificationPreferences({ ...notificationPreferences, showBadge: !notificationPreferences.showBadge })}><span /></button></div>
              <div className="manager-account__setting-row"><div><strong>Thông báo trình duyệt</strong><span>Cho phép trình duyệt hiển thị thông báo khi Cohan đang mở.</span></div><button type="button" className={`manager-account__switch ${notificationPreferences.browser ? "active" : ""}`} aria-pressed={notificationPreferences.browser} onClick={toggleBrowserNotifications}><span /></button></div>
            </section>
          )}

          {activeTab === "support" && (
            <section className="manager-account__panel">
              <div className="manager-account__panel-heading"><div><span>HỖ TRỢ VẬN HÀNH</span><h2>Công cụ hỗ trợ nhanh</h2><p>Truy cập các khu vực xử lý sự cố mà không rời giao diện quản lý.</p></div><LifeBuoy size={22} /></div>
              <div className="manager-account__support-grid">
                <button type="button" onClick={() => navigateManagerPage("settings")}><MonitorCog size={19} /><span><strong>Cài đặt hệ thống</strong><small>Kiểm tra cấu hình vận hành và module.</small></span></button>
                <button type="button" onClick={() => navigateManagerPage("rbac")}><ShieldCheck size={19} /><span><strong>Phân quyền</strong><small>Kiểm tra role và quyền truy cập.</small></span></button>
                <button type="button" onClick={copySupportInfo}><Copy size={19} /><span><strong>Sao chép thông tin hỗ trợ</strong><small>Gửi nhanh thông tin phiên và trang hiện tại.</small></span></button>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
};

export default ManagerAccountCenter;
