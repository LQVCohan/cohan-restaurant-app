// src/hooks/useSocketDeliveryTracking.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getBackendRootUrl } from "@/lib/apiBaseUrl";

/**
 * Hook lắng nghe tracking giao hàng cho 1 đơn cụ thể (phía khách / tracking page).
 *
 * @param {string} orderCode - mã đơn hàng để join room `order_${orderCode}`
 * @param {object} handlers - callback cho từng loại event
 * @param {function} handlers.onDriverAssigned
 * @param {function} handlers.onStatusUpdated
 * @param {function} handlers.onLocationUpdated
 * @param {function} handlers.onETAUpdated
 * @param {function} handlers.onAny - callback chung cho mọi event
 */
export default function useSocketDeliveryTracking(orderCode, handlers = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!orderCode) return;

    const socketOrigin = getBackendRootUrl() || window.location.origin;
    const socket = io(socketOrigin, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinOrder", orderCode);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[SOCKET.IO][TRACKING] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[SOCKET.IO][TRACKING] Connection error:", err.message);
    });

    // Nhận event realtime từ BE
    socket.on("orderCustomerEvents", (evt) => {
      if (!evt?.type) return;

      handlers.onAny?.(evt);

      switch (evt.type) {
        case "DELIVERY_DRIVER_ASSIGNED":
          handlers.onDriverAssigned?.(evt);
          break;
        case "DELIVERY_STATUS_UPDATED":
          handlers.onStatusUpdated?.(evt);
          break;
        case "DRIVER_LOCATION_UPDATED":
          handlers.onLocationUpdated?.(evt);
          break;
        case "DELIVERY_ETA_UPDATED":
          handlers.onETAUpdated?.(evt);
          break;
        default:
          break;
      }
    });

    return () => {
      socket.emit("leaveOrder", orderCode);
      socket.disconnect();
    };
  }, [orderCode]);

  return socketRef.current;
}
