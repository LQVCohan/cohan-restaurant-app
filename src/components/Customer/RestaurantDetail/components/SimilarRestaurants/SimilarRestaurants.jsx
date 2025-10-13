import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import "./SimilarRestaurants.scss";

const SimilarRestaurants = ({ currentRestaurantId, cuisine, district }) => {
  const [similarRestaurants, setSimilarRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarRestaurants = async () => {
      setLoading(true);
      try {
        // const restaurants = await getSimilarRestaurants(currentRestaurantId, {
        //   cuisine,
        //   district,
        // });
        // setSimilarRestaurants(restaurants);
      } catch (error) {
        console.error("Error fetching similar restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarRestaurants();
  }, [currentRestaurantId, cuisine, district]);

  const formatPrice = (price) => {
    if (price < 100) return `${price}k - ${price + 50}k`;
    if (price < 200) return `${price}k - ${price + 100}k`;
    return `${price}k+`;
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`star ${
          index < Math.floor(rating) ? "star--filled" : "star--empty"
        }`}
      >
        ⭐
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="similar-restaurants">
        <h2 className="section-title">🏪 Nhà hàng tương tự</h2>
        <div className="similar-loading">
          <div className="loading-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="restaurant-skeleton">
                <div className="skeleton-image"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-line--title"></div>
                  <div className="skeleton-line skeleton-line--subtitle"></div>
                  <div className="skeleton-line skeleton-line--small"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (similarRestaurants.length === 0) {
    return (
      <div className="similar-restaurants">
        <h2 className="section-title">🏪 Nhà hàng tương tự</h2>
        <div className="similar-empty">
          <span className="empty-icon">🔍</span>
          <h3>Không tìm thấy nhà hàng tương tự</h3>
          <p>Hãy khám phá thêm các nhà hàng khác trong khu vực!</p>
          <Link to="/restaurants" className="btn btn--primary">
            🏪 Xem tất cả nhà hàng
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="similar-restaurants">
      <div className="section-header">
        <h2 className="section-title">🏪 Nhà hàng tương tự</h2>
        <p className="section-subtitle">
          Các nhà hàng {cuisine} khác trong khu vực {district}
        </p>
      </div>

      <div className="restaurants-grid">
        {similarRestaurants.map((restaurant) => (
          <Link
            key={restaurant.id}
            to={`/restaurant/${restaurant.id}`}
            className="restaurant-card"
          >
            <div className="restaurant-image">
              <img src={restaurant.image} alt={restaurant.name} />

              {restaurant.isPromoted && (
                <span className="restaurant-badge restaurant-badge--promoted">
                  ⭐ Nổi bật
                </span>
              )}

              {restaurant.isNew && (
                <span className="restaurant-badge restaurant-badge--new">
                  🆕 Mới
                </span>
              )}

              <div className="restaurant-overlay">
                <div className="overlay-content">
                  <span className="overlay-icon">👁️</span>
                  <span className="overlay-text">Xem chi tiết</span>
                </div>
              </div>
            </div>

            <div className="restaurant-content">
              <div className="restaurant-header">
                <h3 className="restaurant-name">{restaurant.name}</h3>
                <div className="restaurant-rating">
                  <div className="rating-stars">
                    {renderStars(restaurant.rating)}
                  </div>
                  <span className="rating-score">{restaurant.rating}</span>
                  <span className="rating-count">
                    ({restaurant.reviewCount})
                  </span>
                </div>
              </div>

              <div className="restaurant-info">
                <div className="info-item">
                  <span className="info-icon">🍽️</span>
                  <span className="info-text">{restaurant.cuisine}</span>
                </div>

                <div className="info-item">
                  <span className="info-icon">📍</span>
                  <span className="info-text">{restaurant.district}</span>
                </div>

                <div className="info-item">
                  <span className="info-icon">💰</span>
                  <span className="info-text">
                    {formatPrice(restaurant.averagePrice)}
                  </span>
                </div>

                <div className="info-item">
                  <span className="info-icon">🚗</span>
                  <span className="info-text">{restaurant.distance}km</span>
                </div>
              </div>

              <div className="restaurant-features">
                {restaurant.features?.slice(0, 3).map((feature) => (
                  <span key={feature} className="feature-tag">
                    {feature}
                  </span>
                ))}
                {restaurant.features?.length > 3 && (
                  <span className="feature-more">
                    +{restaurant.features.length - 3}
                  </span>
                )}
              </div>

              <div className="restaurant-footer">
                <div className="restaurant-status">
                  <span
                    className={`status-indicator ${
                      restaurant.isOpen ? "status--open" : "status--closed"
                    }`}
                  >
                    {restaurant.isOpen ? "🟢 Đang mở" : "🔴 Đã đóng"}
                  </span>
                  {restaurant.openTime && (
                    <span className="open-time">
                      {restaurant.isOpen
                        ? `Đóng cửa ${restaurant.closeTime}`
                        : `Mở cửa ${restaurant.openTime}`}
                    </span>
                  )}
                </div>

                <div className="restaurant-actions">
                  <button
                    className="action-btn action-btn--favorite"
                    onClick={(e) => {
                      e.preventDefault();
                      // Handle favorite toggle
                    }}
                  >
                    {restaurant.isFavorite ? "❤️" : "🤍"}
                  </button>

                  <button
                    className="action-btn action-btn--share"
                    onClick={(e) => {
                      e.preventDefault();
                      // Handle share
                    }}
                  >
                    📤
                  </button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="section-footer">
        <Link to="/restaurants" className="btn btn--secondary">
          🔍 Xem thêm nhà hàng
        </Link>
      </div>
    </div>
  );
};

export default SimilarRestaurants;
