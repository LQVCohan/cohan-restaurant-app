import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import "./SimilarRestaurants.scss";

const GET_SIMILAR = gql`
  query GetSimilarRestaurants($restaurantId: ID!, $limit: Int) {
    similarRestaurants(restaurantId: $restaurantId, limit: $limit) {
      id
      name
      cuisineType
      avgRating
      reviewCount
      openingStatus
      coverImage
      avatar
      address { district city }
    }
  }
`;

const SimilarRestaurants = ({ currentRestaurantId, variant = "default" }) => {
  const { data, loading } = useQuery(GET_SIMILAR, {
    variables: { restaurantId: currentRestaurantId, limit: 6 },
    skip: !currentRestaurantId,
  });
  const [erroredImages, setErroredImages] = useState({});

  const items = data?.similarRestaurants || [];

  if (loading) {
    return <div className={`similar-restaurants ${variant}`}>Đang tải nhà hàng tương tự...</div>;
  }

  if (!items.length) {
    return (
      <div className={`similar-restaurants ${variant}`}>
        <div className="similar-empty">Không có nhà hàng tương tự.</div>
      </div>
    );
  }

  return (
    <div className={`similar-restaurants ${variant}`}>
      <div className="restaurants-grid">
        {items.map((restaurant) => {
          const imageSrc = restaurant.coverImage || restaurant.avatar || "/default-restaurant.jpg";
          const hasImageError = !!erroredImages[restaurant.id];

          return (
            <Link key={restaurant.id} to={`/restaurant/${restaurant.id}`} className="restaurant-card">
              {hasImageError ? (
                <div className="restaurant-image placeholder" aria-hidden="true" />
              ) : (
                <img
                  className="restaurant-image"
                  src={imageSrc}
                  alt=""
                  onError={() => {
                    setErroredImages((prev) => ({ ...prev, [restaurant.id]: true }));
                  }}
                />
              )}

              <div className="restaurant-content">
                <h4>{restaurant.name}</h4>
                <p className="meta">
                  {restaurant.cuisineType || "Nhà hàng"}
                  {restaurant.address?.district || restaurant.address?.city
                    ? ` • ${restaurant.address?.district || restaurant.address?.city}`
                    : ""}
                </p>
                <p className="meta">
                  {restaurant.reviewCount > 0
                    ? `${Number(restaurant.avgRating || 0).toFixed(1)} ★ • ${restaurant.reviewCount} đánh giá`
                    : "Chưa có đánh giá"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SimilarRestaurants;
