// src/components/Customer/RestaurantMenu/components/RestaurantCard.jsx
import React from "react";
import "../styles/RestaurantCard.scss";

const RESTAURANT_IMAGE_FALLBACK = "/cohan_logo_icon.svg";

const handleRestaurantImageError = (event, type = "cover") => {
  const image = event.currentTarget;
  if (image.dataset.cohanFallbackApplied === "true") return;

  image.dataset.cohanFallbackApplied = "true";
  image.classList.add("is-fallback");
  image.alt =
    type === "logo" ? "Biểu trưng nhà hàng" : "Ảnh minh họa nhà hàng";
  image.src = RESTAURANT_IMAGE_FALLBACK;
};

const RestaurantCard = ({ data, onClick, isFavorite = false, onToggleFavorite }) => (
  <article className={`res-card fade-in ${!data.canOrder ? "res-card--paused" : ""}`}>
    <button
      type="button"
      className={`favorite-toggle ${isFavorite ? "is-active" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite?.(data);
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Bỏ yêu thích ${data.name}` : `Lưu yêu thích ${data.name}`}
    >
      ♥
    </button>
    <button
      type="button"
      className="res-card__button"
      onClick={onClick}
      aria-label={`Xem thực đơn ${data.name}`}
    >
      <div className="cover">
        <img
          src={data.cover || RESTAURANT_IMAGE_FALLBACK}
          alt={`Không gian hoặc món nổi bật của ${data.name}`}
          loading="lazy"
          onError={(event) => handleRestaurantImageError(event, "cover")}
        />
        <div className="cuisine-badge">{data.cuisine}</div>
        <div className="order-status">{data.canOrder ? "Đang nhận đơn" : "Tạm dừng"}</div>
      </div>
      <div className="logo-wrapper">
        <img
          src={data.logo || RESTAURANT_IMAGE_FALLBACK}
          alt={`Logo ${data.name}`}
          loading="lazy"
          onError={(event) => handleRestaurantImageError(event, "logo")}
        />
      </div>
      <div className="info">
        <h3 className="res-name">{data.name}</h3>
        <div className="res-stats">
          <span className="rating">★ {data.rating || "Mới"}</span>
          <span>{data.reviews} đánh giá</span>
        </div>
        <div className="res-footer">
          <svg aria-hidden="true" width="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          <span>{data.address}</span>
        </div>
      </div>
    </button>
  </article>
);

export default RestaurantCard;
