import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.scss";

const Modal = ({
  // Support both `isOpen` (internal) và `open` (dùng chỗ khác)
  isOpen,
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "", // 👈 thêm prop className để style riêng từng modal
}) => {
  const visibleProp = typeof isOpen !== "undefined" ? isOpen : open;
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visibleProp) {
      setShouldRender(true);
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 800); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [visibleProp]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && visibleProp) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visibleProp, onClose, closeOnEscape]);

  useEffect(() => {
    if (visibleProp) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [visibleProp]);

  const handleOverlayClick = (event) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose?.();
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`modal-overlay ${isVisible ? "modal-overlay--open" : ""}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className={`modal modal--${size} ${className}`.trim()} // 👈 gắn className thêm
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && (
              <h2 id="modal-title" className="modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="modal__close"
                onClick={onClose}
                aria-label="Đóng modal"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        )}

        <div className="modal__content">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body // Render to body
  );
};

export const ModalFooter = ({ children, className = "" }) => (
  <div className={`modal__footer ${className}`}>{children}</div>
);

export const ModalExample = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)} className="btn btn--primary">
        🎭 Mở Modal
      </button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="🎉 Modal với Transition"
        size="md"
      >
        <p>Đây là nội dung modal với hiệu ứng slide down mượt mà!</p>
        <p>Transition hoạt động với:</p>
        <ul>
          <li>⏱️ Duration: 0.8s</li>
          <li>🎯 Timing: cubic-bezier bounce</li>
          <li>📱 Responsive design</li>
        </ul>

        <ModalFooter>
          <button
            onClick={() => setIsModalOpen(false)}
            className="btn btn--secondary"
          >
            Hủy
          </button>
          <button
            onClick={() => setIsModalOpen(false)}
            className="btn btn--primary"
          >
            Xác nhận
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Modal;
