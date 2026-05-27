import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryModal";
import { useCart } from "@/context/CartProvider";
import { isHoldExpired } from "@/hooks/useCart";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const [checkoutCompleted, setCheckoutCompleted] = React.useState(false);
  const [checkoutItems, setCheckoutItems] = React.useState(() => cart || []);

  const fallbackPath = location.state?.from || "/";

  const expiredHoldItems = React.useMemo(
    () => (checkoutItems || []).filter((item) => isHoldExpired(item)),
    [checkoutItems],
  );

  React.useEffect(() => {
    if (
      !checkoutCompleted &&
      checkoutItems.length === 0 &&
      Array.isArray(cart) &&
      cart.length > 0
    ) {
      setCheckoutItems(cart);
    }
  }, [cart, checkoutCompleted, checkoutItems.length]);

  const handleClose = () => {
    navigate(fallbackPath, { replace: true });
  };

  const handleSuccess = () => {
    setCheckoutCompleted(true);
    clearCart();
  };


  if (!checkoutCompleted && expiredHoldItems.length > 0) {
    return <div className="checkout-empty-state"><h2>Giữ món đã hết hạn</h2><p>Vui lòng quay lại menu để thêm lại món trước khi thanh toán.</p><button type="button" className="btn btn--primary" onClick={handleClose}>Quay lại thực đơn</button></div>;
  }

  if (!checkoutCompleted && (!checkoutItems || checkoutItems.length === 0)) {
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
      items={checkoutItems}
      onSuccess={handleSuccess}
    />
  );
};

export default CheckoutPage;
