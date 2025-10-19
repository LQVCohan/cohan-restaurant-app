import React from "react";
import "./ConfirmationModal.scss";

const ConfirmationModal = ({ visible, title, message, onConfirm, onClose }) => {
  if (!visible) return null;

  return (
    <div className="confirmation-modal">
      <div className="confirmation-modal__content">
        <button className="confirmation-modal__close" onClick={onClose}>
          ✕
        </button>
        <div className="confirmation-modal__icon">✅</div>
        <h3 className="confirmation-modal__title">{title}</h3>
        <p className="confirmation-modal__message">{message}</p>
        <div className="confirmation-modal__actions">
          <button
            className="confirmation-modal__button confirmation-modal__button--confirm"
            onClick={onConfirm}
          >
            Đồng ý
          </button>
          <button
            className="confirmation-modal__button confirmation-modal__button--cancel"
            onClick={onClose}
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
