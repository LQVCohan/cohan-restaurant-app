import React, { useEffect, useRef, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.scss";

// --- Custom Hook: Animation Delay ---
const useDelayUnmount = (isMounted, delayTime) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let timeoutId;
    if (isMounted && !shouldRender) {
      setShouldRender(true);
    } else if (!isMounted && shouldRender) {
      timeoutId = setTimeout(() => setShouldRender(false), delayTime);
    }
    return () => clearTimeout(timeoutId);
  }, [isMounted, delayTime, shouldRender]);

  return shouldRender;
};

// --- Main Component ---
const Modal = ({
  isOpen, // Ưu tiên dùng tên chuẩn boolean
  onClose,
  size = "md", // sm, md, lg, xl, full
  position = "center", // center, top
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  onBeforeClose,
  className = "",
  zIndex = 1000, // Hỗ trợ stack modals
}) => {
  const shouldRender = useDelayUnmount(isOpen, 300); // 300ms khớp với CSS transition
  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const titleId = useId();
  const requestClose = useCallback(() => {
    if (typeof onBeforeClose === "function") {
      const canClose = onBeforeClose();
      if (canClose === false) return;
    }
    onClose?.();
  }, [onBeforeClose, onClose]);

  // 1. Lock Body Scroll & Focus Trap
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = "hidden";

      // Focus vào modal khi mở
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 50);

      return () => {
        document.body.style.overflow = "unset";
        clearTimeout(timer);
        if (previousActiveElementRef.current?.focus) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // 2. Handle Key Press (Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && closeOnEscape && e.key === "Escape") {
        e.stopPropagation(); // Ngăn event bubbling nếu có modal cha
        requestClose();
      }

      if (isOpen && e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Chỉ add event listener khi modal đang mở
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, requestClose]);

  // 3. Handle Overlay Click (An toàn hơn mouseDown/Up)
  const handleOverlayClick = (e) => {
    if (
      closeOnOverlayClick &&
      overlayRef.current &&
      e.target === overlayRef.current
    ) {
      requestClose();
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={`modal-overlay ${isOpen ? "is-open" : ""} ${
        position === "top" ? "is-top" : ""
      }`}
      style={{ zIndex }}
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className={`modal-container size-${size} ${className}`}
        tabIndex="-1" // Cho phép div nhận focus programmatically
      >
        {/* Inject titleId context if needed, simple children rendering here */}
        {React.Children.map(children, (child) => {
          // Clone element để truyền props tự động nếu cần (như onClose cho Header)
          if (React.isValidElement(child) && child.type === ModalHeader) {
            return React.cloneElement(child, { onClose: requestClose, titleId });
          }
          return child;
        })}
      </div>
    </div>,
    document.body
  );
};

// --- Compound Components ---

const ModalHeader = ({ children, onClose, titleId, className = "" }) => {
  return (
    <div className={`modal-header ${className}`}>
      <h3 id={titleId}>{children}</h3>
      {onClose && (
        <button className="btn-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      )}
    </div>
  );
};

const ModalBody = ({ children, className = "", ...rest }) => {
  return (
    <div className={`modal-body ${className}`} {...rest}>
      {children}
    </div>
  );
};

const ModalFooter = ({ children, className = "", ...rest }) => {
  return (
    <div className={`modal-footer ${className}`} {...rest}>
      {children}
    </div>
  );
};

// --- Gắn các sub-components vào Modal chính ---
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
