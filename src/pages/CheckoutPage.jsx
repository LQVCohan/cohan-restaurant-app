import React, { useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, LogIn, ShoppingBag } from "lucide-react";
import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryTransferModal";
import { useCart } from "@/context/CartProvider";
import { isHoldExpired } from "@/hooks/useCart";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import "./CheckoutPage.polish.css";

const hasBackendCartRefs = (item) =>
  Boolean(
    (item?.backendCartId || item?.cartId) &&
      (item?.backendCartItemId || item?.cartItemId),
  );

const CheckoutBlockedState = ({ icon: Icon, title, message, actionLabel, onAction, secondaryLabel, onSecondary }) => (
  <main className="checkout-empty-state">
    <section className="checkout-empty-state__card" aria-labelledby="checkout-blocked-title">
      <div className="checkout-empty-state__icon" aria-hidden="true">
        <Icon size={30} />
      </div>
      <p className="checkout-empty-state__eyebrow">Checkout tạm dừng</p>
      <h2 id="checkout-blocked-title">{title}</h2>
      <p>{message}</p>
      <div className="checkout-empty-state__actions">
        <button type="button" className="btn btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
        {secondaryLabel && (
          <button type="button" className="btn btn--secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  </main>
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
      <CheckoutBlockedState
        icon={LogIn}
        title="Không thể checkout"
        message="Vui lòng đăng nhập bằng tài khoản khách hàng để giữ món và đặt món."
        actionLabel="Đăng nhập tài khoản khách hàng"
        onAction={() => navigate("/login", { replace: true, state: { from: location } })}
        secondaryLabel="Quay lại"
        onSecondary={handleClose}
      />
    );
  }

  const invalidCartRefItems = !checkoutCompleted
    ? (checkoutItems || []).filter((item) => !hasBackendCartRefs(item))
    : [];

  if (!checkoutCompleted && invalidCartRefItems.length > 0) {
    return (
      <CheckoutBlockedState
        icon={AlertTriangle}
        title="Giỏ hàng chưa đồng bộ"
        message="Vui lòng thêm lại món vào giỏ để hệ thống giữ món trước khi thanh toán."
        actionLabel="Quay lại thực đơn"
        onAction={handleClose}
        secondaryLabel="Về giỏ hàng"
        onSecondary={() => navigate("/cart", { replace: true })}
      />
    );
  }

  if (!checkoutCompleted && expiredHoldItems.length > 0) {
    return (
      <CheckoutBlockedState
        icon={AlertTriangle}
        title="Giữ món đã hết hạn"
        message="Một số món đã hết thời gian giữ. Hãy quay lại menu để thêm lại món trước khi thanh toán."
        actionLabel="Quay lại thực đơn"
        onAction={handleClose}
        secondaryLabel="Về giỏ hàng"
        onSecondary={() => navigate("/cart", { replace: true })}
      />
    );
  }

  if (!checkoutCompleted && (!checkoutItems || checkoutItems.length === 0)) {
    return (
      <CheckoutBlockedState
        icon={ShoppingBag}
        title="Giỏ hàng đang trống"
        message="Vui lòng thêm món trước khi thanh toán."
        actionLabel="Quay lại thực đơn"
        onAction={handleClose}
        secondaryLabel="Khám phá nhà hàng"
        onSecondary={() => navigate("/restaurants", { replace: true })}
      />
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
