import React, { useState } from "react";
import { CalendarClock } from "lucide-react";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import FutureOrdersModal from "./FutureOrdersModal";
import "./OrderFutureOrdersDock.scss";

export default function OrderFutureOrdersDock() {
  const { selectedRestaurantId } = useManagerRestaurantSelection();
  const [open, setOpen] = useState(false);

  const handleViewOrder = (orderId) => {
    if (!orderId || typeof window === "undefined") return;
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("manager:navigation-query", {
        detail: {
          page: "orders",
          query: {
            orderId,
            restaurantId: String(selectedRestaurantId || ""),
          },
        },
      }),
    );
  };

  return (
    <div className="order-future-orders-dock">
      <button
        type="button"
        className="order-future-orders-dock__button"
        onClick={() => setOpen(true)}
        disabled={!selectedRestaurantId}
        title="Xem các order đặt món cho thời điểm trong tương lai"
      >
        <CalendarClock size={18} aria-hidden="true" />
        <span>Order trước</span>
      </button>

      <FutureOrdersModal
        open={open}
        restaurantId={selectedRestaurantId}
        onClose={() => setOpen(false)}
        onViewOrder={handleViewOrder}
      />
    </div>
  );
}
