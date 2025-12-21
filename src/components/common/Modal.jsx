import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.scss";

const Modal = ({
  isOpen,
  open,
  onClose,
  title,
  children,
  footer,
  size = "md", // sm, md, lg, xl, full
  position = "center", // center, top
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = "",
  bodyClassName = "",
}) => {
  // Support cả 2 prop isOpen và open
  const visibleProp = typeof isOpen !== "undefined" ? isOpen : open;

  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const mouseDownTarget = useRef(null);

  // 1. Lifecycle & Animation Control
  useEffect(() => {
    if (visibleProp) {
      previousFocusRef.current = document.activeElement;
      setIsRendered(true);
      // Double requestAnimationFrame để đảm bảo animation chạy mượt
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      // Đợi animation chạy xong mới unmount (300ms khớp với SCSS)
      const timer = setTimeout(() => {
        setIsRendered(false);
        previousFocusRef.current?.focus();
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [visibleProp]);

  // 2. Handle Escape Key & Focus Trap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!visibleProp) return;

      if (e.key === "Escape" && closeOnEscape) {
        onClose?.();
      }

      // Logic Focus Trap (Giữ tab bên trong modal)
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleProp, closeOnEscape, onClose]);

  // 3. Smart Overlay Click (Tránh đóng nhầm khi bôi đen text)
  const handleMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleMouseUp = (e) => {
    if (
      closeOnOverlayClick &&
      mouseDownTarget.current === e.currentTarget &&
      e.target === e.currentTarget
    ) {
      onClose?.();
    }
  };

  if (!isRendered) return null;

  return createPortal(
    <div
      // 🔥 Dùng class chuẩn BEM: modal-overlay--open
      className={`modal-overlay ${isVisible ? "modal-overlay--open" : ""} ${
        position === "top" ? "modal-overlay--top" : ""
      }`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        // 🔥 Dùng class chuẩn BEM: modal modal--md, modal--lg...
        className={`modal modal--${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && (
              <h3 id="modal-title" className="modal__title">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                className="modal__close"
                onClick={onClose}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* CONTENT (BODY) */}
        <div className={`modal__content ${bodyClassName}`}>{children}</div>

        {/* FOOTER */}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

// --- Export ModalFooter với class chuẩn cũ ---
export const ModalFooter = ({ children, className = "" }) => (
  <div className={`modal__footer ${className}`}>{children}</div>
);

export default Modal;
