// src/components/Customer/RestaurantMenu/components/MenuItemCard.jsx
import React from "react";
import { formatCurrency } from "../../../../utils/formatters";
import { canCustomerOrderMenuItem, getMenuItemAvailability } from "../../../../utils/menuItemAvailability";
import "../styles/MenuItemCard.scss";

const MENU_ITEM_PLACEHOLDER = "/default-dishes.jpg";

const MenuItemCard = ({ item, onClick, disabled = false }) => {
  const foodPreferenceMeta = item?.foodPreferenceMeta;
  const availability = getMenuItemAvailability(item);
  const isOrderable = canCustomerOrderMenuItem(item) && !disabled;
  const imageSrc = item?.thumbImage || MENU_ITEM_PLACEHOLDER;
  const variantPrices = (item?.servingVariants || [])
    .map((variant) => Number(variant?.price))
    .filter(Number.isFinite);
  const displayPrice = variantPrices.length
    ? Math.min(...variantPrices)
    : Number(item?.basePrice || 0);
  const hasPriceRange = variantPrices.length > 1 && new Set(variantPrices).size > 1;

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = MENU_ITEM_PLACEHOLDER;
  };

  const handleOpen = () => onClick?.(item);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      className={`item-card ${!isOrderable ? "inactive" : ""}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết ${item.name}${isOrderable ? "" : `, ${availability.label.toLowerCase()}`}`}
    >
      <div className="thumb">
        <img
          src={imageSrc}
          alt={item.name || "Món ăn Cohan"}
          loading="lazy"
          onError={handleImageError}
        />
        {!isOrderable && <span className="badge">{availability.label}</span>}
        {item.promotionLabel && (
          <span
            className="menu-item-card__promo-badge"
            title={item.promotion?.name || "Ưu đãi"}
          >
            {item.promotionLabel}
          </span>
        )}
      </div>
      <div className="details">
        <h4 title={item.name}>{item.name}</h4>
        {item.promotion?.name && (
          <div className="menu-item-card__promo-name">{item.promotion.name}</div>
        )}
        {foodPreferenceMeta?.hasAllergyWarning ? (
          <div
            className="food-preference-badge food-preference-badge--warning"
            title={foodPreferenceMeta.warningReason || `Có thể chứa: ${(foodPreferenceMeta.matchedAllergies || []).join(", ")}`}
          >
            ⚠ Cần kiểm tra dị ứng
          </div>
        ) : foodPreferenceMeta?.isRecommended ? (
          <div
            className="food-preference-badge food-preference-badge--match"
            title={(foodPreferenceMeta.reasons || []).join(". ") || "Phù hợp khẩu vị của bạn"}
          >
            ✨ Phù hợp khẩu vị
          </div>
        ) : null}
        <p title={item.description}>{item.description || "Thông tin món đang được cập nhật."}</p>
        {item.servingVariants?.length > 0 && (
          <div className="variants">
            {item.servingVariants.map((variant) => (
              <span key={variant.key || variant.name}>{variant.name}</span>
            ))}
          </div>
        )}
        <div className="bottom">
          <span className="price">
            {hasPriceRange ? "Từ " : ""}{formatCurrency(displayPrice)}
          </span>
          <span className="add-btn" aria-hidden="true">
            Xem chi tiết
          </span>
        </div>
      </div>
    </article>
  );
};

export default MenuItemCard;
