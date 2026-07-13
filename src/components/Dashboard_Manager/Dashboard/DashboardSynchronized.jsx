import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import {
  DASHBOARD_RESTAURANT_CHANGED_EVENT,
  readDashboardRestaurantId,
} from "@/utils/staffSyncEvents";
import Dashboard from "./Dashboard";
import DashboardStaffRoster from "./components/DashboardStaffRoster";
import "./DashboardSynchronized.scss";
import "./DashboardEmptyState.scss";
import "./DashboardStockWording.scss";
import "./DashboardLabelReset.scss";
import "./DashboardPromotionTheme.scss";
import "./DashboardLayoutRepair.scss";

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const DashboardSynchronized = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const accessibleRestaurantIds = useMemo(
    () =>
      new Set(
        (Array.isArray(restaurants) ? restaurants : [])
          .map(getRestaurantId)
          .filter(Boolean),
      ),
    [restaurants],
  );
  const fallbackRestaurantId = useMemo(
    () => accessibleRestaurantIds.values().next().value || "",
    [accessibleRestaurantIds],
  );
  const resolveAccessibleRestaurantId = useCallback(
    (candidateRestaurantId) => {
      const normalizedRestaurantId = String(candidateRestaurantId || "");
      return normalizedRestaurantId &&
        accessibleRestaurantIds.has(normalizedRestaurantId)
        ? normalizedRestaurantId
        : fallbackRestaurantId;
    },
    [accessibleRestaurantIds, fallbackRestaurantId],
  );
  const [restaurantId, setRestaurantId] = useState(() => readDashboardRestaurantId());
  const activeRestaurantId = resolveAccessibleRestaurantId(restaurantId);

  useEffect(() => {
    const nextRestaurantId = resolveAccessibleRestaurantId(
      restaurantId || readDashboardRestaurantId(),
    );
    if (nextRestaurantId !== restaurantId) {
      setRestaurantId(nextRestaurantId);
    }
  }, [resolveAccessibleRestaurantId, restaurantId]);

  useEffect(() => {
    const handleRestaurantChanged = (event) => {
      setRestaurantId(resolveAccessibleRestaurantId(event?.detail?.restaurantId));
    };

    window.addEventListener(
      DASHBOARD_RESTAURANT_CHANGED_EVENT,
      handleRestaurantChanged,
    );
    return () =>
      window.removeEventListener(
        DASHBOARD_RESTAURANT_CHANGED_EVENT,
        handleRestaurantChanged,
      );
  }, [resolveAccessibleRestaurantId]);

  const openStaffPage = () => {
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page: "staff", source: "dashboard-staff-roster" },
      }),
    );
    if (window.location.hash !== "#staff") {
      window.location.hash = "staff";
    }
  };

  return (
    <div className="dashboard-synchronized-shell">
      <Dashboard
        staffRoster={
          activeRestaurantId ? (
            <DashboardStaffRoster
              restaurantId={activeRestaurantId}
              onOpenStaff={openStaffPage}
            />
          ) : null
        }
      />
    </div>
  );
};

export default DashboardSynchronized;
