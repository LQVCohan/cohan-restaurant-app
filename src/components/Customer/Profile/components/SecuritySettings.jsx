// src/components/Customer/Profile/components/SecuritySettings.jsx
import React, { useContext, useState } from "react";
import { useMutation, useQuery, gql } from "@apollo/client";
import Modal from "../../../common/Modal"; // Đảm bảo đường dẫn đúng
import ToggleSwitch from "../../../common/ToggleSwitch/ToggleSwitch";
import { getCustomerActionErrorMessage } from "@/utils/customerFlowErrorMessages";
import { AuthContext } from "@/context/AuthContext";
import "./SecuritySettings.scss";

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changeMyPassword(currentPassword: $oldPassword, newPassword: $newPassword)
  }
`;

const MY_LOGIN_SESSIONS = gql`
  query MyLoginSessions($limit: Int) {
    myLoginSessions(limit: $limit) {
      id
      userAgent
      ip
      createdAt
      expiresAt
      revokedAt
      isCurrent
      isActive
    }
  }
`;

const REVOKE_OTHER_SESSIONS = gql`
  mutation RevokeOtherMyLoginSessions {
    revokeOtherMyLoginSessions
  }
`;

const REVOKE_SESSION = gql`
  mutation RevokeMyLoginSession($id: ID!) {
    revokeMyLoginSession(id: $id)
  }
`;

const DELETE_MY_ACCOUNT = gql`
  mutation DeleteMyAccount($currentPassword: String, $confirmText: String!) {
    deleteMyAccount(currentPassword: $currentPassword, confirmText: $confirmText)
  }
`;

const formatDate = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Không xác định";
const deviceIcon = (userAgent = "") => /mobile|iphone|android/i.test(userAgent) ? "📱" : "💻";
const deviceName = (userAgent) => userAgent || "Thiết bị không xác định";

const SecuritySettings = () => {
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ currentPassword: "", confirmText: "" });
  const { logout } = useContext(AuthContext) || {};
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);
  const { data, loading: sessionsLoading, refetch } = useQuery(MY_LOGIN_SESSIONS, { variables: { limit: 20 } });
  const [revokeOther, { loading: revokingOther }] = useMutation(REVOKE_OTHER_SESSIONS);
  const [revokeSession, { loading: revokingSession }] = useMutation(REVOKE_SESSION);
  const [deleteMyAccount, { loading: deletingAccount }] = useMutation(DELETE_MY_ACCOUNT);
  const sessions = data?.myLoginSessions || [];

  const submitPassword = async () => {
    if (pwdForm.next !== pwdForm.confirm) {
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }
    try {
      await changePassword({
        variables: { oldPassword: pwdForm.current, newPassword: pwdForm.next },
      });
      alert("Đổi mật khẩu thành công!");
      setChangePwdOpen(false);
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      alert(
        getCustomerActionErrorMessage(
          err,
          "Lỗi: " + (err?.message || "Không thể đổi mật khẩu."),
        ),
      );
    }
  };

  const handleRevokeSession = async (id) => {
    await revokeSession({ variables: { id } });
    alert("Đã đăng xuất phiên đã chọn.");
    refetch();
  };

  const handleRevokeOther = async () => {
    const result = await revokeOther();
    alert(`Đã đăng xuất ${result.data?.revokeOtherMyLoginSessions || 0} phiên khác.`);
    refetch();
  };

  const submitDeleteAccount = async () => {
    try {
      await deleteMyAccount({ variables: deleteForm });
      setDeleteOpen(false);
      logout?.();
    } catch (err) {
      alert(getCustomerActionErrorMessage(err, "Không thể xóa tài khoản."));
    }
  };

  return (
    <div className="security-settings fade-in">
      {/* 1. PASSWORD & 2FA */}
      <section className="settings-card">
        <div className="card-header">
          <h3>Đăng nhập & Bảo mật</h3>
          <p>Quản lý mật khẩu và các lớp bảo vệ tài khoản của bạn.</p>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <span className="label">Đổi mật khẩu</span>
            <span className="desc">
              Nên sử dụng mật khẩu mạnh và không trùng lặp.
            </span>
          </div>
          <button
            className="btn-outline"
            onClick={() => setChangePwdOpen(true)}
          >
            Cập nhật
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <span className="label">Xác thực 2 yếu tố (2FA)</span>
            <span className="desc">
              Tăng cường bảo mật bằng mã xác thực qua SMS/Email.
            </span>
          </div>
          <ToggleSwitch />
        </div>
      </section>

      {/* 2. ACTIVE SESSIONS (MỚI) */}
      <section className="settings-card">
        <div className="card-header">
          <h3>Thiết bị đăng nhập</h3>
          <p>Bạn đã đăng nhập trên các thiết bị sau.</p>
        </div>

        <button className="btn-outline session-revoke-other" onClick={handleRevokeOther} disabled={revokingOther}>
          {revokingOther ? "Đang xử lý..." : "Đăng xuất khỏi thiết bị khác"}
        </button>

        <div className="session-list">
          {sessionsLoading && <p className="session-empty">Đang tải phiên đăng nhập...</p>}
          {!sessionsLoading && sessions.length === 0 && <p className="session-empty">Chưa có phiên đăng nhập nào.</p>}
          {sessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className="session-icon">{deviceIcon(session.userAgent)}</div>
              <div className="session-details">
                <div className="session-name">
                  {deviceName(session.userAgent)}
                  {session.isCurrent && <span className="badge-active">Phiên hiện tại</span>}
                  <span className={session.isActive ? "badge-active" : "badge-revoked"}>
                    {session.isActive ? "Đang hoạt động" : "Đã thu hồi"}
                  </span>
                </div>
                <div className="session-meta">
                  IP: {session.ip || "Không rõ"} • Đăng nhập: {formatDate(session.createdAt)}
                  {session.revokedAt ? ` • Thu hồi: ${formatDate(session.revokedAt)}` : ""}
                </div>
              </div>
              {!session.isCurrent && session.isActive && (
                <button
                  className="btn-text-danger"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revokingSession}
                >
                  Đăng xuất
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. CONNECTED ACCOUNTS */}
      <section className="settings-card">
        <div className="card-header">
          <h3>Liên kết tài khoản</h3>
          <p>Đăng nhập nhanh bằng tài khoản mạng xã hội.</p>
        </div>
        <div className="social-list">
          <div className="social-item">
            <div className="social-left">
              <div className="social-logo google">G</div>
              <span>Google</span>
            </div>
            <button className="btn-text">Hủy liên kết</button>
          </div>
          <div className="social-item">
            <div className="social-left">
              <div className="social-logo facebook">f</div>
              <span>Facebook</span>
            </div>
            <button className="btn-link">Kết nối</button>
          </div>
        </div>
      </section>

      {/* 4. DANGER ZONE */}
      <section className="settings-card danger-zone">
        <div className="card-header">
          <h3 className="text-danger">Khu vực nguy hiểm</h3>
        </div>
        <div className="setting-row no-border">
          <div className="setting-info">
            <span className="label">Xóa tài khoản</span>
            <span className="desc">
              Hành động này không thể hoàn tác. Dữ liệu sẽ mất vĩnh viễn.
            </span>
          </div>
          <button className="btn-danger" onClick={() => setDeleteOpen(true)}>Xóa tài khoản</button>
        </div>
      </section>

      {/* MODAL */}
      <Modal
        isOpen={changePwdOpen}
        onClose={() => setChangePwdOpen(false)}
        title="Đổi Mật Khẩu"
      >
        <div className="pwd-form-content">
          <div className="form-field">
            <label>Mật khẩu hiện tại</label>
            <input
              type="password"
              value={pwdForm.current}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, current: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Mật khẩu mới</label>
            <input
              type="password"
              value={pwdForm.next}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, next: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={pwdForm.confirm}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, confirm: e.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button
              className="btn-cancel"
              onClick={() => setChangePwdOpen(false)}
            >
              Hủy
            </button>
            <button
              className="btn-confirm"
              onClick={submitPassword}
              disabled={loading}
            >
              {loading ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Xóa tài khoản"
      >
        <div className="pwd-form-content danger-confirm">
          <p>Tài khoản sẽ bị vô hiệu hóa và giữ trong thùng rác 30 ngày. Nhập <strong>XOA TAI KHOAN</strong> để xác nhận.</p>
          <div className="form-field">
            <label>Mật khẩu hiện tại</label>
            <input
              type="password"
              value={deleteForm.currentPassword}
              onChange={(e) => setDeleteForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Nhập XOA TAI KHOAN</label>
            <input
              value={deleteForm.confirmText}
              onChange={(e) => setDeleteForm((f) => ({ ...f, confirmText: e.target.value }))}
            />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setDeleteOpen(false)}>Hủy</button>
            <button className="btn-confirm btn-confirm-danger" onClick={submitDeleteAccount} disabled={deletingAccount}>
              {deletingAccount ? "Đang xử lý..." : "Xóa tài khoản"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SecuritySettings;
