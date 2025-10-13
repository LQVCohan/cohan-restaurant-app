import React, { useState } from "react";
import "./RestaurantHero.scss";
import {
  formatAddress,
  safeArray,
  safeString,
  safeNumber,
} from "../../../../../utils/formatters";
const RestaurantHero = ({
  restaurant,
  isFavorited,
  onToggleFavorite,
  onShare,
  onReservation,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const getStatusInfo = (status) => {
    const statusMap = {
      open: { text: "Đang mở cửa", class: "open", icon: "🟢" },
      closed: { text: "Đã đóng cửa", class: "closed", icon: "🔴" },
      break: { text: "Nghỉ trưa", class: "break", icon: "🟡" },
    };
    return statusMap[status] || statusMap["closed"];
  };

  const statusInfo = getStatusInfo(restaurant.status);

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === restaurant.photos.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? restaurant.photos.length - 1 : prev - 1
    );
  };

  return (
    <section className="restaurant-hero">
      <div className="restaurant-hero__image-container">
        <div className="restaurant-hero__image-slider">
          <img
            src={restaurant.photos[currentImageIndex]}
            alt={restaurant.name}
            className="restaurant-hero__image"
          />

          {restaurant.photos.length > 1 && (
            <>
              <button
                className="restaurant-hero__nav restaurant-hero__nav--prev"
                onClick={prevImage}
                aria-label="Ảnh trước"
              >
                ←
              </button>
              <button
                className="restaurant-hero__nav restaurant-hero__nav--next"
                onClick={nextImage}
                aria-label="Ảnh tiếp theo"
              >
                →
              </button>

              <div className="restaurant-hero__indicators">
                {restaurant.photos.map((_, index) => (
                  <button
                    key={index}
                    className={`restaurant-hero__indicator ${
                      index === currentImageIndex
                        ? "restaurant-hero__indicator--active"
                        : ""
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                    aria-label={`Ảnh ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="restaurant-hero__overlay">
          <div className="restaurant-hero__badges">
            {restaurant.badges?.map((badge) => (
              <span
                key={badge}
                className={`restaurant-hero__badge restaurant-hero__badge--${badge}`}
              >
                {badge === "featured" && "⭐ Nổi bật"}
                {badge === "new" && "🆕 Mới"}
                {badge === "promotion" && "🎉 Khuyến mãi"}
              </span>
            ))}
          </div>

          <div className="restaurant-hero__actions">
            <button
              className={`restaurant-hero__action ${
                isFavorited ? "restaurant-hero__action--favorited" : ""
              }`}
              onClick={onToggleFavorite}
              aria-label={isFavorited ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
            >
              {isFavorited ? "❤️" : "🤍"}
            </button>
            <button
              className="restaurant-hero__action"
              onClick={onShare}
              aria-label="Chia sẻ"
            >
              📤
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="restaurant-hero__content">
          <div className="restaurant-hero__info">
            <div className="restaurant-hero__header">
              <h1 className="restaurant-hero__name">{restaurant.name}</h1>
              <div
                className={`restaurant-hero__status restaurant-hero__status--${statusInfo.class}`}
              >
                <span className="restaurant-hero__status-icon">
                  {statusInfo.icon}
                </span>
                <span className="restaurant-hero__status-text">
                  {statusInfo.text}
                </span>
              </div>
            </div>

            <div className="restaurant-hero__meta">
              <div className="restaurant-hero__rating">
                <span className="restaurant-hero__rating-stars">⭐</span>
                <span className="restaurant-hero__rating-score">
                  {restaurant.rating}
                </span>
                <span className="restaurant-hero__rating-count">
                  ({restaurant.reviewCount} đánh giá)
                </span>
              </div>
              <span className="restaurant-hero__cuisine">
                🍽️ {restaurant.cuisine}
              </span>
              <span className="restaurant-hero__price">
                💰 {restaurant.priceRange}
              </span>
            </div>

            <p className="restaurant-hero__description">
              {restaurant.description}
            </p>

            <div className="restaurant-hero__details">
              <div className="restaurant-hero__detail">
                <span className="restaurant-hero__detail-icon">📍</span>
                <span> {formatAddress(restaurant.address)}</span>
              </div>
              <div className="restaurant-hero__detail">
                <span className="restaurant-hero__detail-icon">📞</span>
                <span>{restaurant.phone}</span>
              </div>
              <div className="restaurant-hero__detail">
                <span className="restaurant-hero__detail-icon">🕒</span>
                <span>{restaurant.openHours}</span>
              </div>
            </div>
          </div>

          <div className="restaurant-hero__cta">
            <button
              className="btn btn--primary btn--large"
              onClick={onReservation}
            >
              📅 Đặt bàn ngay
            </button>
            <button className="btn btn--secondary">📞 Gọi điện</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RestaurantHero;
