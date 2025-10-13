import React from "react";
import "./MenuItemCard.scss";

const MenuItemCard = ({ item, onEdit, onDelete, viewMode = "grid" }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const getMinMaxPrice = () => {
    const prices = item.preparationMethods.map((m) => m.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return minPrice === maxPrice
      ? formatPrice(minPrice)
      : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
  };

  const handleCardClick = (e) => {
    // Prevent card click when clicking action buttons
    if (e.target.closest(".menu-item-card__actions")) {
      return;
    }
    onEdit();
  };

  if (viewMode === "list") {
    return (
      <div
        className="menu-item-card menu-item-card--list"
        onClick={handleCardClick}
      >
        <div className="menu-item-card__image">{item.image || "🍽️"}</div>

        <div className="menu-item-card__content">
          <div className="menu-item-card__header">
            <div className="menu-item-card__info">
              <h3 className="menu-item-card__name">{item.name}</h3>
              <p className="menu-item-card__category">{item.category}</p>
            </div>

            <div className="menu-item-card__status-price">
              <div
                className={`menu-item-card__status ${
                  item.status === "available"
                    ? "menu-item-card__status--available"
                    : "menu-item-card__status--unavailable"
                }`}
              >
                {item.status === "available" ? "✅ Có sẵn" : "❌ Hết"}
              </div>
              <div className="menu-item-card__price">{getMinMaxPrice()}</div>
            </div>
          </div>

          <div className="menu-item-card__description">{item.description}</div>

          <div className="menu-item-card__methods">
            {item.methods.map((method, index) => (
              <span key={index} className="method-tag">
                {method.name}
              </span>
            ))}
          </div>
        </div>

        <div className="menu-item-card__actions">
          <button
            className="action-btn action-btn--edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Chỉnh sửa"
          >
            ✏️
          </button>
          <button
            className="action-btn action-btn--delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Xóa"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="menu-item-card menu-item-card--grid"
      onClick={handleCardClick}
    >
      <div className="menu-item-card__image">{item.image || "🍽️"}</div>

      <div className="menu-item-card__content">
        <div className="menu-item-card__header">
          <div className="menu-item-card__info">
            <h3 className="menu-item-card__name">{item.name}</h3>
            <p className="menu-item-card__category">{item.category}</p>
          </div>

          <div
            className={`menu-item-card__status ${
              item.status === "available"
                ? "menu-item-card__status--available"
                : "menu-item-card__status--unavailable"
            }`}
          >
            {item.status === "available" ? "✅ Có sẵn" : "❌ Hết"}
          </div>
        </div>

        <div className="menu-item-card__price">{getMinMaxPrice()}</div>

        <div className="menu-item-card__methods">
          {item.preparationMethods.map((method, index) => (
            <span key={index} className="method-tag">
              {method.name}
            </span>
          ))}
        </div>
      </div>

      <div className="menu-item-card__actions">
        <button
          className="action-btn action-btn--edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Chỉnh sửa"
        >
          ✏️
        </button>
        <button
          className="action-btn action-btn--delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Xóa"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default MenuItemCard;
