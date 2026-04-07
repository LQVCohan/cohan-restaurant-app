"use client";

import React from "react";
import "./Dialog.scss";

const Dialog = ({
  open,
  onOpenChange,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const contentRef = React.useRef(null);
  const previousActiveElementRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    previousActiveElementRef.current = document.activeElement;
    const timer = setTimeout(() => contentRef.current?.focus(), 30);
    const handleKeyDown = (e) => {
      if (closeOnEscape && e.key === "Escape") {
        onOpenChange(false);
      }
      if (e.key === "Tab" && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll(
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      previousActiveElementRef.current?.focus?.();
    };
  }, [open, closeOnEscape, onOpenChange]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={contentRef}
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

const DialogTrigger = ({ children, ...props }) => {
  return React.cloneElement(children, props);
};

const DialogContent = ({ className = "", children, ...props }) => {
  return (
    <div className={`dialog-inner ${className}`} {...props}>
      {children}
    </div>
  );
};

const DialogHeader = ({ children, className = "" }) => {
  return <div className={`dialog-header ${className}`}>{children}</div>;
};

export { Dialog, DialogTrigger, DialogContent, DialogHeader };
