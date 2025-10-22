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

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {};
    };
  }, []);

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
