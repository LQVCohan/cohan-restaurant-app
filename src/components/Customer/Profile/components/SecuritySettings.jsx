// src/components/Customer/Profile/components/SecuritySettings.jsx
import React, { useState } from "react";
import { useMutation, gql } from "@apollo/client";
import Modal from "../../../common/Modal"; // Đảm bảo đường dẫn đúng
import ToggleSwitch from "../../../common/ToggleSwitch/ToggleSwitch";
import "./SecuritySettings.scss";

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
  }
`;

const SecuritySettings = () => {
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);

  // Mock Data: Sessions
  const [sessions, setSessions] = useState([
    {
      id: 1,
      name: "Chrome trên Windows",
      location: "TP. Hồ Chí Minh",
      active: true,
      time: "Đang hoạt động",
      type: "desktop",
    },
    {
      id: 2,
      name: "iPhone 14 Pro Max",
      location: "Hà Nội",
      active: false,
      time: "Hoạt động 5 giờ trước",
      type: "mobile",
    },
  ]);

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
      alert("Lỗi: " + err.message);
    }
  };

  const handleRevokeSession = (id) => {
    setSessions(sessions.filter((s) => s.id !== id));
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

        <div className="session-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className={`session-icon ${session.type}`}>
                {session.type === "desktop" ? "💻" : "📱"}
              </div>
              <div className="session-details">
                <div className="session-name">
                  {session.name}
                  {session.active && (
                    <span className="badge-active">Thiết bị này</span>
                  )}
                </div>
                <div className="session-meta">
                  {session.location} • {session.time}
                </div>
              </div>
              {!session.active && (
                <button
                  className="btn-text-danger"
                  onClick={() => handleRevokeSession(session.id)}
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
          <button className="btn-danger">Xóa tài khoản</button>
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
    </div>
  );
};

export default SecuritySettings;
