import React, { useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useCustomerNotifications } from "@/context/CustomerNotificationContext";
import NotificationBell from "@/components/common/NotificationBell";

const REVIEW_NOTIFICATION_TYPES = new Set([
  "review.published",
  "review.rejected",
  "review.official_reply.created",
]);

const getNotificationRestaurantId = (notification) => {
  const source = notification?.raw || notification;
  return source?.payload?.restaurantId || source?.restaurantId || null;
};

export default function CustomerNotificationBell() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const notificationState = useCustomerNotifications();
  const enabled = Boolean(isAuthenticated || user?.id || user?._id);

  const handleOpenNotification = useCallback(
    (notification) => {
      if (notification?.link) {
        navigate(notification.link);
        return;
      }

      const source = notification?.raw || notification;
      const restaurantId = getNotificationRestaurantId(notification);
      if (restaurantId && REVIEW_NOTIFICATION_TYPES.has(source?.type)) {
        navigate(`/restaurant/${restaurantId}#reviews`, {
          state: {
            openTab: "reviews",
            reviewId: source?.payload?.reviewId || null,
          },
        });
      }
    },
    [navigate],
  );

  if (!enabled) return null;

  return (
    <NotificationBell
      title="Thông báo của tôi"
      enabled={enabled}
      notificationState={notificationState}
      onOpenNotification={handleOpenNotification}
    />
  );
}
