import React from "react";
import "./RestaurantCard.scss";
import {
  getOpeningStatusLabel,
  canShowReservationButton,
  getRestaurantPrimaryCTA,
} from "@/utils/restaurantStatus";

const RestaurantCard = ({
  restaurant,
  variant = "grid",
  isFavorited,
  onToggleFavorite,
  onMakeReservation,
  onViewDetails,
}) => {
  const addressText = [restaurant?.address?.district || restaurant.district, restaurant?.address?.city || restaurant.city]
    .filter(Boolean)
    .join(", ");

  const hasReviews = Number(restaurant.reviewCount || 0) > 0;

  return (
    <div
      className={`restaurant-card ${variant === "list" ? "restaurant-card--list" : ""}`}
      onClick={() => onViewDetails(restaurant.id)}
    >
      <div className="restaurant-card__image-wrapper">
        <img
          src={restaurant.image || restaurant.coverImage || restaurant.avatar || "/default-restaurant.jpg"}
          alt={restaurant.name}
          className="restaurant-card__img"
          loading="lazy"
        />

        <button
          type="button"
          className={`btn-favorite ${isFavorited ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(e, restaurant.id);
          }}
        >
          {isFavorited ? "❤️" : "🤍"}
        </button>
      </div>

      <div className="restaurant-card__content">
        <div className="info-section">
          <div className="content-header">
            <h3 className="restaurant-name">{restaurant.name}</h3>
            <span className="status-pill">{getOpeningStatusLabel(restaurant.openingStatus)}</span>
          </div>

          <div className="content-meta">
            <div className="meta-item rating">
              ⭐ {hasReviews ? Number(restaurant.avgRating || 0).toFixed(1) : "Chưa có đánh giá"}
              {hasReviews && <span className="count">({restaurant.reviewCount})</span>}
            </div>
          </div>

          <p className="restaurant-desc">{restaurant.description || "Thông tin đang được cập nhật"}</p>
          <div className="address-info">
            <span className="text">{addressText}</span>
          </div>
        </div>

        <div className="action-section">
          <div className="buttons-group">
            <button
              type="button"
              className="btn btn-outline"
              disabled={!canShowReservationButton(restaurant)}
              onClick={(e) => {
                e.stopPropagation();
                if (canShowReservationButton(restaurant)) onMakeReservation(e, restaurant.id);
              }}
            >
              {getRestaurantPrimaryCTA(restaurant)}
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
