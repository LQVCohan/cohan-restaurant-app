"use client";

import React from "react";
import "./Dialog.scss";

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const DialogTrigger = ({ asChild, children, ...props }) => {
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
