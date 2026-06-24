import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Clock3, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartProvider";
import { AuthContext } from "@/context/AuthContext";
import { useCustomerCartActions } from "@/hooks/useCustomerCartActions";
import { getHoldStatus, formatHoldCountdown, hasExpiredHoldItems } from "@/components/Customer/Homepage_Client/components/Cart";
import { getOrderLineDisplay } from "@/utils/orderLineDisplay";
import "./CartPage.scss";

const formatVND = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const groupCartItems = (cart = []) => {
  const map = new Map();
  for (const item of cart || []) {
    const restaurantId = item.restaurantId || "unknown";
    if (!map.has(restaurantId)) {
      map.set(restaurantId, { restaurantId, items: [], subtotal: 0 });
    }
    const group = map.get(restaurantId);
    group.items.push(item);
    group.subtotal += getOrderLineDisplay(item).totalPrice;
  }
  return Array.from(map.values());
};

const getRoleName = (user) =>
  String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();

export default function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
    serverCartLoading,
    refetchServerCart,
  } = useCart();
  const [now, setNow] = useState(Date.now());

  const cartActions = useCustomerCartActions({
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    onAfterBackendCartChange: refetchServerCart,
  });

  useEffect(() => {
    if (!cart.length) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cart.length]);

  const groups = useMemo(() => groupCartItems(cart), [cart]);
  const expiredHoldExists = useMemo(() => hasExpiredHoldItems(cart, now), [cart, now]);
  const roleName = getRoleName(user);
  const canCheckout = Boolean(isAuthenticated && roleName === "customer" && cart.length && !expiredHoldExists);
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (roleName !== "customer") return;
    if (expiredHoldExists || !cart.length) return;
    navigate("/checkout", { state: { from: "/cart" } });
  };

  return (
    <main className="cart-page">
      <section className="cart-page__hero">
        <button type="button" className="cart-page__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Quay lại
        </button>
        <div>
          <p className="cart-page__eyebrow">Giỏ hàng chính thức</p>
          <h1>Kiểm tra món trước khi đặt</h1>
          <p>
            Giỏ hàng được đồng bộ với hệ thống giữ món khi bạn đăng nhập, giúp hạn chế đặt trùng hoặc hết hàng khi thanh toán.
          </p>
        </div>
        <div className="cart-page__summary-pill">
          <ShoppingBag size={18} />
          <strong>{totalItems}</strong>
          <span>món</span>
        </div>
      </section>

      {serverCartLoading && (
        <div className="cart-page__notice">
          <Clock3 size={18} /> Đang đồng bộ giỏ hàng từ hệ thống...
        </div>
      )}

      {expiredHoldExists && (
        <div className="cart-page__notice cart-page__notice--warning" role="alert">
          <AlertTriangle size={18} /> Một số món đã hết thời gian giữ. Vui lòng xóa hoặc thêm lại trước khi thanh toán.
        </div>
      )}

      {!cart.length ? (
        <section className="cart-page__empty">
          <div className="cart-page__empty-icon"><ShoppingBag size={34} /></div>
          <h2>Giỏ hàng đang trống</h2>
          <p>Hãy chọn nhà hàng hoặc hỏi AI gợi ý món phù hợp cho hôm nay.</p>
          <div className="cart-page__empty-actions">
            <button type="button" onClick={() => navigate("/cus-menu")}>Xem thực đơn</button>
            <button type="button" className="secondary" onClick={() => navigate("/restaurants")}>Khám phá nhà hàng</button>
          </div>
        </section>
      ) : (
        <div className="cart-page__layout">
          <section className="cart-page__groups">
            {groups.map((group) => (
              <article className="cart-page__group" key={group.restaurantId}>
                <header className="cart-page__group-header">
                  <div>
                    <span><Store size={17} /> Nhà hàng</span>
                    <strong>{group.restaurantId}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => cartActions.removeRestaurantScopedItems(group.restaurantId)}
                    disabled={cartActions.isBusy}
                  >
                    <Trash2 size={16} /> Xóa nhóm
                  </button>
                </header>

                <div className="cart-page__items">
                  {group.items.map((item) => {
                    const hold = getHoldStatus(item, now);
                    const itemBusy = cartActions.isClearing || !!cartActions.busyItemIds?.[item.cartLineKey || item.id];
                    const line = getOrderLineDisplay(item);
                    return (
                      <div className="cart-page__item" key={item.cartLineKey || item.backendCartItemId || item.id}>
                        <img src={item.image || item.thumbImage || "/default-dishes.jpg"} alt={line.displayName || "Món ăn"} />
                        <div className="cart-page__item-main">
                          <h3>{line.displayName}</h3>
                          {line.isComboLine && <span className="cart-page__item-chip cart-page__item-chip--combo">{line.badgeLabel}</span>}
                          {line.isComboLine && line.childItems.length > 0 && (
                            <ul className="cart-page__combo-items">
                              {line.childItems.map((comboItem) => (
                                <li key={`${item.id}-${comboItem.key}`}>{comboItem.qty}× {comboItem.name}</li>
                              ))}
                            </ul>
                          )}
                          {line.discountAmount > 0 && <p className="cart-page__item-note">Tiết kiệm: {formatVND(line.discountAmount)}</p>}
                          {line.note && <p className="cart-page__item-note">Ghi chú: {line.note}</p>}
                          {item.itemType !== "COMBO" && item.servingVariantKey && <span className="cart-page__item-chip">Tùy chọn: {item.servingVariantKey}</span>}
                          {hold.state !== "none" && (
                            <span className={`cart-page__hold cart-page__hold--${hold.state}`}>
                              {hold.state === "expired"
                                ? "Đã hết thời gian giữ"
                                : `Còn ${formatHoldCountdown(hold.remainingMs)} để giữ món`}
                            </span>
                          )}
                        </div>
                        <div className="cart-page__item-actions">
                          <strong>{formatVND(line.totalPrice)}</strong>
                          <div className="cart-page__qty">
                            <button type="button" disabled={itemBusy || item.quantity <= 1} onClick={() => cartActions.updateCartItemQuantity(item, -1)}>-</button>
                            <span>{item.quantity || 1}</span>
                            <button type="button" disabled={itemBusy} onClick={() => cartActions.updateCartItemQuantity(item, 1)}>+</button>
                          </div>
                          <button type="button" className="cart-page__remove" disabled={itemBusy} onClick={() => cartActions.removeCartLineItem(item)}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>

          <aside className="cart-page__checkout-card">
            <p className="cart-page__eyebrow">Tóm tắt thanh toán</p>
            <div className="cart-page__checkout-row"><span>Số lượng</span><strong>{totalItems} món</strong></div>
            <div className="cart-page__checkout-row"><span>Tạm tính</span><strong>{formatVND(totalPrice)}</strong></div>
            <div className="cart-page__checkout-total"><span>Tổng</span><strong>{formatVND(totalPrice)}</strong></div>
            {!isAuthenticated && <p className="cart-page__helper">Bạn cần đăng nhập tài khoản khách hàng để thanh toán.</p>}
            {isAuthenticated && roleName !== "customer" && <p className="cart-page__helper">Vui lòng dùng tài khoản khách hàng để checkout.</p>}
            <button type="button" className="cart-page__checkout-btn" onClick={handleCheckout} disabled={cartActions.isBusy || (isAuthenticated && !canCheckout)}>
              {!isAuthenticated ? "Đăng nhập để thanh toán" : "Thanh toán ngay"}
            </button>
            <button type="button" className="cart-page__clear-btn" onClick={cartActions.clearCustomerCart} disabled={cartActions.isClearing}>
              Xóa toàn bộ giỏ
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
