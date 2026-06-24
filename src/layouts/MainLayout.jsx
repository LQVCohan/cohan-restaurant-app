import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Customer/Homepage_Client/components/Header";
import Footer from "../components/Customer/Homepage_Client/components/Footer";
import Cart from "../components/Customer/Homepage_Client/components/Cart";
import TodayMealWizard from "../components/Customer/TodayMealWizard/TodayMealWizard";
import PostOrderReviewPrompt from "../components/Customer/PostOrderReviewPrompt/PostOrderReviewPrompt";
import { useCart } from "../context/CartProvider";
import { useCustomerCartActions } from "../hooks/useCustomerCartActions";
import { OPEN_CUSTOMER_CART_EVENT } from "../utils/cartEvents";

export default function MainLayout({ children }) {
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const location = useLocation();
  const { cart, updateQuantity, removeFromCart, clearCart, removeRestaurantItems, getTotalItems, getTotalPrice } = useCart();
  const cartActions = useCustomerCartActions({
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
  });
  const searchParams = new URLSearchParams(location.search);
  const isRestaurantDetailPreview = searchParams.get("preview") === "1";
  React.useEffect(() => {
    const handler = () => setIsCartOpen(true);
    window.addEventListener(OPEN_CUSTOMER_CART_EVENT, handler);
    return () => window.removeEventListener(OPEN_CUSTOMER_CART_EVENT, handler);
  }, []);

  // Các đường dẫn KHÔNG hiển thị header/footer
  const hiddenRoutes = [
    "/login",
    "/verify-email",
    "/verify-email/confirm",
    "/verify-phone/confirm",
    "/verify-account/confirm",
    "/manager",
    "/admin",
  ];

  // Nếu đường dẫn khớp (bắt đầu bằng các path trên) → ẩn layout
  const shouldHideLayout = hiddenRoutes.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHideLayout || isRestaurantDetailPreview) {
    return <>{children}</>; // chỉ render nội dung con
  }

  return (
    <>
      <Header onCartToggle={() => setIsCartOpen(true)} cartItemCount={getTotalItems()} />
      <main style={{ minHeight: "80vh", width: "100%" }}>{children}</main>
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={cartActions.updateCartItemQuantity}
        totalPrice={getTotalPrice}
        onClearCart={cartActions.clearCustomerCart}
        onRemoveRestaurantItems={cartActions.removeRestaurantScopedItems}
        onRemoveItem={cartActions.removeCartLineItem}
        isBusy={cartActions.isBusy}
        busyItemIds={cartActions.busyItemIds}
        busyRestaurantIds={cartActions.busyRestaurantIds}
        isClearing={cartActions.isClearing}
      />
      <TodayMealWizard />
      <PostOrderReviewPrompt />
      <Footer />
    </>
  );
}
