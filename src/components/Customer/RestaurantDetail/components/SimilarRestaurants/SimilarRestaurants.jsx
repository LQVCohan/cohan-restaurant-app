import React from "react";
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

const SimilarRestaurants = ({ currentRestaurantId }) => {
  const { data, loading } = useQuery(GET_SIMILAR, {
    variables: { restaurantId: currentRestaurantId, limit: 6 },
    skip: !currentRestaurantId,
  });

  const items = data?.similarRestaurants || [];

  if (loading) return <div className="similar-restaurants">Đang tải nhà hàng tương tự...</div>;
  if (!items.length) return <div className="similar-restaurants">Không có nhà hàng tương tự.</div>;

  return (
    <div className="similar-restaurants">
      {items.map((restaurant) => (
        <Link key={restaurant.id} to={`/restaurant/${restaurant.id}`} className="restaurant-card">
          <img src={restaurant.coverImage || restaurant.avatar || "/default-restaurant.jpg"} alt={restaurant.name} />
          <div>
            <h4>{restaurant.name}</h4>
            <p>{restaurant.cuisineType || "Nhà hàng"}</p>
            <p>{restaurant.reviewCount > 0 ? `${Number(restaurant.avgRating || 0).toFixed(1)} (${restaurant.reviewCount})` : "Chưa có đánh giá"}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default SimilarRestaurants;
