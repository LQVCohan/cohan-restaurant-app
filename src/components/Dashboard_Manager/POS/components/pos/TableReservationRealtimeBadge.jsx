import React from "react";
import { gql, useQuery } from "@apollo/client";
import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { RESERVATION_EVENT_TYPES } from "@/hooks/useSocketReservation";
import { usePos } from "@/context/PosContext";
import cls from "./LeftPanel.module.scss";

const ACTIVE_RESERVATION_BADGE = gql`
  query PosTableReservationDepositBadge($restaurantId: ID!, $tableId: ID!) {
    activeReservationByTable(restaurantId: $restaurantId, tableId: $tableId) {
      id
      timeTo
      partySize
      depositAmount
      depositStatus
      depositAppliedAmount
      depositAppliedAt
      tableDepositAmount
      menuDepositAmount
    }
  }
`;

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatVnd(value) {
  return `${Math.max(0, Number(value || 0)).toLocaleString("vi-VN")}đ`;
}

function getBadgeMeta(type) {
  switch (type) {
    case RESERVATION_EVENT_TYPES.CREATED:
      return { tone: "info", label: "Đặt bàn mới", icon: CalendarClock };
    case RESERVATION_EVENT_TYPES.CONFIRMED:
      return { tone: "success", label: "Đã xác nhận", icon: CheckCircle2 };
    case RESERVATION_EVENT_TYPES.CHANGE_REQUESTED:
      return { tone: "warning", label: "Chờ duyệt đổi", icon: Clock3 };
    case RESERVATION_EVENT_TYPES.CHANGE_APPROVED:
      return { tone: "success", label: "Đã xác nhận", icon: CheckCircle2 };
    case RESERVATION_EVENT_TYPES.CHANGE_REJECTED:
      return { tone: "danger", label: "Từ chối đổi", icon: XCircle };
    case RESERVATION_EVENT_TYPES.CHECKED_IN:
      return { tone: "success", label: "Đã nhận bàn", icon: CheckCircle2 };
    case RESERVATION_EVENT_TYPES.CANCELLED:
      return { tone: "danger", label: "Đã hủy", icon: XCircle };
    case RESERVATION_EVENT_TYPES.PAYMENT_EXPIRED:
      return { tone: "warning", label: "Hết hạn giữ", icon: Clock3 };
    default:
      return { tone: "info", label: "Có đặt bàn", icon: CalendarClock };
  }
}

export default function TableReservationRealtimeBadge({ activity }) {
  const pos = usePos?.() || null;
  const tableId = String(activity?.tableId || "");
  const restaurantId = String(
    activity?.restaurantId || pos?.restaurantId || "",
  );
  const { data } = useQuery(ACTIVE_RESERVATION_BADGE, {
    variables: { restaurantId, tableId },
    skip: !activity || !restaurantId || !tableId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  if (!activity) return null;

  const reservation = data?.activeReservationByTable || activity;
  const meta = getBadgeMeta(activity.type);
  const Icon = meta.icon;
  const timeLabel = formatTime(reservation.timeTo || activity.timeTo);
  const partySize = reservation.partySize || activity.partySize;
  const depositRemaining = Math.max(
    0,
    Number(reservation.depositAmount || activity.depositAmount || 0) -
      Number(reservation.depositAppliedAmount || 0),
  );
  const hasPaidDeposit =
    String(reservation.depositStatus || activity.depositStatus || "").toLowerCase() ===
      "paid" && depositRemaining > 0;

  return (
    <div className={`${cls.reservationBadgeRow} ${cls[`reservationBadgeRow_${meta.tone}`] || ""}`}>
      <Icon size={13} />
      <span>{meta.label}</span>
      {partySize ? <em>{partySize} khách</em> : null}
      {timeLabel ? <em>{timeLabel}</em> : null}
      {hasPaidDeposit ? <em>Đã cọc {formatVnd(depositRemaining)}</em> : null}
    </div>
  );
}
