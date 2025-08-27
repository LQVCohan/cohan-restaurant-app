import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.scss";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle modal open/close with proper timing
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready for transition
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for transition to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 800); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = (event) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  // Don't render if not needed
  if (!shouldRender) return null;

  // Create portal to render modal outside component tree
  return createPortal(
    <div
      className={`modal-overlay ${isVisible ? "modal-overlay--open" : ""}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className={`modal modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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

        {/* Modal Content */}
        <div className="modal__content">{children}</div>
      </div>
    </div>,
    document.body // Render to body
  );
};

// Modal Footer Component (optional)
export const ModalFooter = ({ children, className = "" }) => (
  <div className={`modal__footer ${className}`}>{children}</div>
);

// Usage Example Component
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
