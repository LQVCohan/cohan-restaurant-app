/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from "react";
import { useCart as useCartCore } from "../hooks/useCart"; // 👈 hook gốc của bạn

// Tạo context
const CartContext = createContext(null);

// Provider bọc toàn app (bạn đã dùng trong App.jsx)
export const CartProvider = ({ children }) => {
  // Dùng lại logic giỏ hàng đã test kỹ ở hook useCart
  const cartState = useCartCore();

  return (
    <CartContext.Provider value={cartState}>{children}</CartContext.Provider>
  );
};

// Hook tiện dụng để dùng trong component
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
};

// export default nếu bạn cần, nhưng đừng dùng trực tiếp CartContext nữa
export default CartContext;
