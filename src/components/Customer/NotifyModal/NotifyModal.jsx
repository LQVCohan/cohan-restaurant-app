import React, { useEffect, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { useParams } from "react-router-dom";
import "./NotifyModal.scss";

const REGISTER_TABLE_AVAILABILITY_WATCH = gql`
  mutation RegisterTableAvailabilityWatch($input: RegisterTableAvailabilityWatchInput!) {
    registerTableAvailabilityWatch(input: $input) {
      alreadyAvailable
      message
      watch {
        id
        status
        contactEmail
        expiresAt
      }
    }
  }
`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMutationMessage(error) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    "Không thể đăng ký thông báo bàn trống."
  );
}

const NotifyModal = ({ isOpen, onClose, table, user, onRegister }) => {
  const { id: restaurantId } = useParams();
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [registerWatch, { loading }] = useMutation(REGISTER_TABLE_AVAILABILITY_WATCH);

  useEffect(() => {
    if (isOpen) {
      setContact(user?.email || "");
      setError("");
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape" && isOpen && !loading) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !table) return null;

  const handleSubmit = async () => {
    const email = contact.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setError("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (!restaurantId || !table.id) {
      setError("Thiếu thông tin nhà hàng hoặc bàn. Vui lòng tải lại trang.");
      return;
    }

    setError("");
    try {
      const { data } = await registerWatch({
        variables: {
          input: {
            restaurantId,
            tableId: table.id,
            contactEmail: email,
          },
        },
      });
      const payload = data?.registerTableAvailabilityWatch;
      if (!payload) throw new Error("Máy chủ không trả về kết quả đăng ký.");
      onRegister(email, table, payload);
    } catch (mutationError) {
      setError(getMutationMessage(mutationError));
    }
  };

  const isAutoFilled = Boolean(user?.email && contact === user.email);

  return (
    <div className="ntf-backdrop" onClick={loading ? undefined : onClose}>
      <div className="ntf-container" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="ntf-close-btn"
          onClick={onClose}
          disabled={loading}
          aria-label="Đóng đăng ký thông báo bàn trống"
        >
          ✕
        </button>

        <div className="ntf-content">
          <div className="ntf-icon-wrapper">
            <span className="icon" aria-hidden="true">🔔</span>
          </div>

          <div className="ntf-header">
            <h3 className="ntf-title">Báo tôi khi bàn trống</h3>
            <p className="ntf-desc">
              Bàn <strong>{table.label}</strong> chưa sẵn sàng. Cohan sẽ gửi email
              khi bàn này chuyển về trạng thái trống. Thông báo không tự giữ bàn.
            </p>
          </div>

          <div className="ntf-form-group">
            <label htmlFor="table-watch-email">Email nhận thông báo</label>
            <div className="ntf-input-wrapper">
              <input
                id="table-watch-email"
                type="email"
                className={`ntf-input ${error ? "error" : ""}`}
                placeholder="email@example.com"
                value={contact}
                onChange={(event) => {
                  setContact(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
              {isAutoFilled && (
                <span
                  className="ntf-autofill-icon"
                  title="Đã tự động điền từ tài khoản của bạn"
                >
                  ✨
                </span>
              )}
            </div>
            {error && <span className="ntf-error-text" role="alert">{error}</span>}
          </div>

          <button
            type="button"
            className="ntf-btn-submit"
            onClick={handleSubmit}
            disabled={loading || !contact.trim()}
          >
            {loading ? "Đang đăng ký..." : "Gửi email khi bàn trống"}
          </button>

          <button
            type="button"
            className="ntf-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotifyModal;
