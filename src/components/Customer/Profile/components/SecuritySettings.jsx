// src/components/Customer/Profile/components/SecuritySettings.jsx
import React, { useContext, useState } from "react";
import { useMutation, useQuery, gql } from "@apollo/client";
import Modal from "../../../common/Modal";
import ToggleSwitch from "../../../common/ToggleSwitch/ToggleSwitch";
import { getCustomerActionErrorMessage } from "@/utils/customerFlowErrorMessages";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import { isCustomerRole } from "@/utils/frontendRoleAccess";
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

const DELETE_CONFIRMATIONS = new Set(["XOA TAI KHOAN", "XÓA TÀI KHOẢN"]);
const EMPTY_DELETE_FORM = { currentPassword: "", confirmText: "" };

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
  const [deleteForm, setDeleteForm] = useState(EMPTY_DELETE_FORM);
  const { user, logout } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);
  const { data, loading: sessionsLoading, refetch } = useQuery(MY_LOGIN_SESSIONS, { variables: { limit: 20 } });
  const [revokeOther, { loading: revokingOther }] = useMutation(REVOKE_OTHER_SESSIONS);
  const [revokeSession, { loading: revokingSession }] = useMutation(REVOKE_SESSION);
  const [deleteMyAccount, { loading: deletingAccount }] = useMutation(DELETE_MY_ACCOUNT);
  const sessions = data?.myLoginSessions || [];
  const canDeleteAccount = isCustomerRole(user);
  const deleteConfirmationValid = DELETE_CONFIRMATIONS.has(
    deleteForm.confirmText.trim().toUpperCase(),
  );

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeleteForm(EMPTY_DELETE_FORM);
  };

  const submitPassword = async () => {
    if (pwdForm.next !== pwdForm.confirm) {
      showNotification("Mật khẩu xác nhận không khớp.", "warning");
      return;
    }
    try {
      await changePassword({
        variables: { oldPassword: pwdForm.current, newPassword: pwdForm.next },
      });
      showNotification("Đổi mật khẩu thành công.", "success");
      setChangePwdOpen(false);
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      showNotification(
        getCustomerActionErrorMessage(
          err,
          err?.message || "Không thể đổi mật khẩu.",
        ),
        "error",
      );
    }
  };

  const handleRevokeSession = async (id) => {
    try {
      await revokeSession({ variables: { id } });
      showNotification("Đã đăng xuất lần đăng nhập đã chọn.", "success");
      refetch();
    } catch (err) {
      showNotification(getCustomerActionErrorMessage(err, "Không thể đăng xuất lần đăng nhập đã chọn."), "error");
    }
  };

  const handleRevokeOther = async () => {
    try {
      const result = await revokeOther();
      showNotification(`Đã đăng xuất ${result.data?.revokeOtherMyLoginSessions || 0} thiết bị khác.`, "success");
      refetch();
    } catch (err) {
      showNotification(getCustomerActionErrorMessage(err, "Không thể đăng xuất các thiết bị khác."), "error");
    }
  };

  const submitDeleteAccount = async () => {
    if (!canDeleteAccount || !deleteConfirmationValid) {
      showNotification("Hãy nhập đúng XOA TAI KHOAN để xác nhận.", "warning");
      return;
    }

    try {
      await deleteMyAccount({ variables: deleteForm });
      closeDeleteModal();
      logout?.();
    } catch (err) {
      showNotification(getCustomerActionErrorMessage(err, "Không thể xóa tài khoản."), "error");
    }
  };

  return (
    <div className="security-settings fade-in">
      <section className="settings-card">
        <div className="card-header">
          <h3>Đăng nhập & bảo mật</h3>
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
            type="button"
            className="btn-outline"
            onClick={() => setChangePwdOpen(true)}
          >
            Cập nhật
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <span className="label">Xác thực hai lớp</span>
            <span className="desc">
              Tăng cường bảo mật bằng mã xác thực qua SMS hoặc email.
            </span>
          </div>
          <ToggleSwitch />
        </div>
      </section>

      <section className="settings-card">
        <div className="card-header">
          <h3>Thiết bị đăng nhập</h3>
          <p>Bạn đã đăng nhập trên các thiết bị sau.</p>
        </div>

        <button type="button" className="btn-outline session-revoke-other" onClick={handleRevokeOther} disabled={revokingOther}>
          {revokingOther ? "Đang xử lý..." : "Đăng xuất khỏi thiết bị khác"}
        </button>

        <div className="session-list">
          {sessionsLoading && <p className="session-empty">Đang tải lịch sử đăng nhập...</p>}
          {!sessionsLoading && sessions.length === 0 && <p className="session-empty">Chưa có lần đăng nhập nào.</p>}
          {sessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className="session-icon" aria-hidden="true">{deviceIcon(session.userAgent)}</div>
              <div className="session-details">
                <div className="session-name">
                  {deviceName(session.userAgent)}
                  {session.isCurrent && <span className="badge-active">Thiết bị hiện tại</span>}
                  <span className={session.isActive ? "badge-active" : "badge-revoked"}>
                    {session.isActive ? "Đang hoạt động" : "Đã đăng xuất"}
                  </span>
                </div>
                <div className="session-meta">
                  Truy cập: {session.ip || "Không rõ"} • Đăng nhập: {formatDate(session.createdAt)}
                  {session.revokedAt ? ` • Đăng xuất: ${formatDate(session.revokedAt)}` : ""}
                </div>
              </div>
              {!session.isCurrent && session.isActive && (
                <button
                  type="button"
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

      <section className="settings-card">
        <div className="card-header">
          <h3>Liên kết tài khoản</h3>
          <p>Đăng nhập nhanh bằng tài khoản mạng xã hội.</p>
        </div>
        <div className="social-list">
          <div className="social-item">
            <div className="social-left">
              <div className="social-logo google" aria-hidden="true">G</div>
              <span>Google</span>
            </div>
            <button type="button" className="btn-text">Hủy liên kết</button>
          </div>
          <div className="social-item">
            <div className="social-left">
              <div className="social-logo facebook" aria-hidden="true">f</div>
              <span>Facebook</span>
            </div>
            <button type="button" className="btn-link">Kết nối</button>
          </div>
        </div>
      </section>

      {canDeleteAccount ? (
        <section className="settings-card danger-zone">
          <div className="card-header">
            <h3 className="text-danger">Khu vực nguy hiểm</h3>
          </div>
          <div className="setting-row no-border">
            <div className="setting-info">
              <span className="label">Xóa tài khoản</span>
              <span className="desc">
                Tài khoản sẽ bị vô hiệu hóa trong 30 ngày và mọi lần đăng nhập sẽ bị đăng xuất.
              </span>
            </div>
            <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>Xóa tài khoản</button>
          </div>
        </section>
      ) : null}

      <Modal
        isOpen={changePwdOpen}
        onClose={() => setChangePwdOpen(false)}
        title="Đổi mật khẩu"
      >
        <div className="pwd-form-content">
          <div className="form-field">
            <label htmlFor="profile-current-password">Mật khẩu hiện tại</label>
            <input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={pwdForm.current}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, current: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor="profile-new-password">Mật khẩu mới</label>
            <input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={pwdForm.next}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, next: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor="profile-confirm-password">Xác nhận mật khẩu mới</label>
            <input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={pwdForm.confirm}
              onChange={(e) =>
                setPwdForm((f) => ({ ...f, confirm: e.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setChangePwdOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn-confirm"
              onClick={submitPassword}
              disabled={loading}
            >
              {loading ? "Đang lưu..." : "Lưu mật khẩu"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        title="Xóa tài khoản"
      >
        <div className="pwd-form-content">
          <p>
            Nhập <strong>XOA TAI KHOAN</strong> để xác nhận. Tài khoản sẽ bị vô hiệu hóa trong 30 ngày trước khi xóa vĩnh viễn.
          </p>
          <div className="form-field">
            <label htmlFor="delete-current-password">Mật khẩu hiện tại</label>
            <input
              id="delete-current-password"
              type="password"
              autoComplete="current-password"
              value={deleteForm.currentPassword}
              onChange={(e) => setDeleteForm((form) => ({ ...form, currentPassword: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="delete-confirm-text">Nội dung xác nhận</label>
            <input
              id="delete-confirm-text"
              value={deleteForm.confirmText}
              onChange={(e) => setDeleteForm((form) => ({ ...form, confirmText: e.target.value }))}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={closeDeleteModal}>Hủy</button>
            <button
              type="button"
              className="btn-danger"
              onClick={submitDeleteAccount}
              disabled={!deleteConfirmationValid || deletingAccount}
            >
              {deletingAccount ? "Đang xử lý..." : "Xóa tài khoản"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SecuritySettings;