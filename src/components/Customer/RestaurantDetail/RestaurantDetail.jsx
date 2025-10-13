// src/components/RestaurantDetail/index.jsx
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useRestaurant } from "../../../hooks/useRestaurant";
import RestaurantHeader from "./components/RestaurantHeader/RestaurantHeader";
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import MenuSection from "./components/MenuSection/MenuSection";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";
import ReservationForm from "./components/ReservationForm/ReservationForm";

import "./RestaurantDetail.scss";

const RestaurantDetail = () => {
  const { id } = useParams();
  const { restaurant, loading, error } = useRestaurant(id);
  const [showReservation, setShowReservation] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="restaurant-detail">
        <div className="loading-container">
          <div className="spinner" />
          <p>Đang tải thông tin nhà hàng...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="restaurant-detail">
        <div className="error-container">
          <span className="error-icon">😔</span>
          <h2>Không tìm thấy nhà hàng</h2>
          <p>{error || "Nhà hàng không tồn tại hoặc đã bị xóa."}</p>
          <button
            onClick={() => window.history.back()}
            className="btn btn--primary"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "📋 Tổng quan", icon: "📋" },
    { id: "menu", label: "🍽️ Thực đơn", icon: "🍽️" },
    { id: "reviews", label: "⭐ Đánh giá", icon: "⭐" },
    { id: "photos", label: "📸 Hình ảnh", icon: "📸" },
  ];

  return (
    <div className="restaurant-detail">
      <RestaurantHeader
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          avatar: restaurant.avatar,
          coverImage: restaurant.image,
          rating: restaurant.rating,
          status: restaurant.status,
          cuisine: restaurant.cuisine,
          addressText: restaurant.addressText,
        }}
        onReservationClick={() => setShowReservation(true)}
      />

      <div className="restaurant-content">
        <div className="content-navigation">
          <div className="nav-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${
                  activeTab === tab.id ? "nav-tab--active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="content-sections">
          {activeTab === "overview" && (
            <div className="section-content">
              <RestaurantInfo restaurant={restaurant} />
            </div>
          )}

          {activeTab === "menu" && (
            <div className="section-content">
              <MenuSection restaurantId={restaurant.id} />
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="section-content">
              <ReviewsSection restaurantId={restaurant.id} />
            </div>
          )}

          {activeTab === "photos" && (
            <div className="section-content">
              <PhotoGallery photos={restaurant.photos} />
            </div>
          )}
        </div>

        <div className="similar-section">
          <SimilarRestaurants
            currentRestaurantId={restaurant.id}
            cuisine={restaurant.cuisine}
            district={restaurant.district}
          />
        </div>
      </div>

      <ReservationForm
        restaurant={restaurant}
        show={showReservation}
        onClose={() => setShowReservation(false)}
      />
    </div>
  );
};

export default RestaurantDetail;
