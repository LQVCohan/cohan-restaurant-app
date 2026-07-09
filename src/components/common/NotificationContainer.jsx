import React from "react";
import { useNotification } from "../../hooks/useNotification";
import "./NotificationContainer.scss";

const NotificationContainer = () => {
  const { notifications, removeNotification, triggerNotificationAction } =
    useNotification();

  return (
    <div className="app-notifications">
      {notifications.map((n) => {
        const isError = n.type === "error";

        return (
          <div
            key={n.id}
            className={`app-toast app-toast--${n.type}`}
            onClick={() => removeNotification(n.id)}
            role={isError ? "alert" : "status"}
            aria-live={isError ? "assertive" : "polite"}
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
        );
      })}
    </div>
  );
};

export default NotificationContainer;
