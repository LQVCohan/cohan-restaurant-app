import React from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { formatCurrency } from "../../../../utils/formatters";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
} from "../../../../utils/menuItemAvailability";
import "../styles/MenuItemCard.scss";

const MENU_ITEM_PLACEHOLDER = "/default-dishes.jpg";

export const getMenuItemPriceLabel = (item = {}) => {
  const prices = (item.servingVariants || [])
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  if (!prices.length) return formatCurrency(item.basePrice);

  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum
    ? formatCurrency(minimum)
    : `Từ ${formatCurrency(minimum)}`;
};

const MenuItemCard = ({ item, to, state, disabled = false }) => {
  const foodPreferenceMeta = item?.foodPreferenceMeta;
  const availability = getMenuItemAvailability(item);
  const canOrderNow = canCustomerOrderMenuItem(item) && !disabled;
  const imageSrc = item?.thumbImage || MENU_ITEM_PLACEHOLDER;
  const detailPath = to || (item?.id ? `/food/${encodeURIComponent(item.id)}` : "/cus-menu");

  return (
    <Link
      className={`item-card ${!canOrderNow ? "inactive" : ""}`}
      to={detailPath}
      state={state}
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
        {!canOrderNow ? <span className="badge">{availability.label}</span> : null}
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
          <div className="menu-item-card__promo-name">{item.promotion.name}</div>
        ) : null}

        {foodPreferenceMeta?.hasAllergyWarning ? (
          <div
            className="food-preference-badge food-preference-badge--warning"
            title={
              foodPreferenceMeta.warningReason ||
              `Có thể chứa: ${(foodPreferenceMeta.matchedAllergies || []).join(", ")}`
            }
          >
            ⚠ Cần kiểm tra dị ứng
          </div>
        ) : foodPreferenceMeta?.isRecommended ? (
          <div
            className="food-preference-badge food-preference-badge--match"
            title={
              (foodPreferenceMeta.reasons || []).join(". ") ||
              "Phù hợp khẩu vị của bạn"
            }
          >
            ✨ Phù hợp khẩu vị
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
        </div>

        <div className="bottom">
          <span className="price">{getMenuItemPriceLabel(item)}</span>
          <span className="add-btn" aria-hidden="true">
            {canOrderNow ? "Chọn món" : "Xem chi tiết"}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default MenuItemCard;
