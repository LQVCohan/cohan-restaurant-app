import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncServerCart: vi.fn(),
  addToCart: vi.fn(),
  refetch: vi.fn(),
  client: { query: vi.fn() },
  data: {
    myCart: {
      id: "cart-1",
      items: [
        {
          id: "cart-item-1",
          restaurantId: "restaurant-1",
          itemType: "MENU_ITEM",
          menuItemId: "dish-1",
          name: "Phở",
          price: 60000,
          quantity: 1,
          modifiers: [],
        },
      ],
    },
  },
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApolloClient: () => mocks.client,
    useQuery: () => ({
      data: mocks.data,
      refetch: mocks.refetch,
      loading: false,
    }),
  };
});

import { ServerCartBridge } from "./CartProvider";

describe("ServerCartBridge", () => {
  it("does not resync when only the cart state wrapper object changes", async () => {
    const makeCartState = () => ({
      cart: [],
      syncServerCart: mocks.syncServerCart,
      addToCart: mocks.addToCart,
    });

    const { rerender } = render(
      <ServerCartBridge cartState={makeCartState()}>
        <div>Giỏ hàng</div>
      </ServerCartBridge>,
    );

    await waitFor(() => expect(mocks.syncServerCart).toHaveBeenCalledTimes(1));

    rerender(
      <ServerCartBridge cartState={makeCartState()}>
        <div>Giỏ hàng</div>
      </ServerCartBridge>,
    );

    expect(mocks.syncServerCart).toHaveBeenCalledTimes(1);
    expect(mocks.syncServerCart).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "dish-1",
          backendCartId: "cart-1",
          backendCartItemId: "cart-item-1",
        }),
      ],
      { replace: false },
    );
  });
});
