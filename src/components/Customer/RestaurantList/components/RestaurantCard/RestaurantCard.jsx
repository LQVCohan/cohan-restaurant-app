import React from "react";
import "./RestaurantCard.scss";

const RestaurantCard = ({
  restaurant,
  variant = "grid", // "grid" | "list"
  isFavorited,
  onToggleFavorite,
  onMakeReservation,
  onViewDetails,
}) => {
  // --- HELPERS ---
  const getStatusInfo = (status) => {
    switch (status) {
      case "open":
        return { text: "Đang mở", class: "open" };
      case "closed":
        return { text: "Đã đóng", class: "closed" };
      case "break":
        return { text: "Nghỉ trưa", class: "break" };
      default:
        return { text: "Chưa rõ", class: "unknown" };
    }
  };

  const renderBadges = (badges = []) => {
    return badges.map((badge) => {
      if (badge === "featured")
        return (
          <span key={badge} className="badge badge--featured">
            ⭐ Nổi bật
          </span>
        );
      if (badge === "new")
        return (
          <span key={badge} className="badge badge--new">
            🆕 Mới
          </span>
        );
      if (badge === "promotion")
        return (
          <span key={badge} className="badge badge--promo">
            💎 Khuyến mãi
          </span>
        );
      return null;
    });
  };

  const statusInfo = getStatusInfo(restaurant.status);
  const addressText = [restaurant.district, restaurant.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`restaurant-card ${
        variant === "list" ? "restaurant-card--list" : ""
      }`}
      onClick={() => onViewDetails(restaurant.id)}
    >
      {/* 1. KHU VỰC ẢNH */}
      <div className="restaurant-card__image-wrapper">
        <img
          src={restaurant.image || "/default-restaurant.jpg"}
          alt={restaurant.name}
          className="restaurant-card__img"
          loading="lazy"
        />

        {/* Badges & Favorite Overlay */}
        <div className="restaurant-card__badges-top">
          {renderBadges(restaurant.badges)}
        </div>

        <button
          type="button"
          className={`btn-favorite ${isFavorited ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(e, restaurant.id);
          }}
          title={isFavorited ? "Bỏ thích" : "Yêu thích"}
        >
          {isFavorited ? "❤️" : "🤍"}
        </button>
      </div>

      {/* 2. KHU VỰC NỘI DUNG */}
      <div className="restaurant-card__content">
        {/* Cột Thông tin (Chính) */}
        <div className="info-section">
          <div className="content-header">
            <h3 className="restaurant-name" title={restaurant.name}>
              {restaurant.name}
            </h3>
            <span className={`status-pill ${statusInfo.class}`}>
              {statusInfo.text}
            </span>
          </div>

          <div className="content-meta">
            <div className="meta-item rating">
              ⭐ <span>{restaurant.avgRating || 0}</span>
              <span className="count">({restaurant.ratingCount || 0}+)</span>
            </div>
            <div className="dot"></div>
            <div className="meta-item cuisine">
              🍽️ {restaurant.cuisine || "Đa dạng"}
            </div>
            {restaurant.priceRange && (
              <>
                <div className="dot"></div>
                <div className="meta-item price">{restaurant.priceRange}</div>
              </>
            )}
          </div>

          <p className="restaurant-desc">
            {restaurant.description ||
              "Nhà hàng phục vụ các món ăn ngon, không gian thoáng mát, phù hợp cho gia đình và bạn bè."}
          </p>

          {/* Địa chỉ (Chỉ hiện ở cột này khi là List View) */}
          <div className="address-info list-only">
            <span className="icon">📍</span>{" "}
            <span className="text">{addressText}</span>
          </div>
        </div>

        {/* Cột Hành động / Footer */}
        <div className="action-section">
          {/* Địa chỉ (Chỉ hiện ở cột này khi là Grid View - Footer style) */}
          <div className="address-info grid-only">
            <span className="icon">📍</span>{" "}
            <span className="text">{addressText}</span>
          </div>

          <div className="buttons-group">
            <button
              type="button"
              className="btn btn-outline"
              onClick={(e) => onMakeReservation(e, restaurant.id)}
            >
              Đặt bàn
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(restaurant.id);
              }}
            >
              Xem ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
