import React from "react";
import "./RestaurantCard.scss";
import "./RestaurantCardRecent.scss";
import {
  getOpeningStatusLabel,
  canShowReservationButton,
  getRestaurantPrimaryCTA,
} from "@/utils/restaurantStatus";

const RESTAURANT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=900&q=80",
];
const LOCAL_RESTAURANT_FALLBACK = "/cohan_logo_icon.svg";

const isPlaceholderImage = (url = "") => {
  const normalizedUrl = String(url || "").toLowerCase();
  return !normalizedUrl || normalizedUrl.includes("default-") || normalizedUrl.includes("picsum.photos") || normalizedUrl.includes("source.unsplash") || normalizedUrl.includes("/random");
};

const resolveFallbackImage = (restaurantId = "") => {
  const source = String(restaurantId || "restaurant");
  const hash = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return RESTAURANT_FALLBACK_IMAGES[hash % RESTAURANT_FALLBACK_IMAGES.length];
};

const handleRestaurantImageError = (event) => {
  const image = event.currentTarget;
  if (image.dataset.cohanFallbackApplied === "true") return;

  image.dataset.cohanFallbackApplied = "true";
  image.classList.add("is-fallback");
  image.alt = "Ảnh minh họa nhà hàng";
  image.src = LOCAL_RESTAURANT_FALLBACK;
};

const getStatusTone = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("open")) return "open";
  if (normalized.includes("closed")) return "closed";
  if (normalized.includes("break") || normalized.includes("pause")) return "break";
  return "unknown";
};

const RestaurantCard = ({
  restaurant,
  variant = "grid",
  isFavorited,
  isRecent = false,
  onToggleFavorite,
  onMakeReservation,
  onViewDetails,
}) => {
  const addressText = [restaurant?.address?.district || restaurant.district, restaurant?.address?.city || restaurant.city]
    .filter(Boolean)
    .join(", ");

  const hasReviews = Number(restaurant.reviewCount || 0) > 0;
  const rawImage = restaurant.image || restaurant.coverImage || restaurant.avatar;
  const displayImage = isPlaceholderImage(rawImage) ? resolveFallbackImage(restaurant.id) : rawImage;
  const statusTone = getStatusTone(restaurant.openingStatus);

  return (
    <div
      className={`restaurant-card ${variant === "list" ? "restaurant-card--list" : ""} ${isRecent ? "restaurant-card--recent" : ""}`}
      onClick={() => onViewDetails(restaurant.id)}
    >
      <div className="restaurant-card__image-wrapper">
        <img
          src={displayImage}
          alt={restaurant.name}
          className="restaurant-card__img"
          loading="lazy"
          onError={handleRestaurantImageError}
        />

        {isRecent && (
          <span className="restaurant-card__recent-badge">
            Gần đây
          </span>
        )}

        <button
          type="button"
          className={`btn-favorite ${isFavorited ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(e, restaurant.id);
          }}
          aria-label={isFavorited ? `Bỏ yêu thích ${restaurant.name}` : `Lưu yêu thích ${restaurant.name}`}
          aria-pressed={Boolean(isFavorited)}
        >
          {isFavorited ? "❤️" : "🤍"}
        </button>
      </div>

      <div className="restaurant-card__content">
        <div className="info-section">
          <div className="content-header">
            <h3 className="restaurant-name">{restaurant.name}</h3>
            <span className={`status-pill status-pill--${statusTone}`}>{getOpeningStatusLabel(restaurant.openingStatus)}</span>
          </div>

          <div className="content-meta">
            <div className="meta-item rating">
              ⭐ {hasReviews ? Number(restaurant.avgRating || 0).toFixed(1) : "Chưa có đánh giá"}
              {hasReviews && <span className="count">({restaurant.reviewCount})</span>}
            </div>
            {isRecent && <div className="meta-item recent">↻ Đã tương tác gần đây</div>}
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
