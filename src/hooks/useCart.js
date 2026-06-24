// src/hooks/useCart.js
import { useState, useCallback, useEffect } from "react";

const CART_STORAGE_KEY = "cohan.customerCart.v1";

export const buildModifiersKey = (modifiers = []) =>
  JSON.stringify(
    (modifiers || [])
      .map((m) => ({
        groupId: m?.groupId || m?.groupName || "",
        optionId: m?.optionId || m?.optionName || "",
      }))
      .sort((a, b) =>
        `${a.groupId}:${a.optionId}`.localeCompare(
          `${b.groupId}:${b.optionId}`,
        ),
      ),
  );

export const buildCartLineIdentity = (item = {}) =>
  [
    item.id,
    item.restaurantId,
    item.servingVariantKey || item.servingKey || "portion",
    String(item.note || "").trim(),
    buildModifiersKey(item.modifiers || item.selectedModifiers || []),
  ].join("::");

const getLineKey = (item = {}) =>
  item.cartLineKey || buildCartLineIdentity(item);

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

export const isHoldExpired = (item, now = Date.now()) => {
  if (!item?.holdExpiresAt) return false;
  const expiresAt = new Date(item.holdExpiresAt);
  const expiresAtMs = expiresAt.getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now;
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

const normalizeCartLine = (item = {}) => {
  const incoming = { ...item, quantity: Number(item.quantity || 1) || 1 };
  incoming.id = incoming.id || incoming.dishId || incoming.menuItemId;
  incoming.dishId = incoming.dishId || incoming.menuItemId || incoming.id;
  incoming.cartLineKey = getLineKey(incoming);
  return incoming;
};

const mergeCartLines = (localCart = [], incomingCart = []) => {
  const lineMap = new Map();

  [...(localCart || []), ...(incomingCart || [])]
    .map(normalizeCartLine)
    .filter((item) => item.id && !isHoldExpired(item))
    .forEach((item) => {
      const key = getLineKey(item);
      const existing = lineMap.get(key);
      if (!existing) {
        lineMap.set(key, item);
        return;
      }

      lineMap.set(key, {
        ...existing,
        ...item,
        quantity: Math.max(Number(existing.quantity || 1), Number(item.quantity || 1)),
        holdExpiresAt: item.holdExpiresAt || existing.holdExpiresAt,
        holdStatus: item.holdStatus || existing.holdStatus,
        backendCartItemId: item.backendCartItemId || existing.backendCartItemId,
        backendCartId: item.backendCartId || existing.backendCartId,
      });
    });

  return Array.from(lineMap.values());
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
    const incoming = normalizeCartLine(dish);
    setCart((prev) => {
      // Gộp theo cặp (id + restaurantId + biến thể + note + modifiers)
      const incomingLineKey = getLineKey(incoming);
      const found = prev.find((i) => getLineKey(i) === incomingLineKey);
      if (found) {
        return prev.map((i) =>
          getLineKey(i) === incomingLineKey
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

  const syncServerCart = useCallback((serverItems = [], { replace = false } = {}) => {
    const normalizedServerItems = (serverItems || []).map(normalizeCartLine);
    setCart((prev) => (replace ? normalizedServerItems : mergeCartLines(prev, normalizedServerItems)));
  }, []);

  const replaceCart = useCallback((items = []) => {
    setCart((items || []).map(normalizeCartLine).filter((item) => item.id && !isHoldExpired(item)));
  }, []);

  // Thay đổi số lượng theo itemId (delta có thể âm/dương)
  const updateQuantity = useCallback((itemOrKey, change) => {
    const targetKey =
      typeof itemOrKey === "object" ? getLineKey(itemOrKey) : String(itemOrKey);
    setCart((prev) =>
      prev
        .map((i) => {
          if (getLineKey(i) === targetKey) {
            const next = (i.quantity || 1) + Number(change || 0);
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean),
    );
  }, []);

  const removeFromCart = useCallback((itemOrKey) => {
    const targetKey =
      typeof itemOrKey === "object" ? getLineKey(itemOrKey) : String(itemOrKey);
    setCart((prev) => prev.filter((i) => getLineKey(i) !== targetKey));
  }, []);

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
    syncServerCart,
    replaceCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  };
};
