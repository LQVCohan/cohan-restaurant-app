import React from "react";
import { useNotification } from "../../hooks/useNotification";
import "./NotificationContainer.scss";

const NotificationContainer = () => {
  const { notifications, removeNotification, triggerNotificationAction } =
    useNotification();

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
          <div className="app-toast__message">{n.message}</div>
          {n.actionLabel ? (
            <button
              type="button"
              className="app-toast__action"
              onClick={(e) => {
                e.stopPropagation();
                triggerNotificationAction(n.id);
              }}
            >
              {n.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
