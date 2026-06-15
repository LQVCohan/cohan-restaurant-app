import React, { useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryTransferModal";
import { useCart } from "@/context/CartProvider";
import { isHoldExpired } from "@/hooks/useCart";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";

const hasBackendCartRefs = (item) =>
  Boolean(
    (item?.backendCartId || item?.cartId) &&
      (item?.backendCartItemId || item?.cartItemId),
  );

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const { user, isAuthenticated, loading } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const [checkoutCompleted, setCheckoutCompleted] = React.useState(false);
  const [checkoutItems, setCheckoutItems] = React.useState(() => cart || []);

  const fallbackPath = location.state?.from || "/";

  React.useEffect(() => {
    if (loading || isAuthenticated) return;
    showNotification("Vui lòng đăng nhập để giữ món và đặt món.", "warning");
    navigate("/login", { replace: true, state: { from: location } });
  }, [isAuthenticated, loading, location, navigate, showNotification]);

  const isCustomer =
    String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase() ===
    "customer";

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


  if (loading || !isAuthenticated) return null;

  if (!isCustomer) {
    return (
      <div className="checkout-empty-state">
        <h2>Không thể checkout</h2>
        <p>Vui lòng đăng nhập bằng tài khoản khách hàng để giữ món và đặt món.</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() =>
            navigate("/login", { replace: true, state: { from: location } })
          }
        >
          Đăng nhập tài khoản khách hàng
        </button>
      </div>
    );
  }

  const invalidCartRefItems = !checkoutCompleted
    ? (checkoutItems || []).filter((item) => !hasBackendCartRefs(item))
    : [];

  if (!checkoutCompleted && invalidCartRefItems.length > 0) {
    return (
      <div className="checkout-empty-state">
        <h2>Giỏ hàng chưa đồng bộ</h2>
        <p>Vui lòng thêm lại món vào giỏ để hệ thống giữ món trước khi thanh toán.</p>
        <button type="button" className="btn btn--primary" onClick={handleClose}>
          Quay lại thực đơn
        </button>
      </div>
    );
  }

  if (!checkoutCompleted && expiredHoldItems.length > 0) {
    return (
      <div className="checkout-empty-state">
        <h2>Giữ món đã hết hạn</h2>
        <p>Vui lòng quay lại menu để thêm lại món trước khi thanh toán.</p>
        <button type="button" className="btn btn--primary" onClick={handleClose}>
          Quay lại thực đơn
        </button>
      </div>
    );
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
