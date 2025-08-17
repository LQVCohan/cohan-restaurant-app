import React from "react";
import "../../styles/Homepage/RestaurantGrid.scss";

const RestaurantGrid = ({ restaurants, onRestaurantClick }) => {
  return (
    <section id="restaurants" className="restaurants">
      <div className="restaurants__container">
        <div className="restaurants__header">
          <h3 className="restaurants__title">Nhà hàng nổi bật</h3>
          <button className="restaurants__view-all">Xem tất cả →</button>
        </div>

        <div className="restaurants__grid">
          {restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="restaurant-card"
              onClick={() => onRestaurantClick(restaurant.id)}
            >
              <div className="restaurant-card__image">
                <span>{restaurant.image}</span>
              </div>
              <div className="restaurant-card__content">
                <h4 className="restaurant-card__name">{restaurant.name}</h4>
                <p className="restaurant-card__description">
                  {restaurant.description}
                </p>
                <div className="restaurant-card__info">
                  <div className="restaurant-card__rating">
                    <span className="restaurant-card__star">⭐</span>
                    <span className="restaurant-card__rating-value">
                      {restaurant.rating}
                    </span>
                  </div>
                  <span className="restaurant-card__delivery">
                    🕒 {restaurant.deliveryTime}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RestaurantGrid;
