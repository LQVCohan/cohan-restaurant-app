import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import {
  DASHBOARD_RESTAURANT_CHANGED_EVENT,
  readDashboardRestaurantId,
} from "@/utils/staffSyncEvents";
import Dashboard from "./Dashboard";
import DashboardStaffRoster from "./components/DashboardStaffRoster";
import "./DashboardSynchronized.scss";

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const DashboardSynchronized = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const fallbackRestaurantId = useMemo(
    () =>
      (Array.isArray(restaurants) ? restaurants : [])
        .map(getRestaurantId)
        .find(Boolean) || "",
    [restaurants],
  );
  const [restaurantId, setRestaurantId] = useState(
    () => readDashboardRestaurantId() || fallbackRestaurantId,
  );

  useEffect(() => {
    if (!restaurantId && fallbackRestaurantId) {
      setRestaurantId(fallbackRestaurantId);
    }
  }, [fallbackRestaurantId, restaurantId]);

  useEffect(() => {
    const handleRestaurantChanged = (event) => {
      const nextRestaurantId = String(event?.detail?.restaurantId || "");
      setRestaurantId(nextRestaurantId || fallbackRestaurantId);
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
  }, [fallbackRestaurantId]);

  const openStaffPage = () => {
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: {
          page: "staff",
          source: "dashboard-staff-roster",
        },
      }),
    );
    if (window.location.hash !== "#staff") {
      window.location.hash = "staff";
    }
  };

  return (
    <div className="dashboard-synchronized-shell">
      <Dashboard />
      <section
        className="dashboard-synchronized-staff"
        aria-label="Nhân sự đồng bộ từ trang quản lý nhân viên"
      >
        <div className="manager-dashboard manager-dashboard--staff-sync">
          <DashboardStaffRoster
            restaurantId={restaurantId}
            onOpenStaff={openStaffPage}
          />
        </div>
      </section>
    </div>
  );
};

export default DashboardSynchronized;
