// src/hooks/useCart.js
import { useState, useCallback } from "react";

export const useCart = () => {
  const [cart, setCart] = useState([]);

  // dish cần có: id (dishId), restaurantId, name, price, image?, method?, quantity?
  const addToCart = useCallback((dish) => {
    const incoming = { ...dish, quantity: dish.quantity || 1 };
    setCart((prev) => {
      // Gộp theo cặp (id + restaurantId) để tránh trùng món từ nhà hàng khác
      const found = prev.find(
        (i) => i.id === incoming.id && i.restaurantId === incoming.restaurantId
      );
      if (found) {
        return prev.map((i) =>
          i.id === incoming.id && i.restaurantId === incoming.restaurantId
            ? { ...i, quantity: (i.quantity || 1) + 1 }
            : i
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
        .filter(Boolean)
    );
  }, []);

  const removeFromCart = useCallback(
    (itemId) => setCart((prev) => prev.filter((i) => i.id !== itemId)),
    []
  );

  const clearCart = useCallback(() => setCart([]), []);

  // Xóa toàn bộ món theo một nhà hàng
  const removeRestaurantItems = useCallback((restaurantId) => {
    setCart((prev) => prev.filter((i) => i.restaurantId !== restaurantId));
  }, []);

  // ✅ Tổng số lượng món trong giỏ (sum quantity)
  const getTotalItems = useCallback(
    () => cart.reduce((sum, i) => sum + (i.quantity || 0), 0),
    [cart]
  );

  // Tổng tiền toàn giỏ
  const getTotalPrice = useCallback(
    () =>
      cart.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1),
        0
      ),
    [cart]
  );

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems, // 👈 đã bổ sung lại
    getTotalPrice,
  };
};
