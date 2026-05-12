// src/components/Customer/RestaurantMenu/components/MenuItemCard.jsx
import React from "react";
import { formatCurrency } from "../../../../utils/formatters";
import "../styles/MenuItemCard.scss";
const MenuItemCard = ({ item, onClick }) => {
  const handleImageError = (e) => {
    e.target.src = "https://placehold.co/600x400/e2e8f0/94a3b8?text=Food+Image";
  };
  return (
    <div
      className={`item-card ${item.status === "inactive" ? "inactive" : ""}`}
      onClick={() => item.status !== "inactive" && onClick(item)}
    >
      <div className="thumb">
        <img
          src={item.thumbImage}
          alt={item.name}
          loading="lazy"
          onError={handleImageError}
        />
        {item.status === "inactive" && <span className="badge">Hết hàng</span>}
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
        <p title={item.description}>{item.description}</p>
        {item.servingVariants?.length > 0 && (
          <div className="variants">
            {item.servingVariants.map((v, i) => (
              <span key={i}>{v.name}</span>
            ))}
          </div>
        )}
        <div className="bottom">
          <span className="price">{formatCurrency(item.basePrice)}</span>
          <button className="add-btn">+</button>
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
