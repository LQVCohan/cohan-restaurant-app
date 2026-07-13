import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./TableReservationTimingOverlay.scss";

const STORAGE_KEY = "manager.selectedRestaurantId";
const SCOPE_EVENT = "manager:scope-selection";

const TABLE_RESERVATION_TIMING = gql`
  query TableReservationTimingOverlay($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      id
      code
      status
      nextReservationAt
      reservationGraceEndsAt
      reservationPhase
      reservationOrderCode
      reservationCustomerName
      reservationCustomerPhone
      reservationCustomerEmail
      reservationPartySize
    }
  }
`;

const timeLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const countdownLabel = (value, now) => {
  const end = value ? new Date(value).getTime() : 0;
  const remaining = Math.max(0, end - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const buildNotice = (table, now) => {
  const customer = table.reservationCustomerName || "Khách đặt bàn";
  const party = table.reservationPartySize
    ? `${table.reservationPartySize} khách`
    : "Chưa rõ số khách";
  const contact = table.reservationCustomerPhone || table.reservationCustomerEmail || "";
  const at = timeLabel(table.nextReservationAt);

  if (table.reservationPhase === "waiting") {
    return {
      tone: "waiting",
      title: `Đang chờ khách · còn ${countdownLabel(table.reservationGraceEndsAt, now)}`,
      detail: `${at} · ${customer} · ${party}${contact ? ` · ${contact}` : ""}`,
    };
  }
  if (table.reservationPhase === "expired") {
    return {
      tone: "expired",
      title: "Đã quá 15 phút chờ khách",
      detail: `${at} · ${customer} · ${party}${contact ? ` · ${contact}` : ""}`,
    };
  }
  return {
    tone: "upcoming",
    title: `Có khách đặt lúc ${at}`,
    detail: `${customer} · ${party}${contact ? ` · ${contact}` : ""}`,
  };
};

export default function TableReservationTimingOverlay() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const fallbackRestaurantId = useMemo(
    () => getRestaurantId(restaurants[0]),
    [restaurants],
  );
  const [restaurantId, setRestaurantId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(STORAGE_KEY) || "",
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!restaurantId && fallbackRestaurantId) {
      setRestaurantId(fallbackRestaurantId);
    }
  }, [fallbackRestaurantId, restaurantId]);

  useEffect(() => {
    const handleScope = (event) => {
      if (event?.detail?.key !== STORAGE_KEY) return;
      setRestaurantId(String(event.detail.value || fallbackRestaurantId || ""));
    };
    window.addEventListener(SCOPE_EVENT, handleScope);
    return () => window.removeEventListener(SCOPE_EVENT, handleScope);
  }, [fallbackRestaurantId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data } = useQuery(TABLE_RESERVATION_TIMING, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval: 15000,
  });

  const tables = useMemo(
    () => (data?.tables || []).filter((table) => table.nextReservationAt),
    [data?.tables],
  );

  useEffect(() => {
    const root = document.querySelector(".tm-settings-page");
    if (!root) return undefined;
    root.querySelectorAll(".tm-reservation-notice").forEach((node) => node.remove());

    const byCode = new Map(
      tables.map((table) => [String(table.code || "").trim().toLowerCase(), table]),
    );
    root.querySelectorAll(".tm-table-card:not(.tm-table-card--skeleton)").forEach((card) => {
      const code = card.querySelector(".table-no")?.textContent?.trim().toLowerCase();
      const table = byCode.get(code);
      if (!table) return;
      const notice = buildNotice(table, now);
      const node = document.createElement("div");
      node.className = `tm-reservation-notice tm-reservation-notice--${notice.tone}`;
      node.setAttribute("role", "status");
      const title = document.createElement("strong");
      title.textContent = notice.title;
      const detail = document.createElement("span");
      detail.textContent = notice.detail;
      node.append(title, detail);
      const actions = card.querySelector(".card-actions");
      if (actions) card.insertBefore(node, actions);
      else card.append(node);
    });

    return () => {
      root.querySelectorAll(".tm-reservation-notice").forEach((node) => node.remove());
    };
  }, [now, tables]);

  return null;
}
