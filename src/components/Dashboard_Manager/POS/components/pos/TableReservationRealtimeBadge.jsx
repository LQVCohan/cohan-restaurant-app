import React from "react";
import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { RESERVATION_EVENT_TYPES } from "@/hooks/useSocketReservation";
import cls from "./LeftPanel.module.scss";

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
  if (!activity) return null;

  const meta = getBadgeMeta(activity.type);
  const Icon = meta.icon;
  const timeLabel = formatTime(activity.timeTo);

  return (
    <div className={`${cls.reservationBadgeRow} ${cls[`reservationBadgeRow_${meta.tone}`] || ""}`}>
      <Icon size={13} />
      <span>{meta.label}</span>
      {activity.partySize ? <em>{activity.partySize} khách</em> : null}
      {timeLabel ? <em>{timeLabel}</em> : null}
    </div>
  );
}
