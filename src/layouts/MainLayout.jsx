import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Customer/Homepage_Client/components/Header";
import Footer from "../components/Customer/Homepage_Client/components/Footer";
import Cart from "../components/Customer/Homepage_Client/components/Cart";
import TodayMealWizard from "../components/Customer/TodayMealWizard/TodayMealWizard";
import PostOrderReviewPrompt from "../components/Customer/PostOrderReviewPrompt/PostOrderReviewPrompt";
import MobileCustomerShell from "../components/Customer/MobileCustomerShell/MobileCustomerShell";
import { useCart } from "../context/CartProvider";
import { useCustomerCartActions } from "../hooks/useCustomerCartActions";
import useIsMobile from "../hooks/useIsMobile";
import { OPEN_CUSTOMER_CART_EVENT } from "../utils/cartEvents";
import "../styles/MobileCustomerPolish.scss";
import "../styles/MobileCustomerFloatingControls.scss";

const TableOrderRouteExperience = React.lazy(
  () => import("../components/Customer/TableCurrentSession/TableOrderRouteExperience"),
);

export default function MainLayout({ children }) {
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();
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
  const isPublicTableRoute = location.pathname.startsWith("/table/");
  const isFocusedTableFlow =
    location.pathname === "/scan-table" || isPublicTableRoute;
  const publicTableRouteKey = `${location.pathname}${location.search || ""}`;

  React.useEffect(() => {
    const handler = () => setIsCartOpen(true);
    window.addEventListener(OPEN_CUSTOMER_CART_EVENT, handler);
    return () => window.removeEventListener(OPEN_CUSTOMER_CART_EVENT, handler);
  }, []);

  const hiddenRoutes = [
    "/login",
    "/verify-email",
    "/verify-email/confirm",
    "/verify-phone/confirm",
    "/verify-account/confirm",
    "/manager",
    "/admin",
  ];

  const shouldHideLayout = hiddenRoutes.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHideLayout || isRestaurantDetailPreview) {
    return <>{children}</>;
  }

  const cartPanel = (
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
  );

  const tableOrderExperience = isPublicTableRoute ? (
    <React.Suspense fallback={null}>
      <TableOrderRouteExperience key={publicTableRouteKey} />
    </React.Suspense>
  ) : null;

  if (isMobile) {
    return (
      <>
        <MobileCustomerShell
          onCartToggle={() => setIsCartOpen(true)}
          cartItemCount={getTotalItems()}
        >
          {children}
        </MobileCustomerShell>
        {tableOrderExperience}
        {cartPanel}
        {location.pathname === "/" && <TodayMealWizard />}
        {!isFocusedTableFlow && <PostOrderReviewPrompt />}
      </>
    );
  }

  return (
    <>
      <Header onCartToggle={() => setIsCartOpen(true)} cartItemCount={getTotalItems()} />
      <main className="customer-experience-main">{children}</main>
      {tableOrderExperience}
      {cartPanel}
      {!isFocusedTableFlow && <TodayMealWizard />}
      {!isFocusedTableFlow && <PostOrderReviewPrompt />}
      <Footer />
    </>
  );
}
