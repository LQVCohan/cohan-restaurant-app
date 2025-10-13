import React from "react";
import "./RestaurantCard.scss";

const RestaurantCard = ({
  restaurant,
  isFavorited,
  onToggleFavorite,
  onMakeReservation,
  onViewDetails,
}) => {
  const getStatusText = (status) => {
    const statusMap = {
      open: "🟢 Đang mở",
      closed: "🔴 Đã đóng",
      break: "🟡 Nghỉ trưa",
    };
    return statusMap[status] || "🕓 Chưa rõ";
  };

  const getBadgeComponent = (badge) => {
    const badgeMap = {
      featured: (
        <span className="restaurant-card__badge restaurant-card__badge--featured">
          ⭐ Nổi bật
        </span>
      ),
      new: (
        <span className="restaurant-card__badge restaurant-card__badge--new">
          🆕 Mới
        </span>
      ),
      promotion: (
        <span className="restaurant-card__badge restaurant-card__badge--promotion">
          🎉 Khuyến mãi
        </span>
      ),
    };
    return badgeMap[badge] || null;
  };

  const badges = restaurant.badges || []; // 👈 tránh lỗi undefined

  return (
    <div
      className="restaurant-card"
      onClick={() => onViewDetails(restaurant.id)}
    >
      <div className="restaurant-card__image">
        <img
          src={restaurant.image || "/images/placeholder.jpg"}
          alt={restaurant.name}
        />
        <div className="restaurant-card__badges">
          {badges.map((badge) => (
            <React.Fragment key={badge}>
              {getBadgeComponent(badge)}
            </React.Fragment>
          ))}
        </div>
        <button
          className={`restaurant-card__favorite ${
            isFavorited ? "restaurant-card__favorite--favorited" : ""
          }`}
          onClick={(e) => onToggleFavorite(e, restaurant.id)}
        >
          {isFavorited ? "❤️" : "🤍"}
        </button>
      </div>

      <div className="restaurant-card__content">
        <div className="restaurant-card__header">
          <h3 className="restaurant-card__name">{restaurant.name}</h3>
          <span
            className={`restaurant-card__status restaurant-card__status--${
              restaurant.status || "open"
            }`}
          >
            {getStatusText(restaurant.status)}
          </span>
        </div>

        <div className="restaurant-card__meta">
          <div className="restaurant-card__rating">
            <span className="restaurant-card__rating-stars">⭐</span>
            <span className="restaurant-card__rating-score">
              {restaurant.avgRating ?? restaurant.rating ?? "–"}
            </span>
          </div>
          {restaurant.cuisine && (
            <span className="restaurant-card__cuisine">
              🍽️ {restaurant.cuisine}
            </span>
          )}
          {restaurant.priceRange && (
            <span className="restaurant-card__price">
              💰 {restaurant.priceRange}
            </span>
          )}
        </div>

        <p className="restaurant-card__description">
          {restaurant.description || "Nhà hàng đang cập nhật thông tin."}
        </p>

        <div className="restaurant-card__footer">
          <div className="restaurant-card__info">
            <div className="restaurant-card__info-item">
              <span>📍</span>
              <span>
                {[restaurant.district, restaurant.city]
                  .filter(Boolean)
                  .join(", ") || "Đang cập nhật"}
              </span>
            </div>
          </div>
          <div className="restaurant-card__actions">
            <button
              className="btn btn--secondary"
              onClick={(e) => onMakeReservation(e, restaurant.id)}
            >
              📞 Đặt bàn
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onViewDetails(restaurant.id)}
            >
              👁️ Xem chi tiết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
