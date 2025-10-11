import React from "react";

export default function RestaurantHero({ restaurant }) {
  return (
    <section className="hero">
      <img
        src={restaurant.coverImage || "/images/default-cover.jpg"}
        alt={restaurant.name}
        className="hero-image"
      />
      <div className="hero-overlay" />
      <div className="hero-content">
        <img
          src={restaurant.avatar || "/images/default-avatar.jpg"}
          alt={restaurant.name}
          className="restaurant-avatar"
        />
        <h1 className="restaurant-name">{restaurant.name}</h1>
        <div className="restaurant-meta">
          <span
            className={`status-badge status-${restaurant.status || "open"}`}
          >
            {restaurant.status === "closed" ? "🔴 Đóng cửa" : "🟢 Đang mở cửa"}
          </span>
          {restaurant.cuisineType && (
            <span className="badge">🍜 {restaurant.cuisineType}</span>
          )}
        </div>
        {restaurant.description && (
          <p className="restaurant-desc">{restaurant.description}</p>
        )}
      </div>
    </section>
  );
}
