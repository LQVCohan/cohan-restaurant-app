import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    image: "https://cdn-icons-png.flaticon.com/512/7541/7541900.png",
    text: "Đơn hàng #DH001 của bạn đã được giao thành công. Chúc bạn ngon miệng!",
    time: "5 phút trước",
    isRead: false,
    type: "order",
  },
  {
    id: 2,
    image: "https://cdn-icons-png.flaticon.com/512/879/879757.png",
    text: "Mã giảm giá 'SALE50' sắp hết hạn vào ngày mai. Sử dụng ngay!",
    time: "1 giờ trước",
    isRead: false,
    type: "promotion",
  },
  {
    id: 3,
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046857.png",
    text: "Nhà hàng Pizza Company vừa thêm món mới. Khám phá ngay!",
    time: "2 giờ trước",
    isRead: true,
    type: "system",
  },
  {
    id: 4,
    image: "https://cdn-icons-png.flaticon.com/512/7541/7541900.png",
    text: "Đơn hàng #DH002 đang được chuẩn bị.",
    time: "1 ngày trước",
    isRead: true,
    type: "order",
  },
];

const CustomerNotificationContext = createContext(null);

export const CustomerNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif,
      ),
    );
  }, []);

  const deleteNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification],
  );

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
};

export const useCustomerNotifications = () => {
  const context = useContext(CustomerNotificationContext);

  if (!context) {
    throw new Error(
      "useCustomerNotifications must be used within CustomerNotificationProvider",
    );
  }

  return context;
};
