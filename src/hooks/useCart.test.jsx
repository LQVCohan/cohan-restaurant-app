import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildCartLineIdentity, buildModifiersKey, isHoldExpired, useCart } from "./useCart";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useCart", () => {
  it("builds stable cart line identities from dish, variant, note and modifiers", () => {
    const base = {
      id: "dish-1",
      restaurantId: "restaurant-1",
      servingVariantKey: "large",
      note: "ít cay",
      modifiers: [
        { groupId: "sauce", optionId: "bbq" },
        { groupId: "size", optionId: "large" },
      ],
    };
    const reordered = {
      ...base,
      modifiers: [...base.modifiers].reverse(),
    };

    expect(buildModifiersKey(base.modifiers)).toBe(buildModifiersKey(reordered.modifiers));
    expect(buildCartLineIdentity(base)).toBe(buildCartLineIdentity(reordered));
  });

  it("detects expired hold items", () => {
    expect(isHoldExpired({ holdExpiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(true);
    expect(isHoldExpired({ holdExpiresAt: new Date(Date.now() + 60000).toISOString() })).toBe(false);
    expect(isHoldExpired({})).toBe(false);
  });

  it("adds and merges equivalent cart lines", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({
        id: "dish-1",
        dishId: "dish-1",
        restaurantId: "restaurant-1",
        name: "Cơm gà",
        price: 50000,
        quantity: 1,
        servingVariantKey: "portion",
      });
      result.current.addToCart({
        id: "dish-1",
        dishId: "dish-1",
        restaurantId: "restaurant-1",
        name: "Cơm gà",
        price: 50000,
        quantity: 2,
        servingVariantKey: "portion",
      });
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
    expect(result.current.getTotalItems()).toBe(3);
    expect(result.current.getTotalPrice()).toBe(150000);
  });

  it("includes modifier prices in cart totals", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({
        id: "dish-1",
        restaurantId: "r1",
        name: "Phở",
        price: 60000,
        modifiersPrice: 15000,
        quantity: 2,
      });
    });

    expect(result.current.getTotalPrice()).toBe(150000);
  });

  it("keeps different notes as different cart lines", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: "dish-1", restaurantId: "r1", name: "Phở", price: 60000, note: "ít hành" });
      result.current.addToCart({ id: "dish-1", restaurantId: "r1", name: "Phở", price: 60000, note: "không hành" });
    });

    expect(result.current.cart).toHaveLength(2);
    expect(result.current.getTotalItems()).toBe(2);
  });

  it("syncs server cart lines and preserves backend ids", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.syncServerCart([
        {
          id: "dish-1",
          dishId: "dish-1",
          restaurantId: "restaurant-1",
          name: "Bún bò",
          price: 70000,
          quantity: 2,
          backendCartId: "cart-1",
          backendCartItemId: "cart-item-1",
        },
      ]);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].backendCartId).toBe("cart-1");
    expect(result.current.cart[0].backendCartItemId).toBe("cart-item-1");
  });

  it("uses server quantity and hold state when reconciling an existing line", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({
        id: "dish-1",
        dishId: "dish-1",
        restaurantId: "restaurant-1",
        name: "Bún bò",
        price: 70000,
        quantity: 3,
        holdExpiresAt: new Date(Date.now() + 300000).toISOString(),
        holdStatus: "active",
      });
      result.current.syncServerCart([
        {
          id: "dish-1",
          dishId: "dish-1",
          restaurantId: "restaurant-1",
          name: "Bún bò",
          price: 70000,
          quantity: 1,
          backendCartId: "cart-1",
          backendCartItemId: "cart-item-1",
          holdExpiresAt: null,
          holdStatus: "active",
        },
      ]);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(1);
    expect(result.current.cart[0].backendCartItemId).toBe("cart-item-1");
    expect(result.current.cart[0].holdExpiresAt).toBeNull();
  });

  it("updates, removes and clears cart lines", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: "dish-1", restaurantId: "r1", name: "Mì", price: 40000 });
    });

    const line = result.current.cart[0];
    act(() => result.current.updateQuantity(line, 2));
    expect(result.current.cart[0].quantity).toBe(3);

    act(() => result.current.removeFromCart(result.current.cart[0]));
    expect(result.current.cart).toHaveLength(0);

    act(() => {
      result.current.addToCart({ id: "dish-2", restaurantId: "r1", name: "Cơm", price: 45000 });
      result.current.clearCart();
    });
    expect(result.current.cart).toHaveLength(0);
  });
});
