import React, { createContext, useContext, useMemo, useCallback } from "react";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";

const CustomerNotificationContext = createContext(null);

const formatRelative = (iso) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const iconByType = {
  chat_message: "https://cdn-icons-png.flaticon.com/512/1046/1046857.png",
  order: "https://cdn-icons-png.flaticon.com/512/7541/7541900.png",
  reservation: "https://cdn-icons-png.flaticon.com/512/747/747310.png",
  payment: "https://cdn-icons-png.flaticon.com/512/2331/2331941.png",
  promotion: "https://cdn-icons-png.flaticon.com/512/879/879757.png",
  system: "https://cdn-icons-png.flaticon.com/512/1046/1046857.png",
};

const getNotificationLink = (notification) => {
  const payload = notification?.payload || {};
  if (payload.orderId) return `/track-delivery/${payload.orderId}`;
  if (payload.reservationId) return "/orders?tab=reservations";
  if (payload.couponId && payload.restaurantId) return `/coupons/${payload.restaurantId}`;
  if (payload.threadId) return `/help-center/me?threadId=${payload.threadId}`;
  return null;
};

export const CustomerNotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();
  const isCustomer = roleName === "customer";
  const restaurantId = isCustomer ? null : user?.refRestaurants?.[0] || null;
  const notificationsEnabled = Boolean(isAuthenticated && (user?.id || user?._id));

  const {
    notifications: rawNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refetchNotifications,
  } = useCommunication({ restaurantId, notificationsEnabled });

  const notifications = useMemo(
    () =>
      (rawNotifications || []).map((n) => ({
        id: n.id,
        image: iconByType[n.type] || iconByType.system,
        text: n.payload?.messagePreview || n.payload?.message || n.type,
        time: formatRelative(n.createdAt),
        isRead: !!n.readAt,
        type: n.type,
        threadId: n.payload?.threadId || null,
        link: getNotificationLink(n),
        raw: n,
      })),
    [rawNotifications],
  );

  const markAsRead = useCallback(
    async (id) => {
      await markNotificationRead({ variables: { id } });
      refetchNotifications?.();
    },
    [markNotificationRead, refetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsRead({ variables: { restaurantId } });
    refetchNotifications?.();
  }, [markAllNotificationsRead, refetchNotifications, restaurantId]);

  const deleteNotification = useCallback(async (id) => {
    await markNotificationRead({ variables: { id } });
    refetchNotifications?.();
  }, [markNotificationRead, refetchNotifications]);

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
