import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryModal";
import { useCart } from "@/context/CartProvider";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const [checkoutCompleted, setCheckoutCompleted] = React.useState(false);

  const fallbackPath = location.state?.from || "/";

  const handleClose = () => {
    if (checkoutCompleted) {
      clearCart();
    }
    navigate(fallbackPath, { replace: true });
  };

  const handleSuccess = () => {
    setCheckoutCompleted(true);
  };


  if (!checkoutCompleted && (!cart || cart.length === 0)) {
    return (
      <div className="checkout-empty-state">
        <h2>Giỏ hàng đang trống</h2>
        <p>Vui lòng thêm món trước khi thanh toán.</p>
        <button type="button" className="btn btn--primary" onClick={handleClose}>
          Quay lại thực đơn
        </button>
      </div>
    );
  }

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
