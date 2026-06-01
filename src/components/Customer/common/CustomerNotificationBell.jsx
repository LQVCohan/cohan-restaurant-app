import React, { useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import NotificationBell from "@/components/common/NotificationBell";

const getNotificationRestaurantId = (notification) =>
  notification?.payload?.restaurantId || notification?.restaurantId || null;

export default function CustomerNotificationBell() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const enabled = Boolean(isAuthenticated || user?.id || user?._id);

  const handleOpenNotification = useCallback(
    (notification) => {
      const restaurantId = getNotificationRestaurantId(notification);
      if (restaurantId && ["review.published", "review.rejected", "review.official_reply.created"].includes(notification?.type)) {
        navigate(`/restaurant/${restaurantId}#reviews`, { state: { openTab: "reviews", reviewId: notification?.payload?.reviewId || null } });
      }
    },
    [navigate],
  );

  if (!enabled) return null;

  return (
    <NotificationBell
      title="Thông báo của tôi"
      enabled={enabled}
      onOpenNotification={handleOpenNotification}
    />
  );
}
