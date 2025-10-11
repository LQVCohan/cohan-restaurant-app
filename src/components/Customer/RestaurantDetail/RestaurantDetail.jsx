import React, { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useParams } from "react-router-dom";
import "./RestaurantDetail.scss";

import {
  RestaurantHero,
  RestaurantGallery,
  RestaurantMenu,
  RestaurantSidebar,
  RestaurantReviews,
  MenuModal,
  TableMapModal,
  GalleryModal,
} from "./components/index.js";

const GET_RESTAURANT = gql`
  query GetRestaurant($id: ID!) {
    restaurant(id: $id) {
      id
      name
      avatar
      coverImage
      spaceImages
      address {
        line1
        district
        city
      }
      phone
      email
      featuredMenu
      amenities
      seatingCapacity
      priceRange
      openingHours
      closingHours
      description
      cuisineType
      status
      notesOnHours
      notesOnAmenities
    }
  }
`;

export default function RestaurantDetail() {
  const { id } = useParams();
  const { data, loading, error } = useQuery(GET_RESTAURANT, {
    variables: { id },
  });

  const [showMenu, setShowMenu] = useState(false);
  const [showTableMap, setShowTableMap] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) {
    return (
      <div className="restaurant-detail center-screen">
        <div className="spinner" />
        <p>Đang tải thông tin nhà hàng...</p>
      </div>
    );
  }
  if (error)
    return <div className="restaurant-detail error">Lỗi: {error.message}</div>;

  const restaurant = data?.restaurant;
  if (!restaurant)
    return <div className="restaurant-detail">Không tìm thấy nhà hàng.</div>;

  const openGalleryAt = (i) => {
    setGalleryIndex(i);
    setShowGallery(true);
  };

  return (
    <div className="restaurant-detail">
      {/* Header đơn giản */}
      <header className="header">
        <div className="header-content">
          <a href="/" className="logo">
            🍽️ FoodHub
          </a>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => window.history.back()}
            >
              ← Quay lại
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: restaurant.name,
                    text: restaurant.description || "",
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert("✅ Đã sao chép link nhà hàng!");
                }
              }}
            >
              📤 Chia sẻ
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <RestaurantHero restaurant={restaurant} />

      {/* Nội dung chính */}
      <main className="container">
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => setShowMenu(true)}>
            📋 Xem Menu
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowTableMap(true)}
          >
            🪑 Sơ đồ bàn
          </button>
          <button
            className="btn btn-success"
            onClick={() => window.open(`tel:${restaurant.phone || ""}`)}
          >
            📞 Đặt bàn ngay
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const q = encodeURIComponent(
                `${restaurant.address?.line1 || ""} ${
                  restaurant.address?.district || ""
                } ${restaurant.address?.city || ""}`
              );
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${q}`,
                "_blank"
              );
            }}
          >
            🗺️ Chỉ đường
          </button>
        </div>

        <div className="content-grid">
          <div className="main-content">
            <RestaurantGallery
              images={restaurant.spaceImages}
              onOpen={(i) => openGalleryAt(i)}
            />
            <RestaurantMenu menuItems={restaurant.featuredMenu} />
            <RestaurantReviews restaurantId={restaurant.id} />
          </div>
          <RestaurantSidebar restaurant={restaurant} />
        </div>
      </main>

      {/* Nút nổi */}
      <button
        className="fab"
        onClick={() => window.open(`tel:${restaurant.phone || ""}`)}
      >
        📞
      </button>
      <button
        className={`scroll-top ${showScrollTop ? "show" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑
      </button>

      {/* Modals */}
      {showMenu && <MenuModal onClose={() => setShowMenu(false)} />}
      {showTableMap && <TableMapModal onClose={() => setShowTableMap(false)} />}
      {showGallery && (
        <GalleryModal
          images={restaurant.spaceImages}
          index={galleryIndex}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}
