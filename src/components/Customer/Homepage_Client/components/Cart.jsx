import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../../../../styles/Homepage/Cart.scss";
import OrderSummaryModal from "../../BookingDishesModal/OrderSummaryModal";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

// --- GRAPHQL ---
const RESTAURANT_BY_ID = gql`
  query RestaurantById($id: ID!) {
    restaurant(id: $id) {
      id
      name
    }
  }
`;

function useRestaurantName(restaurantId) {
  const { data } = useQuery(RESTAURANT_BY_ID, {
    variables: { id: restaurantId },
    skip: !restaurantId,
  });
  return data?.restaurant?.name;
}

// --- ICONS (SVG Inline) ---
const IconClose = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
const IconTrash = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);
const IconStore = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
  </svg>
);
const IconEmpty = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.2 }}
  >
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

// --- COMPONENT CHÍNH ---
const Cart = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  totalPrice,
  onCheckoutSuccess,
  onClearCart,
  onRemoveRestaurantItems,
  onRemoveItem,
  autoOpenCheckout = false,
  isBusy = false,
  busyItemIds,
  busyRestaurantIds,
  isClearing = false,
}) => {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  useEffect(() => {
    if (isOpen && autoOpenCheckout) {
      setIsOrderModalOpen(true);
    }
  }, [isOpen, autoOpenCheckout]);

  const formatVND = useCallback(
    (v) => (v || 0).toLocaleString("vi-VN") + "đ",
    [],
  );

  // Nhóm theo nhà hàng
  const groups = useMemo(() => {
    const map = new Map();
    for (const i of cart || []) {
      const rid = i.restaurantId || "unknown";
      if (!map.has(rid)) {
        map.set(rid, { restaurantId: rid, items: [], subtotal: 0 });
      }
      const g = map.get(rid);
      const line = (i.price || 0) * (i.quantity || 1);
      g.items.push(i);
      g.subtotal += line;
    }
    return Array.from(map.values());
  }, [cart]);

  const total =
    typeof totalPrice === "function" ? totalPrice() : totalPrice || 0;
  const itemCount =
    cart?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  const handleQtyChange = (item, e) => {
    const itemBusy = isBusy || !!busyItemIds?.[item.id];
    if (itemBusy) return;
    const raw = e.target.value;
    const next = Math.max(1, parseInt(raw || "1", 10));
    const delta = next - (item.quantity || 1);
    if (delta !== 0) onUpdateQuantity?.(item, delta);
  };

  return (
    <>
      <div
        className={`cart-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <div className={`cart-panel ${isOpen ? "open" : ""}`}>
        <div className="cart-header">
          <div className="cart-header__top">
            <h3 className="cart-header__title">
              Giỏ hàng <span className="cart-header__count">({itemCount})</span>
            </h3>
            <button onClick={onClose} className="cart-header__close">
              <IconClose />
            </button>
          </div>
          {!!cart?.length && (
            <button
              className="cart-header__clear"
              onClick={() => onClearCart?.()}
              disabled={isBusy || isClearing}
            >
              Xóa tất cả
            </button>
          )}
        </div>

        <div className="cart-body">
          {!cart?.length && (
            <div className="cart-empty">
              <div className="cart-empty__icon">
                <IconEmpty />
              </div>
              <p>Bạn chưa chọn món nào.</p>
              <button className="cart-empty__btn" onClick={onClose}>
                Tiếp tục xem món
              </button>
            </div>
          )}

          {groups.map((group) => (
            <RestaurantGroup
              key={group.restaurantId}
              group={group}
              formatVND={formatVND}
              onUpdateQuantity={onUpdateQuantity}
              onQtyChange={handleQtyChange}
              onRemoveRestaurantItems={onRemoveRestaurantItems}
              onRemoveItem={onRemoveItem}
              isBusy={isBusy}
              busyItemIds={busyItemIds}
              busyRestaurantIds={busyRestaurantIds}
            />
          ))}
        </div>

        {!!cart?.length && (
          <div className="cart-footer">
            <div className="cart-footer__row">
              <span className="cart-footer__label">Tổng thanh toán</span>
              <span className="cart-footer__total">{formatVND(total)}</span>
            </div>
            <button
              className="cart-checkout-btn"
              onClick={() => {
                if (isBusy || isClearing) return;
                setIsOrderModalOpen(true);
              }}
              disabled={isBusy || isClearing}
            >
              Đặt đơn ngay
            </button>
          </div>
        )}
      </div>

      <OrderSummaryModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        items={cart}
        onSuccess={onCheckoutSuccess}
      />
    </>
  );
};

function RestaurantGroup({
  group,
  formatVND,
  onUpdateQuantity,
  onQtyChange,
  onRemoveRestaurantItems,
  onRemoveItem,
  isBusy,
  busyItemIds,
  busyRestaurantIds,
}) {
  const name =
    useRestaurantName(group.restaurantId) || `Nhà hàng ${group.restaurantId}`;

  return (
    <div className="cart-group">
      <div className="cart-group__header">
        <div className="cart-group__store-info">
          <IconStore />
          <span className="cart-group__name">{name}</span>
        </div>
        <button
          className="cart-group__remove"
          onClick={() => onRemoveRestaurantItems?.(group.restaurantId)}
          title="Xóa nhà hàng này"
          disabled={isBusy || !!busyRestaurantIds?.[group.restaurantId]}
        >
          <IconTrash />
        </button>
      </div>

      <div className="cart-group__list">
        {group.items.map((item) => {
          const line = (item.price || 0) * (item.quantity || 1);
          const itemBusy = isBusy || !!busyItemIds?.[item.id];
          return (
            <div key={item.id} className="cart-item">
              <div className="cart-item__main">
                <div className="cart-item__info">
                  <h6 className="cart-item__name">{item.name}</h6>
                  <div className="cart-item__price-unit">
                    {formatVND(item.price)}
                  </div>
                </div>
              </div>

              <div className="cart-item__actions">
                <div className="cart-qty">
                  <button
                    onClick={() => onUpdateQuantity?.(item, -1)}
                    className="cart-qty__btn"
                    disabled={itemBusy || item.quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    className="cart-qty__input"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onQtyChange(item, e)}
                    disabled={itemBusy}
                  />
                  <button
                    onClick={() => onUpdateQuantity?.(item, 1)}
                    className="cart-qty__btn"
                    disabled={itemBusy}
                  >
                    +
                  </button>
                </div>
                <div className="cart-item__total-line">{formatVND(line)}</div>
                <button
                  onClick={() => onRemoveItem?.(item)}
                  className="cart-group__remove"
                  title="Xóa món"
                  disabled={itemBusy}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cart-group__subtotal">
        <span>Tạm tính ({name}):</span>
        <strong>{formatVND(group.subtotal)}</strong>
      </div>
    </div>
  );
}

export default Cart;
