import React, { useEffect, useMemo, useState } from "react";
import AttendancePage from "./AttendancePage";

const normalizeRestaurantId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || value.restaurantId || "").trim();
  }
  return String(value).trim();
};

const isValidRestaurantId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));

const syncAttendanceRestaurantQuery = (restaurantId) => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search || "");
  const nextRestaurantId = isValidRestaurantId(restaurantId) ? restaurantId : "";
  const currentRestaurantId = params.get("restaurantId") || "";

  if (nextRestaurantId) {
    params.set("restaurantId", nextRestaurantId);
    params.set("staffPage", "attendance");
  } else {
    params.delete("restaurantId");
  }

  if (currentRestaurantId === (params.get("restaurantId") || "") && params.get("staffPage") === "attendance") {
    return;
  }

  const query = params.toString();
  window.history.replaceState(null, "", `/manager${query ? `?${query}` : ""}#staff`);
};

const AttendancePageScoped = ({ restaurantId, ...props }) => {
  const normalizedRestaurantId = useMemo(() => normalizeRestaurantId(restaurantId), [restaurantId]);
  const [readyKey, setReadyKey] = useState("");
  const targetKey = normalizedRestaurantId || "attendance-unscoped";

  useEffect(() => {
    syncAttendanceRestaurantQuery(normalizedRestaurantId);
    setReadyKey(targetKey);
  }, [normalizedRestaurantId, targetKey]);

  if (readyKey !== targetKey) return null;

  return <AttendancePage key={targetKey} {...props} />;
};

export default AttendancePageScoped;
