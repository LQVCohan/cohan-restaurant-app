// src/components/Customer/Homepage_Client/Cart.jsx
import React, { useCallback, useMemo, useState } from "react";
import "../../../../styles/Homepage/Cart.scss";
import OrderSummaryModal from "../../BookingDishesModal/OrderSummaryModal";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

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

const Cart = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity, // (itemId, delta)
  totalPrice, // number | () => number
  onCheckoutSuccess, // clearCart (khi thanh toán xong)
  onClearCart, // ✅ new: clearCart (nút Xóa tất cả)
  onRemoveRestaurantItems, // ✅ new: removeRestaurantItems(rid)
}) => {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const formatVND = useCallback(
    (v) => (v || 0).toLocaleString("vi-VN") + "đ",
    []
  );

  // Nhóm theo nhà hàng
  const groups = useMemo(() => {
    const map = new Map();
    for (const i of cart || []) {
      const rid = i.restaurantId || "unknown";
      if (!map.has(rid))
        map.set(rid, { restaurantId: rid, items: [], subtotal: 0 });
      const g = map.get(rid);
      const line = (i.price || 0) * (i.quantity || 1);
      g.items.push(i);
      g.subtotal += line;
    }
    return Array.from(map.values());
  }, [cart]);

  const total =
    typeof totalPrice === "function" ? totalPrice() : totalPrice || 0;

  const handleQtyChange = (item, e) => {
    const raw = e.target.value;
    const next = Math.max(1, parseInt(raw || "1", 10));
    const delta = next - (item.quantity || 1);
    if (delta !== 0) onUpdateQuantity?.(item.id, delta);
  };

  return (
    <div className={`cart ${isOpen ? "cart--open" : ""}`}>
      <div className="cart__header">
        <h3 className="cart__title">Giỏ hàng</h3>
        <button onClick={onClose} className="cart__close">
          ✕
        </button>
      </div>

      <div className="cart__items">
        {!cart?.length && <p className="cart__empty">Giỏ hàng trống</p>}

        {groups.map((group) => (
          <RestaurantGroup
            key={group.restaurantId}
            group={group}
            formatVND={formatVND}
            onUpdateQuantity={onUpdateQuantity}
            onQtyChange={handleQtyChange}
            onRemoveRestaurantItems={onRemoveRestaurantItems}
          />
        ))}
      </div>

      <div className="cart__footer">
        <div className="cart__total">
          <span className="cart__total-label">Tổng cộng:</span>
          <span className="cart__total-price">{formatVND(total)}</span>
        </div>
        <div className="cart__footer-actions">
          <button
            className="cart__checkout"
            onClick={() => setIsOrderModalOpen(true)}
            disabled={!cart?.length}
          >
            Thanh toán
          </button>

          {!!cart?.length && (
            <button
              className="cart__clear-all"
              onClick={() => onClearCart?.()} // ✅ gọi clearCart
              title="Xóa tất cả món trong giỏ"
            >
              🗑 Xóa tất cả
            </button>
          )}
        </div>
      </div>

      <OrderSummaryModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        items={cart}
        onSuccess={onCheckoutSuccess} // thường là clearCart
      />
    </div>
  );
};

function RestaurantGroup({
  group,
  formatVND,
  onUpdateQuantity,
  onQtyChange,
  onRemoveRestaurantItems,
}) {
  const name =
    useRestaurantName(group.restaurantId) || `Nhà hàng ${group.restaurantId}`;

  return (
    <div className="cart-group">
      <div className="cart-group__header">
        <h4 className="cart-group__title">🏪 {name}</h4>
        <button
          className="cart-group__remove-btn"
          onClick={() => onRemoveRestaurantItems?.(group.restaurantId)} // ✅ gọi removeRestaurantItems
          title="Xóa tất cả món của nhà hàng này"
        >
          Xóa toàn bộ
        </button>
      </div>

      {group.items.map((item) => {
        const line = (item.price || 0) * (item.quantity || 1);
        return (
          <div key={item.id} className="cart-item cart-item--grouped">
            <div className="cart-item__info">
              <div className="cart-item__details">
                <h6 className="cart-item__name">{item.name}</h6>
                <div className="cart-item__unit">
                  Đơn giá: <strong>{formatVND(item.price)}</strong>
                </div>
                <div className="cart-item__line">
                  Thành tiền: <strong>{formatVND(line)}</strong>
                </div>
              </div>
            </div>

            <div className="cart-item__controls">
              <button
                onClick={() => onUpdateQuantity?.(item.id, -1)}
                className="cart-item__btn cart-item__btn--decrease"
                aria-label="Giảm số lượng"
              >
                −
              </button>
              <input
                className="cart-item__quantity-input"
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => onQtyChange(item, e)} // ✅ tính delta chuẩn
              />
              <button
                onClick={() => onUpdateQuantity?.(item.id, 1)}
                className="cart-item__btn cart-item__btn--increase"
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      <div className="cart-group__subtotal">
        <span className="cart-group__subtotal-label">Tổng {name}:</span>
        <span className="cart-group__subtotal-value">
          {formatVND(group.subtotal)}
        </span>
      </div>

      <hr className="cart-group__divider" />
    </div>
  );
}

export default Cart;
