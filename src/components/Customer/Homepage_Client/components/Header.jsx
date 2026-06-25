import React, { useContext, useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "../../../../styles/Homepage/Header.scss";
import HeaderSearch from "./HeaderSearch.jsx";
import CustomerNotificationBell from "@/components/Customer/common/CustomerNotificationBell";

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
  const { user, logout, restaurants = [], refRestaurant = [] } =
    useContext(AuthContext) || {};
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lang, setLang] = useState("vi");

  const userId = user?.id || user?._id || "";
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
  const couponRestaurantId = useMemo(() => {
    const restaurant = [...restaurants, ...refRestaurant].find(Boolean);
    if (!restaurant) return "";
    return String(
      restaurant.id || restaurant._id || restaurant.restaurantId || restaurant,
    ).trim();
  }, [restaurants, refRestaurant]);

  const couponPath = couponRestaurantId
    ? `/coupons/${couponRestaurantId}`
    : "/coupons";


  const goto = (path) => {
    setShowUserMenu(false);
    if (location.pathname !== path) navigate(path);
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

  const roleLabel = useMemo(() => {
    const r = user?.role || "customer";
    return r === "owner"
      ? "Chủ nhà hàng"
      : r === "admin"
      ? "Quản trị viên"
      : "Khách hàng";
  }, [user]);

  const toggleUser = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header__container">
        <button className="header__logo" onClick={() => goto("/")}>
          <div className="header__logo-icon">🍽️</div>
          <h1 className="header__logo-text">FoodHub</h1>
        </button>

        <nav className="header__nav">
          {[
            { path: "/", label: "Trang chủ" },
            { path: "/restaurants", label: "Nhà hàng" },
            { path: "/cus-menu", label: "Thực đơn" },
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
              >
                <div className="header__avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt="avt" />
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
                      onClick={() => goto(couponPath)}
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
                      onClick={() => goto(`/favorites/${user.id}`)}
                    >
                      <span className="header__item-label">❤️ Yêu thích</span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/address-book/${user.id}`)}
                    >
                      <span className="header__item-label">📍 Sổ địa chỉ</span>
                    </button>
                    <div className="divider"></div>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/help-center/${user.id}`)}
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

          <button className="header__cart-btn" onClick={onCartToggle}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cartItemCount > 0 && (
              <span className="badge">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;