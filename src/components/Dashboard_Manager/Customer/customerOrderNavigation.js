export const navigateToManagerOrders = ({
  order = null,
  customer = null,
  restaurantId = "",
  viewAll = false,
} = {}) => {
  if (typeof window === "undefined") return false;
  const orderId =
    order?.id || order?._id || order?.raw?.id || order?.raw?._id || "";
  if (!viewAll && !orderId) return false;

  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: {
        page: "orders",
        query: {
          restaurantId: restaurantId || undefined,
          orderId: viewAll ? undefined : orderId,
          customerId: customer?.id || customer?._id || undefined,
          customerName:
            customer?.fullName ||
            customer?.name ||
            customer?.displayName ||
            undefined,
        },
        source: viewAll ? "customer-order-history" : "customer-recent-order",
      },
    }),
  );
  return true;
};
