import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export const RESERVATION_SOCKET_EVENT = "reservation:socket-event";

export const RESERVATION_EVENT_TYPES = Object.freeze({
  CREATED: "RESERVATION_CREATED",
  CONFIRMED: "RESERVATION_CONFIRMED",
  CANCELLED: "RESERVATION_CANCELLED",
  PAYMENT_EXPIRED: "RESERVATION_PAYMENT_EXPIRED",
  PAYMENT_FAILED: "RESERVATION_PAYMENT_FAILED",
  CHANGE_REQUESTED: "RESERVATION_CHANGE_REQUESTED",
  CHANGE_APPROVED: "RESERVATION_CHANGE_APPROVED",
  CHANGE_REJECTED: "RESERVATION_CHANGE_REJECTED",
  CHECKED_IN: "RESERVATION_CHECKED_IN",
  STATUS_CHANGED: "RESERVATION_STATUS_CHANGED",
});

function broadcastReservationEvent(evt, channel = "restaurant") {
  if (typeof window === "undefined" || !evt?.type) return;
  window.dispatchEvent(
    new CustomEvent(RESERVATION_SOCKET_EVENT, {
      detail: {
        channel,
        event: evt,
      },
    }),
  );
}

export default function useSocketReservation(restaurantId, handlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers || {};
  }, [handlers]);

  useEffect(() => {
    if (!restaurantId) return undefined;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    const getHandlers = () => handlersRef.current || {};

    socket.on("connect", () => {
      socket.emit("joinRestaurant", restaurantId);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[SOCKET.IO] Reservation disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[SOCKET.IO] Reservation connection error:", err.message);
    });

    socket.on("reservationEvents", (evt) => {
      if (!evt?.type) return;
      const h = getHandlers();
      broadcastReservationEvent(evt, "restaurant");

      h.onAny?.(evt);
      h.onReservationEvent?.(evt);

      switch (evt.type) {
        case RESERVATION_EVENT_TYPES.CREATED:
          h.onCreated?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CONFIRMED:
          h.onConfirmed?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CANCELLED:
          h.onCancelled?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.PAYMENT_EXPIRED:
          h.onPaymentExpired?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.PAYMENT_FAILED:
          h.onPaymentFailed?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CHANGE_REQUESTED:
          h.onChangeRequested?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CHANGE_APPROVED:
          h.onChangeApproved?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CHANGE_REJECTED:
          h.onChangeRejected?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.CHECKED_IN:
          h.onCheckedIn?.(evt);
          break;
        case RESERVATION_EVENT_TYPES.STATUS_CHANGED:
          h.onStatusChanged?.(evt);
          break;
        default:
          break;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId]);

  return socketRef.current;
}
