// src/components/Customer/RestaurantMenu/components/RestaurantCard.jsx
import React from "react";
import "../styles/RestaurantCard.scss";
const RestaurantCard = ({ data, onClick }) => (
  <div className="res-card fade-in" onClick={onClick}>
    <div className="cover">
      <img src={data.cover} alt={data.name} loading="lazy" />
      <div className="cuisine-badge">{data.cuisine}</div>
    </div>
    <div className="logo-wrapper">
      <img src={data.logo} alt="logo" />
    </div>
    <div className="info">
      <h3 className="res-name">{data.name}</h3>
      <div className="res-stats">
        <span className="rating">★ {data.rating}</span>
        <span>• {data.reviews} đánh giá</span>
      </div>
      <div className="res-footer">
        <svg width="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  </div>
);

export default RestaurantCard;
