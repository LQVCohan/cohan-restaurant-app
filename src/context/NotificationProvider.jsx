import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const NotificationContext = createContext({
  notifications: [],
  showNotification: () => {},
  removeNotification: () => {},
  clearAll: () => {},
});

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timeoutRefs = useRef({});

  // Show a notification with message, type and optional duration
  const showNotification = useCallback(
    (message, type = "info", duration = 4000) => {
      if (!message) return;
      const id = Date.now() + Math.random();
      const n = { id, message, type };

      setNotifications((prev) => [...prev, n]);

      const t = setTimeout(() => {
        setNotifications((prev) => prev.filter((x) => x.id !== id));
        delete timeoutRefs.current[id];
      }, duration);
      timeoutRefs.current[id] = t;
    },
    []
  );

  // Remove a specific notification by its ID
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};
    setNotifications([]);
  }, []);

  // Cleanup timeouts when the component unmounts
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {};
    };
  }, []);

  // Memoize the context value
  const value = useMemo(
    () => ({ notifications, showNotification, removeNotification, clearAll }),
    [notifications, showNotification, removeNotification, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
