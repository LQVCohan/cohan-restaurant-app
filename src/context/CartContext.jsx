// src/context/CartContext.jsx
import React, { createContext, useContext } from "react";
import { useCart as useCartCore } from "../hooks/useCart"; // 👈 dùng hook đã test

// Context rỗng ban đầu
const CartContext = createContext(null);

// Provider bọc quanh app
export const CartProvider = ({ children }) => {
  // Dùng lại toàn bộ logic từ hook cũ
  const cartState = useCartCore();

  return (
    <CartContext.Provider value={cartState}>{children}</CartContext.Provider>
  );
};

// Hook dùng trong component (Home, RestaurantMenu, ...)
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
};

export default CartContext;
