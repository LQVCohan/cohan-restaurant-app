import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryModal";
import { useCart } from "@/context/CartProvider";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();

  const handleClose = () => {
    const fallbackPath = location.state?.from || "/";
    navigate(fallbackPath, { replace: true });
  };

  const handleSuccess = () => {
    clearCart();
    handleClose();
  };

  return (
    <OrderSummaryModal
      isOpen
      onClose={handleClose}
      items={cart}
      onSuccess={handleSuccess}
    />
  );
};

export default CheckoutPage;
