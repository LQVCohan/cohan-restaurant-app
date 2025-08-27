import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import "./Notification.scss";

const Notification = ({
  message,
  type = "success",
  onClose,
  autoClose = true,
  duration = 3000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onClose && onClose();
        }, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose && onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle size={20} />;
      case "error":
        return <AlertCircle size={20} />;
      default:
        return <CheckCircle size={20} />;
    }
  };

  return (
    <div
      className={`notification notification--${type} ${
        isVisible ? "notification--show" : ""
      }`}
    >
      <div className="notification__content">
        <div className="notification__icon">{getIcon()}</div>
        <div className="notification__message">{message}</div>
        {onClose && (
          <button className="notification__close" onClick={handleClose}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Notification;
