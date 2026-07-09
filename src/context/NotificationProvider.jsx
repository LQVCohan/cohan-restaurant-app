import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotificationContext } from "./NotificationContext";

const ALERT_FALLBACK_MESSAGE = "Có thông báo mới từ hệ thống.";

const toAlertMessage = (message) => {
  if (message == null) return ALERT_FALLBACK_MESSAGE;
  if (message instanceof Error) return message.message || ALERT_FALLBACK_MESSAGE;
  return String(message) || ALERT_FALLBACK_MESSAGE;
};

/**
 * UI-only toast/local notification provider.
 *
 * This provider intentionally stores short-lived interface feedback in React state.
 * It is not the persistent DB notification workflow used by NotificationBell.
 */
const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timeoutRefs = useRef({});

  const showNotification = useCallback(
    (message, type = "info", duration = 4000) => {
      if (!message) return;
      const id = Date.now() + Math.random();
      const normalized =
        typeof message === "object"
          ? message
          : { message, actionLabel: null, onAction: null };
      const n = {
        id,
        message: normalized.message,
        type,
        actionLabel: normalized.actionLabel || null,
        onAction:
          typeof normalized.onAction === "function" ? normalized.onAction : null,
      };
      setNotifications((prev) => [...prev, n]);

      const t = setTimeout(() => {
        setNotifications((prev) => prev.filter((x) => x.id !== id));
        delete timeoutRefs.current[id];
      }, duration);
      timeoutRefs.current[id] = t;
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const nativeAlert = window.alert;
    const notifyAlert = (message) => {
      showNotification(toAlertMessage(message), "error");
    };

    window.alert = notifyAlert;

    return () => {
      if (window.alert === notifyAlert) {
        window.alert = nativeAlert;
      }
    };
  }, [showNotification]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const clearAll = useCallback(() => {
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};
    setNotifications([]);
  }, []);

  const triggerNotificationAction = useCallback((id) => {
    let action = null;
    setNotifications((prev) => {
      const row = prev.find((x) => x.id === id);
      action = row?.onAction || null;
      return prev.filter((x) => x.id !== id);
    });
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
    if (typeof action === "function") action();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {};
    };
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      showNotification,
      removeNotification,
      clearAll,
      triggerNotificationAction,
    }),
    [
      notifications,
      showNotification,
      removeNotification,
      clearAll,
      triggerNotificationAction,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
