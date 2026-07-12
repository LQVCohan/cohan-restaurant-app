import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import { formatCurrency } from "../../../../utils/formatters";
import { calculatePromotionPricePreview } from "../../../../hooks/useActiveMenuPromotions";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
} from "../../../../utils/customerFoodNavigation";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
} from "../../../../utils/menuItemAvailability";
import "../styles/MenuItemCard.scss";
import "../styles/MenuItemPromotionPrice.scss";

const MENU_ITEM_PLACEHOLDER = "/default-dishes.jpg";

const getMenuItemPrices = (item = {}) => {
  const variantPrices = (item.servingVariants || [])
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (variantPrices.length) return variantPrices;
  const basePrice = Number(item.basePrice);
  return Number.isFinite(basePrice) && basePrice >= 0 ? [basePrice] : [0];
};

export const getMenuItemPriceLabel = (item = {}, prices = getMenuItemPrices(item)) => {
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum
    ? formatCurrency(minimum)
    : `Từ ${formatCurrency(minimum)}`;
};

export const getMenuItemPricePresentation = (item = {}) => {
  const prices = getMenuItemPrices(item);
  const originalLabel = getMenuItemPriceLabel(item, prices);
  const previews = prices.map((price) =>
    calculatePromotionPricePreview(item.promotion, price, 1),
  );
  const discountedPrices = previews.map((preview) => preview.finalTotal);
  const hasImmediateDiscount = previews.some((preview) => preview.discount > 0);

  return {
    originalLabel,
    discountedLabel: hasImmediateDiscount
      ? getMenuItemPriceLabel(item, discountedPrices)
      : originalLabel,
    hasImmediateDiscount,
  };
};

const MenuItemCard = ({ item, to, state, onClick, disabled = false }) => {
  const foodPreferenceMeta = item?.foodPreferenceMeta;
  const availability = getMenuItemAvailability(item);
  const canOrderNow = canCustomerOrderMenuItem(item) && !disabled;
  const imageSrc = item?.thumbImage || MENU_ITEM_PLACEHOLDER;
  const pricePresentation = getMenuItemPricePresentation(item);
  const maxAvailable = Number(item?.maxAvailable);
  const lowStockLabel =
    canOrderNow &&
    Number.isFinite(maxAvailable) &&
    maxAvailable > 0 &&
    maxAvailable <= 5
      ? `Chỉ còn ${maxAvailable.toLocaleString("vi-VN", {
          maximumFractionDigits: 1,
        })} suất`
      : null;
  const defaultState =
    state ||
    buildFoodDetailState(item, {
      restaurantId: item?.restaurantId,
      categoryId: item?.categoryId,
      selectedVariantKey:
        item?.defaultServingKey ||
        item?.servingVariants?.find((variant) => variant?.isDefault)?.key ||
        item?.servingVariants?.[0]?.key ||
        null,
    });
  const detailPath =
    to || buildFoodDetailPath(item?.id, defaultState) || "/cus-menu";

  const handleClick = (event) => {
    const plainPrimaryClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (!onClick || !plainPrimaryClick) return;

    event.preventDefault();
    onClick(item);
  };

  return (
    <Link
      className={`item-card ${!canOrderNow ? "inactive" : ""}`}
      to={detailPath}
      state={defaultState}
      onClick={handleClick}
      aria-label={`Xem chi tiết ${item.name}${
        canOrderNow ? "" : `, ${availability.label}`
      }`}
    >
      <div className="thumb">
        <img
          src={imageSrc}
          alt={item.name || "Món ăn"}
          width="800"
          height="600"
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = MENU_ITEM_PLACEHOLDER;
          }}
        />
        {!canOrderNow ? (
          <span className="badge">{availability.label}</span>
        ) : null}
        {item.promotionLabel ? (
          <span
            className="menu-item-card__promo-badge"
            title={item.promotion?.name || "Ưu đãi"}
          >
            {item.promotionLabel}
          </span>
        ) : null}
      </div>

      <div className="details">
        <h4 title={item.name}>{item.name}</h4>
        {item.promotion?.name ? (
          <div className="menu-item-card__promo-name">
            {item.promotion.name}
          </div>
        ) : null}

        {foodPreferenceMeta?.hasAllergyWarning ? (
          <div
            className="food-preference-badge food-preference-badge--warning"
            title={
              foodPreferenceMeta.warningReason ||
              `Có thể chứa: ${(foodPreferenceMeta.matchedAllergies || []).join(", ")}`
            }
          >
            <TriangleAlert size={14} aria-hidden="true" />
            Cần kiểm tra dị ứng
          </div>
        ) : foodPreferenceMeta?.isRecommended ? (
          <div
            className="food-preference-badge food-preference-badge--match"
            title={
              (foodPreferenceMeta.reasons || []).join(". ") ||
              "Phù hợp khẩu vị của bạn"
            }
          >
            <Sparkles size={14} aria-hidden="true" />
            Phù hợp khẩu vị
          </div>
        ) : null}

        <p title={item.description || ""}>
          {item.description || "Nhà hàng chưa cập nhật mô tả cho món này."}
        </p>

        <div className="menu-item-card__meta">
          {Number(item.avgPrepTimeMin) > 0 ? (
            <span>
              <Clock3 size={14} aria-hidden="true" /> {item.avgPrepTimeMin} phút
            </span>
          ) : null}
          {item.servingVariants?.length > 1 ? (
            <span>{item.servingVariants.length} lựa chọn</span>
          ) : null}
          {lowStockLabel ? (
            <span className="menu-item-card__low-stock">{lowStockLabel}</span>
          ) : null}
        </div>

        <div className="bottom">
          <span className="menu-item-card__price-group">
            {pricePresentation.hasImmediateDiscount ? (
              <span className="menu-item-card__original-price">
                {pricePresentation.originalLabel}
              </span>
            ) : null}
            <span className="price">{pricePresentation.discountedLabel}</span>
          </span>
          <span className="add-btn" aria-hidden="true">
            {canOrderNow ? "Chọn món" : "Xem chi tiết"}
            <ChevronRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default MenuItemCard;
