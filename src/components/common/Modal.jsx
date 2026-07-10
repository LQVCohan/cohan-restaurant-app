import React, { useEffect, useRef, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.scss";

let activeModalCount = 0;
let savedScrollY = 0;
let savedBodyStyle = null;
let savedHtmlStyle = null;

const STRUCTURED_MODAL_CHILD_NAMES = new Set(["ModalHeader", "ModalBody", "ModalFooter"]);

const getModalChildDisplayName = (child) => {
  if (!React.isValidElement(child)) return "";
  const childType = child.type;
  return childType?.displayName || childType?.name || "";
};

const isStructuredModalChild = (child) =>
  STRUCTURED_MODAL_CHILD_NAMES.has(getModalChildDisplayName(child));

const hasStructuredModalChildren = (children) =>
  React.Children.toArray(children).some(isStructuredModalChild);

const hasStructuredModalHeader = (children) =>
  React.Children.toArray(children).some(
    (child) => getModalChildDisplayName(child) === "ModalHeader"
  );

const isJsdomRuntime = () =>
  typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "");

const getScrollbarWidth = () => {
  if (isJsdomRuntime()) return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
};

const lockPageScroll = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (activeModalCount === 0) {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    savedBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    savedHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };

    const scrollbarWidth = getScrollbarWidth();
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  activeModalCount += 1;
};

const restoreWindowScroll = (y) => {
  if (typeof window === "undefined") return;
  if (typeof window.scrollTo !== "function") return;
  if (isJsdomRuntime()) return;

  try {
    window.scrollTo(0, y);
  } catch {
    // Runtime browsers restore normally; non-browser test doubles may not support scrollTo.
  }
};

const unlockPageScroll = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount > 0) return;

  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");

  if (savedBodyStyle) {
    document.body.style.position = savedBodyStyle.position;
    document.body.style.top = savedBodyStyle.top;
    document.body.style.left = savedBodyStyle.left;
    document.body.style.right = savedBodyStyle.right;
    document.body.style.width = savedBodyStyle.width;
    document.body.style.overflow = savedBodyStyle.overflow;
    document.body.style.paddingRight = savedBodyStyle.paddingRight;
  }

  if (savedHtmlStyle) {
    document.documentElement.style.overflow = savedHtmlStyle.overflow;
    document.documentElement.style.overscrollBehavior = savedHtmlStyle.overscrollBehavior;
  }

  const restoreY = savedScrollY;
  savedBodyStyle = null;
  savedHtmlStyle = null;
  savedScrollY = 0;
  restoreWindowScroll(restoreY);
};

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

const Modal = ({
  isOpen,
  onClose,
  title = null,
  size = "md",
  position = "center",
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  onBeforeClose,
  className = "",
  zIndex = 1000,
  autoWrapBody = true,
  showCloseButton = true,
}) => {
  const shouldRender = useDelayUnmount(isOpen, 260);
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
  const shouldAutoWrapBody = autoWrapBody && !hasStructuredModalChildren(children);
  const usesStructuredHeader = hasStructuredModalHeader(children);
  const shouldRenderDefaultHeader =
    !usesStructuredHeader && Boolean(title || (onClose && showCloseButton));

  useEffect(() => {
    if (!isOpen) return undefined;

    previousActiveElementRef.current = document.activeElement;
    lockPageScroll();

    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      unlockPageScroll();
      if (previousActiveElementRef.current?.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && closeOnEscape && e.key === "Escape") {
        e.stopPropagation();
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

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, requestClose]);

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

  const modalContent = (
    <div
      className={`modal-overlay ${isOpen ? "modal-open" : "modal-closing"}`}
      onMouseDown={handleOverlayClick}
      ref={overlayRef}
      style={{ zIndex }}
      role="presentation"
    >
      <div
        className={`modal modal-container modal--${size} modal--${position} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={modalRef}
        tabIndex={-1}
      >
        {shouldRenderDefaultHeader && (
          <header className="modal-header">
            {title ? <h2 id={titleId}>{title}</h2> : <span />}
            {onClose && showCloseButton && (
              <button
                type="button"
                className="modal-close"
                onClick={requestClose}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            )}
          </header>
        )}
        {shouldAutoWrapBody ? <div className="modal-body">{children}</div> : children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

Modal.Header = function ModalHeader({ children, className = "", onClose }) {
  return (
    <header className={`modal-header ${className}`}>
      {children}
      {onClose && (
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>
      )}
    </header>
  );
};
Modal.Header.displayName = "ModalHeader";

Modal.Body = function ModalBody({ children, className = "" }) {
  return <div className={`modal-body ${className}`}>{children}</div>;
};
Modal.Body.displayName = "ModalBody";

Modal.Footer = function ModalFooter({ children, className = "" }) {
  return <footer className={`modal-footer ${className}`}>{children}</footer>;
};
Modal.Footer.displayName = "ModalFooter";

export default Modal;
