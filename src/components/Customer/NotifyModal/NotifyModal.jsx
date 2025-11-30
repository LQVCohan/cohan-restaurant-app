import React, { useState, useEffect } from "react";
import "./NotifyModal.scss";

const NotifyModal = ({ isOpen, onClose, table, user, onRegister }) => {
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Logic Auto-fill: Ưu tiên Email -> SĐT
  useEffect(() => {
    if (isOpen) {
      // ✅ Thay đổi thứ tự ưu tiên: Email trước
      const autoFill = user?.email || user?.phone || "";

      setContact(autoFill);
      setError("");
      setLoading(false);
    }
  }, [isOpen, user]);

  // Đóng khi nhấn ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !table) return null;

  const handleSubmit = () => {
    if (!contact.trim()) {
      setError("Vui lòng nhập thông tin liên hệ.");
      return;
    }
    setLoading(true);

    setTimeout(() => {
      onRegister(contact, table);
      setLoading(false);
    }, 800);
  };

  // Kiểm tra xem giá trị hiện tại có khớp với data user không để hiện icon
  const isAutoFilled =
    user &&
    (contact === user.email || contact === user.phone) &&
    contact !== "";

  return (
    <div className="ntf-backdrop" onClick={onClose}>
      <div className="ntf-container" onClick={(e) => e.stopPropagation()}>
        <button className="ntf-close-btn" onClick={onClose}>
          ✕
        </button>

        <div className="ntf-content">
          <div className="ntf-icon-wrapper">
            <span className="icon">🔔</span>
          </div>

          <div className="ntf-header">
            <h3 className="ntf-title">Bật thông báo bàn trống</h3>
            <p className="ntf-desc">
              Bàn <strong>{table.label}</strong> hiện đang có khách. Để lại
              thông tin, chúng tôi sẽ nhắn cho bạn ngay khi bàn này sẵn sàng.
            </p>
          </div>

          <div className="ntf-form-group">
            <label>Email hoặc Số điện thoại</label>

            {/* Wrapper để đặt icon ✨ bên trong */}
            <div className="ntf-input-wrapper">
              <input
                type="text"
                className={`ntf-input ${error ? "error" : ""}`}
                placeholder="VD: email@example.com..."
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  if (error) setError("");
                }}
                autoFocus
              />

              {/* ✅ Chỉ hiện icon ✨ */}
              {isAutoFilled && (
                <span
                  className="ntf-autofill-icon"
                  title="Đã tự động điền từ tài khoản của bạn"
                >
                  ✨
                </span>
              )}
            </div>

            {error && <span className="ntf-error-text">{error}</span>}
          </div>

          <button
            className="ntf-btn-submit"
            onClick={handleSubmit}
            disabled={loading || !contact}
          >
            {loading ? "Đang đăng ký..." : "Nhắc tôi khi có bàn"}
          </button>

          <button className="ntf-btn-cancel" onClick={onClose}>
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotifyModal;
