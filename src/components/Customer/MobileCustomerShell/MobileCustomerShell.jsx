import React, { useContext } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Home,
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  Store,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { canAccessRoute } from "@/utils/frontendRoleAccess";
import CustomerNotificationBell from "@/components/Customer/common/CustomerNotificationBell";
import "./MobileCustomerShell.scss";

const NAV_ITEMS = [
  { to: "/", label: "Trang chủ", icon: Home, end: true },
  { to: "/restaurants", label: "Nhà hàng", icon: Store },
  { to: "/cus-menu", label: "Thực đơn", icon: UtensilsCrossed },
  { to: "/orders", label: "Đơn hàng", icon: ReceiptText, requiresAuth: true },
];

const resolveTitle = (pathname) => {
  if (pathname === "/") return "Cohan";
  if (pathname.startsWith("/restaurants")) return "Nhà hàng";
  if (pathname.startsWith("/restaurant/")) return "Chi tiết nhà hàng";
  if (pathname.startsWith("/cus-menu")) return "Thực đơn";
  if (pathname.startsWith("/food/")) return "Chi tiết món";
  if (pathname.startsWith("/orders")) return "Đơn hàng";
  if (pathname.startsWith("/cart")) return "Giỏ hàng";
  if (pathname.startsWith("/checkout")) return "Thanh toán";
  if (pathname.startsWith("/profile")) return "Tài khoản";
  if (pathname.startsWith("/coupons")) return "Ưu đãi";
  if (pathname.startsWith("/combos")) return "Combo";
  return "Cohan";
};

export default function MobileCustomerShell({
  children,
  onCartToggle,
  cartItemCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext) || {};
  const isHome = location.pathname === "/";
  const hasManagerAccess = Boolean(user && canAccessRoute(user, "/manager"));
  const canOpenProfile = Boolean(user && canAccessRoute(user, "/profile"));
  const accountPath = !user
    ? "/login"
    : canOpenProfile
      ? "/profile"
      : hasManagerAccess
        ? "/manager"
        : "/login";
  const accountLabel = accountPath === "/manager" ? "Quản lý" : "Tài khoản";
  const AccountIcon = accountPath === "/manager" ? LayoutDashboard : UserRound;
  const showManagerShortcut = hasManagerAccess && accountPath !== "/manager";
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.requiresAuth || Boolean(user && canAccessRoute(user, item.to)),
  );

  return (
    <div className="mobile-customer-shell">
      <header className="mobile-customer-shell__header">
        <button
          type="button"
          className="mobile-customer-shell__brand"
          onClick={() => (isHome ? navigate("/") : navigate(-1))}
          aria-label={isHome ? "Về trang chủ" : "Quay lại"}
        >
          {isHome ? (
            <span className="mobile-customer-shell__logo" aria-hidden="true">🍽️</span>
          ) : (
            <ChevronLeft aria-hidden="true" />
          )}
          <span>{resolveTitle(location.pathname)}</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showManagerShortcut && (
            <button
              type="button"
              className="mobile-customer-shell__cart"
              onClick={() => navigate("/manager")}
              aria-label="Mở trang quản lý"
              title="Trang quản lý"
            >
              <LayoutDashboard aria-hidden="true" />
            </button>
          )}
          <CustomerNotificationBell />
          <button
            type="button"
            className="mobile-customer-shell__cart"
            onClick={onCartToggle}
            aria-label={`Mở giỏ hàng${cartItemCount ? `, ${cartItemCount} món` : ""}`}
          >
            <ShoppingCart aria-hidden="true" />
            {cartItemCount > 0 && (
              <span className="mobile-customer-shell__cart-count">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mobile-customer-shell__main">{children}</main>

      <nav className="mobile-customer-shell__nav" aria-label="Điều hướng khách hàng">
        {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `mobile-customer-shell__nav-item${isActive ? " is-active" : ""}`
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink
          to={accountPath}
          className={({ isActive }) =>
            `mobile-customer-shell__nav-item${isActive ? " is-active" : ""}`
          }
        >
          <AccountIcon aria-hidden="true" />
          <span>{accountLabel}</span>
        </NavLink>
      </nav>
    </div>
  );
}
