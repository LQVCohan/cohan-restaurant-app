// src/hooks/useCart.js
import { useState, useCallback, useEffect } from "react";

const CART_STORAGE_KEY = "cohan.customerCart.v1";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const clearPersistedCart = () => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const isHoldExpired = (item) => {
  if (!item?.holdExpiresAt) return false;
  const expiresAt = new Date(item.holdExpiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date();
};

const getInitialCart = () => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => !isHoldExpired(item));
  } catch {
    return [];
  }
};

export const useCart = () => {
  const [cart, setCart] = useState(getInitialCart);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;

    try {
      if (!cart.length) {
        clearPersistedCart();
        return;
      }

      storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage write errors to avoid breaking checkout UX.
    }
  }, [cart]);

  // dish cần có: id (dishId), restaurantId, name, price, image?, method?, quantity?
  const addToCart = useCallback((dish) => {
    const incoming = { ...dish, quantity: dish.quantity || 1 };
    setCart((prev) => {
      // Gộp theo cặp (id + restaurantId) để tránh trùng món từ nhà hàng khác
      const found = prev.find(
        (i) => i.id === incoming.id && i.restaurantId === incoming.restaurantId,
      );
      if (found) {
        return prev.map((i) =>
          i.id === incoming.id && i.restaurantId === incoming.restaurantId
            ? {
                ...i,
                ...incoming,
                quantity: (i.quantity || 0) + (incoming.quantity || 1),
                holdExpiresAt: incoming.holdExpiresAt || i.holdExpiresAt,
                holdStatus: incoming.holdStatus || i.holdStatus,
                backendCartItemId:
                  incoming.backendCartItemId || i.backendCartItemId,
                backendCartId: incoming.backendCartId || i.backendCartId,
              }
            : i,
        );
      }
      return [...prev, incoming];
    });
  }, []);

  // Thay đổi số lượng theo itemId (delta có thể âm/dương)
  const updateQuantity = useCallback((itemId, change) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === itemId) {
            const next = (i.quantity || 1) + Number(change || 0);
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean),
    );
  }, []);

  const removeFromCart = useCallback(
    (itemId) => setCart((prev) => prev.filter((i) => i.id !== itemId)),
    [],
  );

  const clearCart = useCallback(() => setCart([]), []);

  // Xóa toàn bộ món theo một nhà hàng
  const removeRestaurantItems = useCallback((restaurantId) => {
    setCart((prev) => prev.filter((i) => i.restaurantId !== restaurantId));
  }, []);

  // ✅ Tổng số lượng món trong giỏ (sum quantity)
  const getTotalItems = useCallback(
    () => cart.reduce((sum, i) => sum + (i.quantity || 0), 0),
    [cart],
  );

  // Tổng tiền toàn giỏ
  const getTotalPrice = useCallback(
    () =>
      cart.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1),
        0,
      ),
    [cart],
  );

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  };
};
