import { useState, useCallback } from "react";

export const useCart = () => {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((dish) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === dish.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...dish, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((dishId, change) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === dishId) {
            const newQuantity = item.quantity + change;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  }, []);

  const removeFromCart = useCallback((dishId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== dishId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const getTotalItems = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const getTotalPrice = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const getCartItemCount = useCallback(
    (dishId) => {
      const item = cart.find((item) => item.id === dishId);
      return item ? item.quantity : 0;
    },
    [cart]
  );

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice,
    getCartItemCount,
  };
};
