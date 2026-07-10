import { afterEach, describe, expect, it } from "vitest";
import { buildCartLineIdentity } from "./useCart";
import {
  formatHoldCountdown,
  hasExpiredHoldItems,
} from "@/components/Customer/Homepage_Client/components/Cart";

describe("buildCartLineIdentity", () => {
  it("tách dòng khi khác note", () => {
    const base = { id: "m1", restaurantId: "r1", servingVariantKey: "size-l", modifiers: [] };
    expect(buildCartLineIdentity({ ...base, note: "ít cay" })).not.toBe(
      buildCartLineIdentity({ ...base, note: "không hành" }),
    );
  });

  it("tách dòng khi khác thời điểm phục vụ", () => {
    const base = { id: "m1", restaurantId: "r1", servingVariantKey: "size-l", modifiers: [] };
    expect(buildCartLineIdentity({ ...base, serviceAt: "2026-07-11T01:00:00.000Z" })).not.toBe(
      buildCartLineIdentity({ ...base, serviceAt: "2026-07-11T11:00:00.000Z" }),
    );
  });

  it("tách dòng khi khác modifiers", () => {
    const base = { id: "m1", restaurantId: "r1", servingVariantKey: "size-l", note: "" };
    expect(
      buildCartLineIdentity({ ...base, modifiers: [{ groupId: "g1", optionId: "o1" }] }),
    ).not.toBe(
      buildCartLineIdentity({ ...base, modifiers: [{ groupId: "g1", optionId: "o2" }] }),
    );
  });
});

describe("cart hold helpers", () => {
  it("formatHoldCountdown định dạng mm:ss", () => {
    expect(formatHoldCountdown(272000)).toBe("04:32");
    expect(formatHoldCountdown(45000)).toBe("00:45");
  });

  it("hasExpiredHoldItems phát hiện hold hết hạn", () => {
    const now = new Date("2026-05-27T10:00:00.000Z").getTime();
    const cart = [
      { holdExpiresAt: "2026-05-27T10:00:40.000Z", holdStatus: "active" },
      { holdExpiresAt: "2026-05-27T09:58:00.000Z", holdStatus: "active" },
    ];
    expect(hasExpiredHoldItems(cart, now)).toBe(true);
  });

  it("không expired khi holdStatus active và còn thời gian", () => {
    const now = new Date("2026-05-27T10:00:00.000Z").getTime();
    const cart = [
      { holdExpiresAt: "2026-05-27T10:03:00.000Z", holdStatus: "active" },
    ];
    expect(hasExpiredHoldItems(cart, now)).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";
import { useCart, isHoldExpired } from "./useCart";

afterEach(() => {
  window.sessionStorage.clear();
});

describe("useCart operations", () => {
  it("adds items, merges identical variant/modifier/note lines, and totals cart", () => {
    const { result } = renderHook(() => useCart());
    const item = {
      id: "dish-1",
      restaurantId: "restaurant-1",
      servingVariantKey: "large",
      modifiers: [{ groupId: "spice", optionId: "medium" }],
      note: "ít hành",
      price: 50000,
      quantity: 1,
    };

    act(() => {
      result.current.addToCart(item);
      result.current.addToCart({ ...item, quantity: 2 });
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
    expect(result.current.getTotalItems()).toBe(3);
    expect(result.current.getTotalPrice()).toBe(150000);
  });

  it("keeps different modifiers as separate cart lines and removes by line identity", () => {
    const { result } = renderHook(() => useCart());
    const base = { id: "dish-1", restaurantId: "restaurant-1", servingVariantKey: "portion", price: 40000 };

    act(() => {
      result.current.addToCart({ ...base, modifiers: [{ groupId: "sauce", optionId: "a" }] });
      result.current.addToCart({ ...base, modifiers: [{ groupId: "sauce", optionId: "b" }] });
    });

    expect(result.current.cart).toHaveLength(2);

    act(() => {
      result.current.removeFromCart(result.current.cart[0]);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].modifiers[0].optionId).toBe("b");
  });

  it("updates quantity and removes a line when quantity reaches zero", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: "dish-1", restaurantId: "restaurant-1", price: 30000, quantity: 2 });
    });
    act(() => {
      result.current.updateQuantity(result.current.cart[0], -1);
    });
    expect(result.current.cart[0].quantity).toBe(1);

    act(() => {
      result.current.updateQuantity(result.current.cart[0], -1);
    });
    expect(result.current.cart).toHaveLength(0);
  });

  it("detects expired backend holds deterministically", () => {
    const now = new Date("2026-06-03T12:00:00.000Z").getTime();
    expect(isHoldExpired({ holdExpiresAt: "2026-06-03T11:59:59.000Z" }, now)).toBe(true);
    expect(isHoldExpired({ holdExpiresAt: "2026-06-03T12:00:01.000Z" }, now)).toBe(false);
    expect(isHoldExpired({ holdExpiresAt: null }, now)).toBe(false);
  });
});
