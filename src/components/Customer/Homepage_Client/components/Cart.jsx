import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../../../../styles/Homepage/Cart.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { isHoldExpired } from "@/hooks/useCart";

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

export const formatHoldCountdown = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

export const getHoldStatus = (item, now = Date.now()) => {
  if (!item?.holdExpiresAt) return { state: "none", remainingMs: 0 };
  const normalizedHoldStatus = String(item.holdStatus || "active").toLowerCase();
  if (normalizedHoldStatus !== "active")
    return { state: "expired", remainingMs: 0 };
  const expiresAt = new Date(item.holdExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return { state: "none", remainingMs: 0 };
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0 || isHoldExpired(item, now))
    return { state: "expired", remainingMs: 0 };
  if (remainingMs < 60_000) return { state: "warning", remainingMs };
  return { state: "active", remainingMs };
};

export const hasExpiredHoldItems = (cart = [], now = Date.now()) =>
  (cart || []).some((item) => getHoldStatus(item, now).state === "expired");

const isComboCartLine = (item = {}) =>
  String(item.itemType || item.kind || item.type || "").toUpperCase() === "COMBO" ||
  Boolean(item.comboId || item.comboSnapshot);

const getComboChildItems = (item = {}) => {
  const snapshotItems = Array.isArray(item.comboSnapshot?.items)
    ? item.comboSnapshot.items
    : [];
  const comboQty = Math.max(1, Number(item.quantity || 1));

  return snapshotItems.map((child, index) => ({
    key: child.menuItemId || child.id || `${child.name || "combo-item"}-${index}`,
    name: child.name || "Món trong combo",
    qty: Math.max(1, Number(child.qty || child.quantity || 1)) * comboQty,
  }));
};

const Cart = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  totalPrice,
  onClearCart,
  onRemoveRestaurantItems,
  onRemoveItem,
  isBusy = false,
  busyItemIds,
  busyRestaurantIds,
  isClearing = false,
  bookingAddonMode = false,
  bookingRestaurantId = null,
  onBookingAddonComplete,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tickMs, setTickMs] = useState(() => Date.now());

  const formatVND = useCallback(
    (v) => (v || 0).toLocaleString("vi-VN") + "đ",
    [],
  );

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

  const bookingScopedItems = useMemo(
    () => (cart || []).filter((item) => String(item.restaurantId) === String(bookingRestaurantId || "")),
    [bookingRestaurantId, cart],
  );
  const otherRestaurantItems = useMemo(
    () => bookingAddonMode
      ? (cart || []).filter((item) => String(item.restaurantId) !== String(bookingRestaurantId || ""))
      : [],
    [bookingAddonMode, bookingRestaurantId, cart],
  );
  const scopedTotal = useMemo(
    () => bookingScopedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0),
    [bookingScopedItems],
  );
  const scopedItemCount = useMemo(
    () => bookingScopedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [bookingScopedItems],
  );

  useEffect(() => {
    if (!isOpen || !cart?.length) return undefined;
    const intervalId = window.setInterval(() => setTickMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [cart?.length, isOpen]);

  const total = bookingAddonMode
    ? scopedTotal
    : typeof totalPrice === "function" ? totalPrice() : totalPrice || 0;
  const itemCount = bookingAddonMode
    ? scopedItemCount
    : cart?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;
  const expiredHoldExists = useMemo(
    () => hasExpiredHoldItems(bookingAddonMode ? bookingScopedItems : cart, tickMs),
    [bookingAddonMode, bookingScopedItems, cart, tickMs],
  );
  const hasWrongRestaurantItems = bookingAddonMode && otherRestaurantItems.length > 0;
  const hasNoScopedItems = bookingAddonMode && bookingScopedItems.length === 0;
  const hasScopedBusyState =
    busyItemIds !== undefined ||
    busyRestaurantIds !== undefined ||
    typeof isClearing === "boolean";
  const globalBusy = hasScopedBusyState ? false : isBusy;
  const clearingBusy = isClearing || (!hasScopedBusyState && isBusy);
  const bookingAddonDisabled =
    bookingAddonMode &&
    (clearingBusy || globalBusy || hasNoScopedItems || hasWrongRestaurantItems || expiredHoldExists);

  const handleQtyChange = (item, e) => {
    const itemBusy =
      clearingBusy ||
      globalBusy ||
      !!busyItemIds?.[item.cartLineKey || item.id];
    if (itemBusy) return;
    const raw = e.target.value;
    const next = Math.max(1, parseInt(raw || "1", 10));
    const delta = next - (item.quantity || 1);
    if (delta !== 0) onUpdateQuantity?.(item, delta);
  };

  const handleCheckout = () => {
    if (bookingAddonMode) {
      if (bookingAddonDisabled) return;
      onBookingAddonComplete?.();
      return;
    }
    if (clearingBusy || globalBusy || !cart?.length || expiredHoldExists) return;
    const from = `${location.pathname}${location.search || ""}` || "cart";
    navigate("/checkout", { state: { from } });
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
              {bookingAddonMode ? "Giỏ món kèm đặt bàn" : "Giỏ hàng"} <span className="cart-header__count">({itemCount})</span>
            </h3>
            <button onClick={onClose} className="cart-header__close">
              <IconClose />
            </button>
          </div>
          {!!cart?.length && (
            <button
              className="cart-header__clear"
              onClick={() => onClearCart?.()}
              disabled={clearingBusy || globalBusy || !cart?.length}
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
              globalBusy={globalBusy}
              clearingBusy={clearingBusy}
              busyItemIds={busyItemIds}
              busyRestaurantIds={busyRestaurantIds}
              now={tickMs}
            />
          ))}
        </div>
        {!!cart?.length && (
          <div className="cart-footer">
            <div className="cart-footer__row">
              <span className="cart-footer__label">{bookingAddonMode ? "Tạm tính món kèm" : "Tổng thanh toán"}</span>
              <span className="cart-footer__total">{formatVND(total)}</span>
            </div>
            <button
              className="cart-checkout-btn"
              onClick={handleCheckout}
              disabled={bookingAddonMode ? bookingAddonDisabled : clearingBusy || globalBusy || !cart?.length || expiredHoldExists}
              title={
                expiredHoldExists
                  ? "Một số món đã hết thời gian giữ. Vui lòng xóa hoặc thêm lại món."
                  : bookingAddonMode
                    ? "Hoàn tất chọn món kèm và quay lại đặt bàn"
                    : "Tiến hành đặt đơn"
              }
              aria-label={
                expiredHoldExists
                  ? "Không thể đặt đơn vì có món đã hết thời gian giữ"
                  : bookingAddonMode
                    ? "Hoàn tất order kèm theo"
                    : "Đặt đơn ngay"
              }
            >
              {bookingAddonMode ? "Hoàn tất order kèm theo" : "Đặt đơn ngay"}
            </button>
            {hasWrongRestaurantItems && (
              <p className="cart-footer__warning" role="alert">
                Giỏ đang có món từ nhà hàng khác. Vui lòng xóa nhóm không thuộc nhà hàng đặt bàn trước khi hoàn tất order kèm theo.
              </p>
            )}
            {hasNoScopedItems && (
              <p className="cart-footer__warning" role="alert">
                Chưa có món nào của nhà hàng đang đặt bàn.
              </p>
            )}
            {expiredHoldExists && (
              <p className="cart-footer__warning" role="alert">
                Một số món đã hết thời gian giữ. Vui lòng xóa hoặc thêm lại món.
              </p>
            )}
          </div>
        )}
      </div>
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
  globalBusy,
  clearingBusy,
  busyItemIds,
  busyRestaurantIds,
  now,
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
          disabled={
            clearingBusy ||
            globalBusy ||
            !!busyRestaurantIds?.[group.restaurantId]
          }
        >
          <IconTrash />
        </button>
      </div>
      <div className="cart-group__list">
        {group.items.map((item) => {
          const line = (item.price || 0) * (item.quantity || 1);
          const isCombo = isComboCartLine(item);
          const hold = isCombo ? { state: "none", remainingMs: 0 } : getHoldStatus(item, now);
          const modifiers = item.modifiers || item.selectedModifiers || [];
          const variantLabel = isCombo
            ? "Combo bundle"
            : item.servingVariantName ||
              item.servingName ||
              item.method ||
              item.servingMethod ||
              item.servingVariantLabel ||
              item.servingVariantKey ||
              item.servingKey;
          const childItems = isCombo ? getComboChildItems(item) : [];
          const originalPrice = Number(item.comboSnapshot?.originalPrice || 0);
          const unitPrice = Number(item.price || 0);
          const unitSaving = isCombo && originalPrice > unitPrice ? originalPrice - unitPrice : 0;
          const itemBusy =
            clearingBusy ||
            globalBusy ||
            !!busyItemIds?.[item.cartLineKey || item.id];
          return (
            <div
              key={item.cartLineKey || item.id}
              className={`cart-item ${isCombo ? "cart-item--combo" : ""} ${hold.state === "expired" ? "is-expired" : ""}`}
            >
              <div className="cart-item__main">
                <div className="cart-item__info">
                  <h6 className="cart-item__name">
                    {item.name}
                    {isCombo && <span className="cart-item__badge">Combo</span>}
                  </h6>
                  <div className="cart-item__price-unit">
                    {formatVND(item.price)}
                  </div>
                  {!!variantLabel && (
                    <p className="cart-item__meta">Phần: {variantLabel}</p>
                  )}
                  {isCombo && childItems.length > 0 && (
                    <ul className="cart-item__combo-list" aria-label={`Món trong ${item.name}`}>
                      {childItems.map((child) => (
                        <li key={child.key}><span>{child.qty}×</span>{child.name}</li>
                      ))}
                    </ul>
                  )}
                  {isCombo && unitSaving > 0 && (
                    <p className="cart-item__combo-saving">
                      Tiết kiệm {formatVND(unitSaving * Number(item.quantity || 1))}
                    </p>
                  )}
                  {!!item.note && !isCombo && (
                    <p className="cart-item__meta">Ghi chú: {item.note}</p>
                  )}
                  {modifiers.length > 0 && (
                    <p className="cart-item__meta">
                      Topping:{" "}
                      {modifiers
                        .map(
                          (m) =>
                            `${m.optionName || m.name}${m.price ? ` +${formatVND(m.price)}` : ""}`,
                        )
                        .join(", ")}
                    </p>
                  )}
                  {hold.state === "active" && (
                    <p className="cart-item__hold" role="status">
                      Giữ món còn {formatHoldCountdown(hold.remainingMs)}
                    </p>
                  )}
                  {hold.state === "warning" && (
                    <p
                      className="cart-item__hold cart-item__hold--warning"
                      role="alert"
                    >
                      Sắp hết thời gian giữ món:{" "}
                      {formatHoldCountdown(hold.remainingMs)}
                    </p>
                  )}
                  {hold.state === "expired" && (
                    <p
                      className="cart-item__hold cart-item__hold--expired"
                      role="alert"
                    >
                      Giữ món đã hết hạn
                    </p>
                  )}
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
