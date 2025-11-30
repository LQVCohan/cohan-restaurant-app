// src/components/RestaurantDetail/index.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Thêm useNavigate
import { useRestaurant } from "../../../hooks/useRestaurant";
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import MenuSection from "./components/MenuSection/MenuSection";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";

import "./RestaurantDetail.scss";

// Icon components (để code gọn hơn, có thể tách ra file riêng)
const BackIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { restaurant, loading, error } = useRestaurant(id);
  //  const [showBookingModal, handleTableLayout] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="restaurant-detail-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="restaurant-detail-error">
        <h2>Không tìm thấy nhà hàng</h2>
        <button onClick={() => navigate(-1)} className="btn-back">
          Quay lại
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "menu", label: "Thực đơn" },
    { id: "reviews", label: "Đánh giá" },
    { id: "photos", label: "Hình ảnh" },
  ];

  const imgAvaUrl = restaurant.avatar || restaurant.imgAvaUrl;
  const imgThumbUrl = restaurant?.coverImage || restaurant.imgThumbUrl;
  const handleTableLayout = () => {
    navigate(`/restaurant/${restaurant.id}/table`);
  };
  return (
    <div className="restaurant-detail-page">
      {/* Nút Back nằm góc trái màn hình */}
      <button className="back-button-floating" onClick={() => navigate(-1)}>
        <BackIcon />
      </button>

      <div className="main-container">
        {/* HERO SECTION: Cover & Avatar */}
        <div className="hero-section">
          <div className="cover-wrapper">
            <img src={imgThumbUrl} alt="Cover" className="cover-image" />
            <div className="cover-overlay"></div>
          </div>

          <div className="header-info">
            <div className="avatar-wrapper">
              <img
                src={imgAvaUrl}
                alt={restaurant.name}
                className="avatar-image"
              />
            </div>
            <div className="text-info">
              <h1 className="restaurant-name">{restaurant.name}</h1>
              <div className="restaurant-meta">
                <span className="cuisine-tag">{restaurant.cuisine}</span>
                <span className="rating">⭐ {restaurant.rating}</span>
                <span
                  className={`status-badge ${
                    restaurant.status === "open" ? "open" : "closed"
                  }`}
                >
                  {restaurant.status === "open" ? "Đang mở cửa" : "Đóng cửa"}
                </span>
              </div>
              <p className="address">{restaurant.addressText}</p>
            </div>

            {/* Nút đặt bàn trên Desktop nằm ngay header */}
            <button
              className="btn-book-header desktop-only"
              onClick={handleTableLayout}
            >
              Đặt bàn ngay
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS (Sticky) */}
        <div className="sticky-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT SECTIONS */}
        <div className="content-body">
          <div className="left-content">
            {activeTab === "overview" && (
              <RestaurantInfo restaurant={restaurant} />
            )}
            {activeTab === "menu" && (
              <MenuSection restaurantId={restaurant.id} />
            )}
            {activeTab === "reviews" && (
              <ReviewsSection restaurantId={restaurant.id} />
            )}
            {activeTab === "photos" && (
              <PhotoGallery photos={restaurant.photos} />
            )}
          </div>

          {/* Sidebar gợi ý (Desktop) */}
          <div className="right-sidebar">
            <SimilarRestaurants
              currentRestaurantId={restaurant.id}
              cuisine={restaurant.cuisine}
              district={restaurant.district}
            />
          </div>
        </div>
      </div>

      {/* Floating Button cho Mobile */}
      <div className="mobile-action-bar mobile-only">
        <button className="btn-book-mobile" onClick={handleTableLayout}>
          Đặt bàn ngay
        </button>
      </div>

      {/* <BookingModal
        isOpen={showBookingModal}
        onClose={() => handleTableLayout(false)}
      /> */}
    </div>
  );
};

export default RestaurantDetail;
