// src/hooks/useSocketOrder.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
export const MENU_AVAILABILITY_SOCKET_EVENT = "menu-availability:socket-event";

function broadcastMenuAvailabilityEvent(evt, channel = "inventory") {
  if (typeof window === "undefined" || !evt?.type) return;
  window.dispatchEvent(
    new CustomEvent(MENU_AVAILABILITY_SOCKET_EVENT, {
      detail: {
        channel,
        event: evt,
      },
    }),
  );
}

/**
 * Hook kết nối socket.io để lắng nghe các sự kiện order + inventory realtime.
 * Handlers được lưu bằng ref để tránh stale closure khi state của component thay đổi.
 *
 * @param {string} restaurantId - ID của nhà hàng
 * @param {object} handlers - Các callback cho từng loại event
 */
export default function useSocketOrder(restaurantId, handlers = {}) {
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
      console.log(`[SOCKET.IO] Connected (${socket.id})`);
      socket.emit("joinRestaurant", restaurantId);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[SOCKET.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[SOCKET.IO] Connection error:", err.message);
    });

    socket.on("orderEvents", (evt) => {
      if (!evt?.type || !evt?.order) return;
      const h = getHandlers();
      console.log("📡 [SOCKET.IO] Order event received:", evt);

      h.onAny?.(evt);

      switch (evt.type) {
        case "ORDER_CREATED":
          h.onCreated?.(evt.order);
          break;
        case "ORDER_UPDATED":
          h.onUpdated?.(evt.order);
          break;
        case "ORDER_STATUS_CHANGED":
          h.onStatusChanged?.(evt.order);
          break;
        case "ORDER_CANCELLED":
          h.onCancelled?.(evt.order);
          break;
        case "CUSTOMER_PAYMENT_REQUESTED":
          h.onCustomerPaymentRequested?.(evt);
          break;
        case "CUSTOMER_STAFF_CALL_REQUESTED":
          h.onCustomerStaffCallRequested?.(evt);
          break;
        default:
          break;
      }
    });

    socket.on("inventoryEvents", (evt) => {
      if (!evt?.type) return;
      const h = getHandlers();
      console.log("📡 [SOCKET.IO] Inventory event received:", evt);
      broadcastMenuAvailabilityEvent(evt, "inventory");

      h.onInventoryEvent?.(evt);

      switch (evt.type) {
        case "MENU_ITEM_OUT_OF_STOCK":
          h.onMenuItemOutOfStock?.(evt);
          break;
        case "MENU_ITEM_AVAILABLE_AGAIN":
          h.onMenuItemAvailableAgain?.(evt);
          break;
        default:
          break;
      }
    });

    socket.on("menuAvailabilityNotifications", (evt) => {
      if (!evt?.type) return;
      const h = getHandlers();
      console.log("📡 [SOCKET.IO] Menu availability notification received:", evt);
      broadcastMenuAvailabilityEvent(evt, "notification");

      h.onMenuAvailabilityNotification?.(evt);
      if (evt.type === "MENU_ITEM_AVAILABLE_AGAIN") {
        h.onMenuItemAvailableAgain?.(evt);
      }
    });

    return () => {
      console.log("[SOCKET.IO] Disconnecting...");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId]);

  return socketRef.current;
}
