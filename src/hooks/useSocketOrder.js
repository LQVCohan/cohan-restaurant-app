// src/hooks/useSocketOrder.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

/**
 * Hook kết nối socket.io để lắng nghe các sự kiện order + inventory realtime.
 *
 * @param {string} restaurantId - ID của nhà hàng
 * @param {object} handlers - Các callback cho từng loại event
 * @param {function} handlers.onCreated - Khi đơn hàng mới được tạo
 * @param {function} handlers.onUpdated - Khi đơn hàng được cập nhật
 * @param {function} handlers.onStatusChanged - Khi thay đổi trạng thái
 * @param {function} handlers.onCancelled - Khi đơn hàng bị hủy
 * @param {function} handlers.onInventoryEvent - Khi tồn kho/menu availability thay đổi
 * @param {function} handlers.onMenuItemOutOfStock - Khi món hết khả dụng
 * @param {function} handlers.onMenuItemAvailableAgain - Khi món khả dụng lại
 * @param {function} handlers.onMenuAvailabilityNotification - Khi watcher được notify
 * @param {function} handlers.onAny - Callback chung cho mọi order event
 */
export default function useSocketOrder(restaurantId, handlers = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!restaurantId) return;

    // Kết nối socket
    const socket = io("http://localhost:4000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    // Khi connect xong, join vào room nhà hàng
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

    // Lắng nghe order event
    socket.on("orderEvents", (evt) => {
      if (!evt?.type || !evt?.order) return;
      console.log("📡 [SOCKET.IO] Order event received:", evt);

      // Callback tổng quát
      if (typeof handlers.onAny === "function") handlers.onAny(evt);

      // Tùy loại event
      switch (evt.type) {
        case "ORDER_CREATED":
          handlers.onCreated?.(evt.order);
          break;
        case "ORDER_UPDATED":
          handlers.onUpdated?.(evt.order);
          break;
        case "ORDER_STATUS_CHANGED":
          handlers.onStatusChanged?.(evt.order);
          break;
        case "ORDER_CANCELLED":
          handlers.onCancelled?.(evt.order);
          break;
        default:
          break;
      }
    });

    socket.on("inventoryEvents", (evt) => {
      if (!evt?.type) return;
      console.log("📡 [SOCKET.IO] Inventory event received:", evt);
      handlers.onInventoryEvent?.(evt);

      switch (evt.type) {
        case "MENU_ITEM_OUT_OF_STOCK":
          handlers.onMenuItemOutOfStock?.(evt);
          break;
        case "MENU_ITEM_AVAILABLE_AGAIN":
          handlers.onMenuItemAvailableAgain?.(evt);
          break;
        default:
          break;
      }
    });

    socket.on("menuAvailabilityNotifications", (evt) => {
      if (!evt?.type) return;
      console.log("📡 [SOCKET.IO] Menu availability notification received:", evt);
      handlers.onMenuAvailabilityNotification?.(evt);
      if (evt.type === "MENU_ITEM_AVAILABLE_AGAIN") {
        handlers.onMenuItemAvailableAgain?.(evt);
      }
    });

    return () => {
      console.log("[SOCKET.IO] Disconnecting...");
      socket.disconnect();
    };
  }, [restaurantId]);

  return socketRef.current;
}
