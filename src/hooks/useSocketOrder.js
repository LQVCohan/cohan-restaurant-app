// src/hooks/useSocketOrder.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "@/lib/authStorage";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
export const MENU_AVAILABILITY_SOCKET_EVENT = "menu-availability:socket-event";
export const TABLE_CUSTOMER_SOCKET_EVENT = "table-customer:socket-event";

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

function broadcastTableCustomerEvent(evt) {
  if (typeof window === "undefined" || !evt?.type) return;
  window.dispatchEvent(
    new CustomEvent(TABLE_CUSTOMER_SOCKET_EVENT, {
      detail: { event: evt },
    }),
  );
}

function isUnverifiedTransferOrder(order) {
  const payment = order?.payment || {};
  const method = String(payment.method || payment.provider || "").toLowerCase();
  const status = String(payment.status || "").toLowerCase();
  const isTransfer = ["transfer", "bank_transfer"].includes(method);
  return isTransfer && status !== "paid";
}

/**
 * Hook kết nối socket.io để lắng nghe các sự kiện order + inventory realtime.
 * Socket sử dụng đúng access token hiện hành từ authStorage, cùng nguồn với Apollo client.
 * Handlers được lưu bằng ref để tránh stale closure khi state của component thay đổi.
 *
 * @param {string} restaurantId - ID của nhà hàng
 * @param {object} handlers - Các callback cho từng loại event
 * @param {object} options
 * @param {string|null} options.token - access token từ AuthContext; fallback sang getToken() khi không truyền.
 */
export default function useSocketOrder(restaurantId, handlers = {}, options = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  const authToken = options?.token || null;

  useEffect(() => {
    handlersRef.current = handlers || {};
  }, [handlers]);

  useEffect(() => {
    if (!restaurantId) return undefined;

    const token = authToken || getToken();
    if (!token) {
      console.warn("[SOCKET.IO] Skip restaurant realtime: missing access token.");
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    const getHandlers = () => handlersRef.current || {};

    socket.on("connect", () => {
      socket.emit("joinRestaurant", restaurantId, (ack) => {
        if (!ack?.ok) {
          console.warn("[SOCKET.IO] joinRestaurant failed:", ack?.code || "UNKNOWN");
        }
      });
    });

    socket.on("disconnect", (reason) => {
      console.warn("[SOCKET.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[SOCKET.IO] Connection error:", err.message);
    });

    socket.on("orderEvents", (evt) => {
      if (!evt?.type) return;
      if (evt.type === "ORDER_CREATED" && isUnverifiedTransferOrder(evt.order)) {
        return;
      }
      const h = getHandlers();

      h.onAny?.(evt);

      switch (evt.type) {
        case "TABLE_CUSTOMER_UPDATED":
          broadcastTableCustomerEvent(evt);
          h.onTableCustomerUpdated?.(evt);
          break;
        case "TABLE_CUSTOMER_REQUEST_CREATED":
          (h.onTableCustomerRequestCreated || h.onCustomerStaffCallRequested)?.(evt);
          break;
        case "TABLE_PAYMENT_REQUESTED":
          (h.onTablePaymentRequested || h.onCustomerPaymentRequested)?.(evt);
          break;
        case "ORDER_CREATED":
          h.onCreated?.(evt.order);
          break;
        case "PAYMENT_VERIFIED":
          h.onCreated?.(evt.order);
          h.onUpdated?.(evt.order);
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
      broadcastMenuAvailabilityEvent(evt, "notification");

      h.onMenuAvailabilityNotification?.(evt);
      if (evt.type === "MENU_ITEM_AVAILABLE_AGAIN") {
        h.onMenuItemAvailableAgain?.(evt);
      }
    });

    return () => {
      socket.emit("leaveRestaurant", restaurantId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId, authToken]);

  return socketRef.current;
}
