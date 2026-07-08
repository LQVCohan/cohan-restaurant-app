import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isHoldExpired } from "@/hooks/useCart";
import "../../../../styles/Homepage/Cart.scss";

const DEFAULT_DISH_IMAGE = "/default-dishes.jpg";

const IconClose = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const IconTrash = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
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
    aria-hidden="true"
  >
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
  </svg>
);

const IconEmpty = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

export const formatHoldCountdown = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
    totalSeconds % 60,
  ).padStart(2, "0")}`;
};

export const formatServingLabel = (value) => {
  const label = String(value || "").trim();
  if (!label) return "";
  const normalized = label.toLowerCase();
  if (["portion", "standard", "default"].includes(normalized)) {
    return "Phần tiêu chuẩn";
  }
  return label;
};

export const getHoldStatus = (item, now = Date.now()) => {
  if (!item?.holdExpiresAt) return { state: "none", remainingMs: 0 };
  const normalizedHoldStatus = String(
    item.holdStatus || "active",
  ).toLowerCase();
  if (normalizedHoldStatus !== "active") {
    return { state: "expired", remainingMs: 0 };
  }
  const expiresAt = new Date(item.holdExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) {
    return { state: "none", remainingMs: 0 };
  }
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0 || isHoldExpired(item, now)) {
    return { state: "expired", remainingMs: 0 };
  }
  if (remainingMs < 60_000) return { state: "warning", remainingMs };
  return { state: "active", remainingMs };
};

export const hasExpiredHoldItems = (cart = [], now = Date.now()) =>
  (cart || []).some(
    (item) => getHoldStatus(item, now).state === "expired",
  );

const isComboCartLine = (item = {}) =>
  String(item.itemType || item.kind || item.type || "").toUpperCase() ===
    "COMBO" || Boolean(item.comboId || item.comboSnapshot);

const getComboChildItems = (item = {}) => {
  const snapshotItems = Array.isArray(item.comboSnapshot?.items)
    ? item.comboSnapshot.items
    : [];
  const comboQuantity = Math.max(1, Number(item.quantity || 1));
  return snapshotItems.map((child, index) => ({
    key:
      child.menuItemId ||
      child.id ||
      `${child.name || "combo-item"}-${index}`,
    name: child.name || "Món trong combo",
    qty:
      Math.max(1, Number(child.qty || child.quantity || 1)) * comboQuantity,
  }));
};

export const getCartItemUnitPrice = (item = {}) =>
  Number(item.price || 0) + Number(item.modifiersPrice || 0);

export const getCartItemLineTotal = (item = {}) =>
  getCartItemUnitPrice(item) * Math.max(1, Number(item.quantity || 1));

const getModifierAmount = (modifier = {}) =>
  Number(modifier.priceRule?.amount ?? modifier.price ?? 0);

const getModifierLabel = (modifier, formatVND) => {
  const amount = getModifierAmount(modifier);
  const name = modifier.optionName || modifier.name || "Tùy chọn";
  if (!amount) return name;
  const prefix = amount > 0 ? "+" : "−";
  return `${name} ${prefix}${formatVND(Math.abs(amount))}`;
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
    (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`,
    [],
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of cart || []) {
      const restaurantId = item.restaurantId || "unknown";
      const restaurantName =
        item.restaurantName ||
        item.restaurant?.name ||
        item.comboSnapshot?.restaurantName ||
        null;
      if (!map.has(restaurantId)) {
        map.set(restaurantId, {
          restaurantId,
          restaurantName,
          items: [],
          subtotal: 0,
        });
      }
      const group = map.get(restaurantId);
      if (!group.restaurantName && restaurantName) {
        group.restaurantName = restaurantName;
      }
      group.items.push(item);
      group.subtotal += getCartItemLineTotal(item);
    }
    return Array.from(map.values());
  }, [cart]);

  const bookingScopedItems = useMemo(
    () =>
      (cart || []).filter(
        (item) =>
          String(item.restaurantId) === String(bookingRestaurantId || ""),
      ),
    [bookingRestaurantId, cart],
  );
  const otherRestaurantItems = useMemo(
    () =>
      bookingAddonMode
        ? (cart || []).filter(
            (item) =>
              String(item.restaurantId) !==
              String(bookingRestaurantId || ""),
          )
        : [],
    [bookingAddonMode, bookingRestaurantId, cart],
  );
  const scopedTotal = useMemo(
    () =>
      bookingScopedItems.reduce(
        (sum, item) => sum + getCartItemLineTotal(item),
        0,
      ),
    [bookingScopedItems],
  );
  const scopedItemCount = useMemo(
    () =>
      bookingScopedItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
    [bookingScopedItems],
  );

  useEffect(() => {
    if (!isOpen || !cart?.length) return undefined;
    const intervalId = window.setInterval(() => setTickMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [cart?.length, isOpen]);

  const total = bookingAddonMode
    ? scopedTotal
    : typeof totalPrice === "function"
      ? totalPrice()
      : totalPrice || 0;
  const itemCount = bookingAddonMode
    ? scopedItemCount
    : cart?.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ) || 0;
  const expiredHoldExists = useMemo(
    () =>
      hasExpiredHoldItems(
        bookingAddonMode ? bookingScopedItems : cart,
        tickMs,
      ),
    [bookingAddonMode, bookingScopedItems, cart, tickMs],
  );
  const hasWrongRestaurantItems =
    bookingAddonMode && otherRestaurantItems.length > 0;
  const hasNoScopedItems =
    bookingAddonMode && bookingScopedItems.length === 0;
  const hasScopedBusyState =
    busyItemIds !== undefined ||
    busyRestaurantIds !== undefined ||
    typeof isClearing === "boolean";
  const globalBusy = hasScopedBusyState ? false : isBusy;
  const clearingBusy = isClearing || (!hasScopedBusyState && isBusy);
  const bookingAddonDisabled =
    bookingAddonMode &&
    (clearingBusy ||
      globalBusy ||
      hasNoScopedItems ||
      hasWrongRestaurantItems ||
      expiredHoldExists);

  const handleQuantityInput = (item, event) => {
    const itemBusy =
      clearingBusy ||
      globalBusy ||
      Boolean(busyItemIds?.[item.cartLineKey || item.id]);
    if (itemBusy) return;
    const next = Math.max(1, Number.parseInt(event.target.value || "1", 10));
    const delta = next - Number(item.quantity || 1);
    if (delta !== 0) onUpdateQuantity?.(item, delta);
  };

  const handleCheckout = () => {
    if (bookingAddonMode) {
      if (!bookingAddonDisabled) onBookingAddonComplete?.();
      return;
    }
    if (clearingBusy || globalBusy || !cart?.length || expiredHoldExists) {
      return;
    }
    const from = `${location.pathname}${location.search || ""}` || "cart";
    navigate("/checkout", { state: { from } });
  };

  return (
    <>
      <div
        className={`cart-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`cart-panel ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal={isOpen ? "true" : undefined}
        aria-labelledby="cart-drawer-title"
        aria-hidden={!isOpen}
      >
        <header className="cart-header">
          <div className="cart-header__top">
            <div className="cart-header__copy">
              <div className="cart-header__title-row">
                <h3 id="cart-drawer-title" className="cart-header__title">
                  {bookingAddonMode ? "Món kèm đặt bàn" : "Giỏ hàng"}
                </h3>
                <span className="cart-header__count" aria-live="polite">
                  {itemCount} món
                </span>
              </div>
              <p className="cart-header__subtitle">
                Kiểm tra món và thời gian giữ trước khi tiếp tục.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cart-header__close"
              aria-label="Đóng giỏ hàng"
            >
              <IconClose />
            </button>
          </div>
          {cart?.length ? (
            <button
              type="button"
              className="cart-header__clear"
              onClick={() => onClearCart?.()}
              disabled={clearingBusy || globalBusy}
            >
              <IconTrash size={14} />
              Xóa giỏ hàng
            </button>
          ) : null}
        </header>

        <div className="cart-body">
          {!cart?.length ? (
            <div className="cart-empty">
              <div className="cart-empty__icon">
                <IconEmpty />
              </div>
              <div className="cart-empty__copy">
                <h4>Giỏ hàng đang trống</h4>
                <p>Chọn món yêu thích để bắt đầu đơn hàng.</p>
              </div>
              <button
                type="button"
                className="cart-empty__btn"
                onClick={onClose}
              >
                Xem thực đơn
              </button>
            </div>
          ) : null}

          {groups.map((group) => (
            <RestaurantGroup
              key={group.restaurantId}
              group={group}
              formatVND={formatVND}
              onUpdateQuantity={onUpdateQuantity}
              onQtyChange={handleQuantityInput}
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

        {cart?.length ? (
          <footer className="cart-footer">
            <div className="cart-footer__row">
              <div>
                <span className="cart-footer__label">
                  {bookingAddonMode ? "Tạm tính món kèm" : "Tạm tính"}
                </span>
                <span className="cart-footer__item-count">{itemCount} món</span>
              </div>
              <span className="cart-footer__total">
                {formatVND(total)}
              </span>
            </div>
            <p className="cart-footer__note">
              {bookingAddonMode
                ? "Món đã chọn sẽ được thêm vào đơn đặt bàn."
                : "Ưu đãi và khoản phí (nếu có) được xác nhận ở bước tiếp theo."}
            </p>
            <button
              type="button"
              className="cart-checkout-btn"
              onClick={handleCheckout}
              disabled={
                bookingAddonMode
                  ? bookingAddonDisabled
                  : clearingBusy ||
                    globalBusy ||
                    !cart?.length ||
                    expiredHoldExists
              }
              title={
                expiredHoldExists
                  ? "Một số món đã hết thời gian giữ. Hãy xóa hoặc thêm lại món."
                  : bookingAddonMode
                    ? "Hoàn tất chọn món và quay lại đặt bàn"
                    : "Sang bước thanh toán"
              }
            >
              <span>
                {bookingAddonMode
                  ? "Hoàn tất chọn món"
                  : "Tiếp tục thanh toán"}
              </span>
              <span aria-hidden="true">→</span>
            </button>
            {hasWrongRestaurantItems ? (
              <p className="cart-footer__warning" role="alert">
                Giỏ có món từ nhà hàng khác. Hãy xóa nhóm đó trước khi hoàn tất
                chọn món.
              </p>
            ) : null}
            {hasNoScopedItems ? (
              <p className="cart-footer__warning" role="alert">
                Bạn chưa chọn món của nhà hàng đang đặt bàn.
              </p>
            ) : null}
            {expiredHoldExists ? (
              <p className="cart-footer__warning" role="alert">
                Một số món đã hết thời gian giữ. Hãy xóa hoặc thêm lại trước khi
                tiếp tục.
              </p>
            ) : null}
          </footer>
        ) : null}
      </aside>
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
  const name = group.restaurantName || "Nhà hàng đã chọn";
  const headingId = `cart-group-${group.restaurantId}`;

  return (
    <section className="cart-group" aria-labelledby={headingId}>
      <div className="cart-group__header">
        <div className="cart-group__store-info">
          <span className="cart-group__store-icon">
            <IconStore />
          </span>
          <div>
            <span className="cart-group__eyebrow">Đặt món tại</span>
            <h4 id={headingId} className="cart-group__name">
              {name}
            </h4>
          </div>
        </div>
        <button
          type="button"
          className="cart-group__clear"
          onClick={() => onRemoveRestaurantItems?.(group.restaurantId)}
          aria-label={`Xóa tất cả món của ${name}`}
          disabled={
            clearingBusy ||
            globalBusy ||
            Boolean(busyRestaurantIds?.[group.restaurantId])
          }
        >
          <IconTrash size={14} />
          <span>Xóa nhóm</span>
        </button>
      </div>

      <div className="cart-group__list">
        {group.items.map((item) => {
          const line = getCartItemLineTotal(item);
          const isCombo = isComboCartLine(item);
          const hold = isCombo
            ? { state: "none", remainingMs: 0 }
            : getHoldStatus(item, now);
          const modifiers = item.modifiers || item.selectedModifiers || [];
          const rawVariantLabel = isCombo
            ? ""
            : item.servingVariantName ||
              item.servingName ||
              item.method ||
              item.servingMethod ||
              item.servingVariantLabel ||
              item.servingVariantKey ||
              item.servingKey;
          const variantLabel = formatServingLabel(rawVariantLabel);
          const childItems = isCombo ? getComboChildItems(item) : [];
          const originalPrice = Number(
            item.comboSnapshot?.originalPrice || 0,
          );
          const unitPrice = getCartItemUnitPrice(item);
          const unitSaving =
            isCombo && originalPrice > unitPrice
              ? originalPrice - unitPrice
              : 0;
          const itemBusy =
            clearingBusy ||
            globalBusy ||
            Boolean(busyItemIds?.[item.cartLineKey || item.id]);
          const image =
            item.image ||
            item.thumbImage ||
            item.comboSnapshot?.imageUrl ||
            DEFAULT_DISH_IMAGE;

          return (
            <article
              key={item.cartLineKey || item.backendCartItemId || item.id}
              className={`cart-item ${isCombo ? "cart-item--combo" : ""} ${
                hold.state === "expired" ? "is-expired" : ""
              }`}
            >
              <div className="cart-item__product">
                <img
                  className="cart-item__image"
                  src={image}
                  alt={item.name || "Món ăn"}
                  loading="lazy"
                />
                <div className="cart-item__info">
                  <div className="cart-item__heading">
                    <h5 className="cart-item__name">
                      {item.name || "Món ăn"}
                      {isCombo ? (
                        <span className="cart-item__badge">Combo</span>
                      ) : null}
                    </h5>
                    <button
                      type="button"
                      onClick={() => onRemoveItem?.(item)}
                      className="cart-item__remove"
                      title="Xóa món"
                      aria-label={`Xóa ${item.name || "món ăn"}`}
                      disabled={itemBusy}
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>

                  <div className="cart-item__price-unit">
                    {formatVND(unitPrice)}
                    <span> / {isCombo ? "combo" : "phần"}</span>
                  </div>

                  {variantLabel ? (
                    <p className="cart-item__meta">
                      <span>Khẩu phần</span>
                      {variantLabel}
                    </p>
                  ) : null}

                  {isCombo && childItems.length ? (
                    <ul
                      className="cart-item__combo-list"
                      aria-label={`Món trong ${item.name}`}
                    >
                      {childItems.map((child) => (
                        <li key={child.key}>
                          <span>{child.qty}×</span>
                          {child.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {isCombo && unitSaving > 0 ? (
                    <p className="cart-item__combo-saving">
                      Tiết kiệm {formatVND(unitSaving * Number(item.quantity || 1))}
                    </p>
                  ) : null}

                  {item.note && !isCombo ? (
                    <p className="cart-item__meta">
                      <span>Ghi chú</span>
                      {item.note}
                    </p>
                  ) : null}

                  {modifiers.length ? (
                    <p className="cart-item__meta">
                      <span>Tùy chọn</span>
                      {modifiers
                        .map((modifier) =>
                          getModifierLabel(modifier, formatVND),
                        )
                        .join(", ")}
                    </p>
                  ) : null}

                  {hold.state === "active" ? (
                    <p className="cart-item__hold" role="status">
                      Đang giữ món · còn {formatHoldCountdown(hold.remainingMs)}
                    </p>
                  ) : null}
                  {hold.state === "warning" ? (
                    <p
                      className="cart-item__hold cart-item__hold--warning"
                      role="alert"
                    >
                      Sắp hết thời gian giữ · {formatHoldCountdown(hold.remainingMs)}
                    </p>
                  ) : null}
                  {hold.state === "expired" ? (
                    <p
                      className="cart-item__hold cart-item__hold--expired"
                      role="alert"
                    >
                      Đã hết thời gian giữ
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="cart-item__actions">
                <div className="cart-qty" aria-label={`Số lượng ${item.name}`}>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity?.(item, -1)}
                    className="cart-qty__btn"
                    aria-label={`Giảm số lượng ${item.name}`}
                    disabled={itemBusy || Number(item.quantity || 1) <= 1}
                  >
                    −
                  </button>
                  <input
                    className="cart-qty__input"
                    type="number"
                    min="1"
                    value={item.quantity}
                    aria-label={`Số lượng ${item.name}`}
                    onChange={(event) => onQtyChange(item, event)}
                    disabled={itemBusy}
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity?.(item, 1)}
                    className="cart-qty__btn"
                    aria-label={`Tăng số lượng ${item.name}`}
                    disabled={itemBusy}
                  >
                    +
                  </button>
                </div>
                <div className="cart-item__line-summary">
                  <span>Thành tiền</span>
                  <strong>{formatVND(line)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="cart-group__subtotal">
        <span>Tạm tính tại nhà hàng</span>
        <strong>{formatVND(group.subtotal)}</strong>
      </div>
    </section>
  );
}

export default Cart;
