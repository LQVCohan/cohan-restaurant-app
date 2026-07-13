import { describe, expect, it, vi } from "vitest";
import { navigateToManagerOrders } from "./customerOrderNavigation";

describe("CustomerModal order navigation", () => {
  it("sends the selected order and customer context to the manager order page", () => {
    const listener = vi.fn();
    window.addEventListener("manager:navigate", listener);

    expect(
      navigateToManagerOrders({
        order: { id: "order-42", orderCode: "ORD-42" },
        customer: { id: "customer-7", fullName: "Nguyễn An" },
        restaurantId: "restaurant-1",
      }),
    ).toBe(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({
      page: "orders",
      query: {
        restaurantId: "restaurant-1",
        orderId: "order-42",
        customerId: "customer-7",
        customerName: "Nguyễn An",
      },
      source: "customer-recent-order",
    });
    window.removeEventListener("manager:navigate", listener);
  });
});
