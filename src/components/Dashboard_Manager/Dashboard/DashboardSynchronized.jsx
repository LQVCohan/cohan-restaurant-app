import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const DashboardSynchronized = () => {
  const shellRef = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);
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
  const resolveAccessibleRestaurantId = (candidateRestaurantId) => {
    const normalizedRestaurantId = String(candidateRestaurantId || "");
    return normalizedRestaurantId && accessibleRestaurantIds.has(normalizedRestaurantId)
      ? normalizedRestaurantId
      : fallbackRestaurantId;
  };
  const [restaurantId, setRestaurantId] = useState(() => readDashboardRestaurantId());
  const activeRestaurantId = resolveAccessibleRestaurantId(restaurantId);

  useEffect(() => {
    const nextRestaurantId = resolveAccessibleRestaurantId(
      restaurantId || readDashboardRestaurantId(),
    );
    if (nextRestaurantId !== restaurantId) {
      setRestaurantId(nextRestaurantId);
    }
  }, [accessibleRestaurantIds, fallbackRestaurantId, restaurantId]);

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
  }, [accessibleRestaurantIds, fallbackRestaurantId]);

  useEffect(() => {
    setPortalTarget(null);
    if (!activeRestaurantId) return undefined;

    const shell = shellRef.current;
    const sideStack = shell?.querySelector(".dashboard-side-stack");
    if (!shell || !sideStack) return undefined;

    const mountNode = document.createElement("div");
    mountNode.className = "dashboard-staff-roster-portal-slot";
    const ensureMounted = () => {
      const currentSideStack = shell.querySelector(".dashboard-side-stack");
      if (currentSideStack && mountNode.parentNode !== currentSideStack) {
        currentSideStack.prepend(mountNode);
      }
    };

    ensureMounted();
    setPortalTarget(mountNode);
    const observer = new MutationObserver(ensureMounted);
    observer.observe(shell, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mountNode.remove();
      setPortalTarget(null);
    };
  }, [activeRestaurantId]);

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
    <div ref={shellRef} className="dashboard-synchronized-shell">
      <Dashboard />
      {portalTarget && activeRestaurantId
        ? createPortal(
            <DashboardStaffRoster
              restaurantId={activeRestaurantId}
              onOpenStaff={openStaffPage}
            />,
            portalTarget,
          )
        : null}
    </div>
  );
};

export default DashboardSynchronized;
