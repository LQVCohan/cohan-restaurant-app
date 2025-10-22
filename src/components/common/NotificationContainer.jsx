import React from "react";
import { useNotification } from "../../hooks/useNotification";
import "./NotificationContainer.scss";

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="app-notifications">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`app-toast app-toast--${n.type}`}
          onClick={() => removeNotification(n.id)}
          role="status"
          aria-live="polite"
        >
          {n.message}
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
