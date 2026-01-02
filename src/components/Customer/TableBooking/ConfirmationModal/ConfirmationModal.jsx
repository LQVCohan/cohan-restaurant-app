import React from "react";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import "./ConfirmationModal.scss";

const ConfirmationModal = ({
  visible,
  title,
  message,
  onConfirm,
  onClose,
  type = "success", // 'success' | 'danger' | 'info'
}) => {
  if (!visible) return null;

  // Chọn icon dựa trên loại modal
  const renderIcon = () => {
    switch (type) {
      case "danger":
        return <AlertTriangle size={48} className="modal-icon-svg danger" />;
      case "info":
        return <Info size={48} className="modal-icon-svg info" />;
      default:
        return <CheckCircle size={48} className="modal-icon-svg success" />;
    }
  };

  return (
    <div className="confirmation-modal-overlay">
      <div className={`confirmation-modal__content ${type}`}>
        <button className="confirmation-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="confirmation-modal__header">
          <div className="icon-wrapper">{renderIcon()}</div>
          <h3 className="confirmation-modal__title">{title}</h3>
        </div>

        <p className="confirmation-modal__message">{message}</p>

        <div className="confirmation-modal__actions">
          <button className="btn-modal btn-cancel" onClick={onClose}>
            Hủy bỏ
          </button>
          <button
            className={`btn-modal btn-confirm ${type}`}
            onClick={onConfirm}
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
