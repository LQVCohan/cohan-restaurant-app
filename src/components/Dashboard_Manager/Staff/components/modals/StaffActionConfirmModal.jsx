import React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import Modal from "../../../../common/Modal";
import "./StaffActionConfirmModal.scss";

const TONE = {
  danger: { icon: ShieldAlert, className: "danger" },
  warning: { icon: AlertTriangle, className: "warning" },
  success: { icon: CheckCircle2, className: "success" },
  info: { icon: Info, className: "info" },
};

const StaffActionConfirmModal = ({
  isOpen,
  title,
  message,
  description,
  tone = "info",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const meta = TONE[tone] || TONE.info;
  const Icon = meta.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onCancel?.()}
      size="sm"
      className={`staff-action-confirm staff-action-confirm--${meta.className}`}
      closeOnEscape={!isLoading}
      closeOnOverlayClick={!isLoading}
    >
      <Modal.Header onClose={() => !isLoading && onCancel?.()}>
        {title || "Xác nhận thao tác"}
      </Modal.Header>
      <Modal.Body>
        <div className="staff-action-confirm__hero">
          <span className="staff-action-confirm__icon"><Icon size={20} /></span>
          <div>
            <p className="staff-action-confirm__message">{message}</p>
            {description ? (
              <p className="staff-action-confirm__description">{description}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="staff-action-confirm__slot">{children}</div> : null}
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          className="staff-action-confirm__button staff-action-confirm__button--cancel"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className="staff-action-confirm__button staff-action-confirm__button--confirm"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? "Đang xử lý..." : confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default StaffActionConfirmModal;
