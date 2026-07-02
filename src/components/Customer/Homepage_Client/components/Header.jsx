import React, { useContext, useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import useBrandManagement from "@/hooks/useBrandManagement";
import { canAccessRoute, isAdminRole } from "@/utils/frontendRoleAccess";
import {
  getCombinedRoleLabel,
  getRoleTooltip,
  normalizeBrandRole,
} from "@/lib/userRoleDisplay";
import "../../../../styles/Homepage/Header.scss";
import HeaderSearch from "./HeaderSearch.jsx";
import CustomerNotificationBell from "@/components/Customer/common/CustomerNotificationBell";

const EMPTY_RESTAURANTS = [];

const CUSTOMER_DROPDOWN_COUNTS = gql`
  query CustomerDropdownCounts($userId: ID!, $orderLimit: Int = 50) {
    myCoupons(status: "saved") {
      id
      status
    }
    ordersByUser(userId: $userId, limit: $orderLimit) {
      edges {
        node {
          id
          currentStatus
        }
      }
    }
    myReservations(limit: $orderLimit) {
      id
      status
    }
  }
`;

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "shipping",
  "delivering",
  "out_for_delivery",
]);

const ACTIVE_RESERVATION_STATUSES = new Set([
  "pending",
  "pending_payment",
  "confirmed",
  "pending_change",
]);

const countActiveRows = (rows, statusKey = "status", activeSet) =>
  rows.filter((row) => {
    const status = String(row?.[statusKey] || "").toLowerCase();
    return !status || activeSet.has(status);
  }).length;

const Header = ({ onCartToggle, cartItemCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext) || {};
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lang, setLang] = useState("vi");

  const userId = user?.id || user?._id || "";
  const brandState = useBrandManagement(EMPTY_RESTAURANTS, { skip: !userId });
  const activeBrand = brandState.selectedBrand || brandState.brands[0] || null;
  const activeMembership = activeBrand?.membership || (
    activeBrand?.membershipRole
      ? { role: activeBrand.membershipRole, restaurantIds: activeBrand.restaurantIds || [] }
      : null
  );
  const brandRole = normalizeBrandRole(activeMembership || activeBrand?.membershipRole);
  const hasManagerAccess = Boolean(user && canAccessRoute(user, "/manager"));
  const hasBrandManagementAccess = hasManagerAccess && (
    isAdminRole(user) || ["owner", "admin"].includes(brandRole)
  );

  const { data: dropdownCountData } = useQuery(CUSTOMER_DROPDOWN_COUNTS, {
    variables: { userId, orderLimit: 50 },
    skip: !userId,
    fetchPolicy: "cache-and-network",
  });

  const counts = useMemo(() => {
    const coupons = dropdownCountData?.myCoupons?.length || 0;
    const orderNodes =
      dropdownCountData?.ordersByUser?.edges
        ?.map((edge) => edge?.node)
        .filter(Boolean) || [];
    const reservations = dropdownCountData?.myReservations || [];

    const activeOrders = countActiveRows(
      orderNodes,
      "currentStatus",
      ACTIVE_ORDER_STATUSES,
    );
    const activeReservations = countActiveRows(
      reservations,
      "status",
      ACTIVE_RESERVATION_STATUSES,
    );

    return {
      coupons,
      orders: activeOrders + activeReservations,
    };
  }, [dropdownCountData]);

  const userMenuRef = useRef(null);

  const goto = (path) => {
    setShowUserMenu(false);
    if (`${location.pathname}${location.hash}` !== path) navigate(path);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout?.();
    setShowUserMenu(false);
    navigate("/login");
  };

  const avatarText = useMemo(() => {
    if (user?.fullName) return user.fullName.substring(0, 2).toUpperCase();
    if (user?.username) return user.username.substring(0, 2).toUpperCase();
    return "US";
  }, [user]);

  const roleLabel = useMemo(
    () => getCombinedRoleLabel({
      user,
      activeBrand,
      membership: activeMembership,
      compact: true,
    }),
    [activeBrand, activeMembership, user],
  );
  const roleTooltip = useMemo(
    () => getRoleTooltip({ user, activeBrand, membership: activeMembership }),
    [activeBrand, activeMembership, user],
  );

  const toggleUser = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header__container">
        <button
          className="header__logo"
          onClick={() => goto("/")}
          aria-label="Về trang chủ Cohan"
        >
          <img
            className="header__logo-image"
            src="/cohan-wordmark.svg"
            alt="Cohan"
          />
        </button>

        <nav className="header__nav">
          {[
            { path: "/", label: "Trang chủ" },
            { path: "/restaurants", label: "Nhà hàng" },
            { path: "/cus-menu", label: "Thực đơn" },
            { path: "/combos", label: "Combo" },
            { path: "/contact", label: "Liên hệ" },
          ].map((link) => (
            <button
              key={link.path}
              className={`header__nav-link ${
                location.pathname === link.path ? "is-active" : ""
              }`}
              onClick={() => goto(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="header__actions">
          <div className="header__lang">
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="vi">VI 🇻🇳</option>
              <option value="en">EN 🇺🇸</option>
            </select>
          </div>

          <HeaderSearch />

          <CustomerNotificationBell />

          {user ? (
            <div className="header__user-menu" ref={userMenuRef}>
              <button
                className={`header__user-btn ${
                  showUserMenu ? "is-active" : ""
                }`}
                onClick={toggleUser}
                title={roleTooltip}
                aria-expanded={showUserMenu}
                aria-label="Mở menu tài khoản"
              >
                <div className="header__avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.fullName || user.username || "Ảnh đại diện"} />
                  ) : (
                    avatarText
                  )}
                </div>
                <div className="header__user-info">
                  <span className="header__username">
                    {user.fullName || user.username}
                  </span>
                  <span className="header__user-arrow">▼</span>
                </div>
              </button>

              {showUserMenu && (
                <div className="header__user-dropdown">
                  <div className="header__user-dropdown-header">
                    <p className="user-name">
                      {user.fullName || user.username}
                    </p>
                    <p className="user-role">{roleLabel}</p>
                  </div>
                  <div className="header__user-dropdown-body">
                    {hasManagerAccess && (
                      <>
                        <button
                          className="header__menu-item"
                          onClick={() => goto("/manager#dashboard")}
                        >
                          <span className="header__item-label">📊 Trang quản lý</span>
                        </button>
                        {hasBrandManagementAccess && (
                          <button
                            className="header__menu-item"
                            onClick={() => goto("/manager#brands")}
                          >
                            <span className="header__item-label">
                              🏢 Quản lý chuỗi{activeBrand?.name ? ` · ${activeBrand.name}` : ""}
                            </span>
                          </button>
                        )}
                        <div className="divider"></div>
                      </>
                    )}
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/profile")}
                    >
                      <span className="header__item-label">
                        👤 Hồ sơ cá nhân
                      </span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/for-you")}
                    >
                      <span className="header__item-label">✨ Dành cho bạn</span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/coupons")}
                    >
                      <span className="header__item-label">🎟️ Kho Coupon</span>
                      {counts.coupons > 0 && (
                        <span className="header__item-badge">
                          {counts.coupons}
                        </span>
                      )}
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/wallet")}
                    >
                      <span className="header__item-label">💳 Ví của tôi</span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/orders")}
                    >
                      <span className="header__item-label">
                        📦 Đơn hàng của tôi
                      </span>
                      {counts.orders > 0 && (
                        <span className="header__item-badge highlight">
                          {counts.orders}
                        </span>
                      )}
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/favorites/${userId}`)}
                    >
                      <span className="header__item-label">❤️ Yêu thích</span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/address-book/${userId}`)}
                    >
                      <span className="header__item-label">📍 Sổ địa chỉ</span>
                    </button>
                    <div className="divider"></div>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/help-center/${userId}`)}
                    >
                      <span className="header__item-label">❓ Trợ giúp</span>
                    </button>
                    <button
                      className="header__menu-item logout-btn"
                      onClick={handleLogout}
                    >
                      <span className="header__item-label">🚪 Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className="header__login-btn"
              onClick={() => goto("/login")}
            >
              Đăng nhập
            </button>
          )}

          <button
            className={`header__cart-btn ${cartItemCount > 0 ? "has-items" : ""}`}
            onClick={onCartToggle}
            aria-label={`Mở giỏ hàng${cartItemCount > 0 ? `, ${cartItemCount} sản phẩm` : ""}`}
            title="Giỏ hàng"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cartItemCount > 0 && (
              <span className="badge">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
