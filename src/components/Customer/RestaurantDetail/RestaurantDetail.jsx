import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";

// Components (Tách nhỏ để dễ quản lý)
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import MenuSection from "./components/MenuSection/MenuSection";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";
import PromotionsSection from "./components/PromotionsSection/PromotionsSection";
import LoadingSpinner from "@/components/common/LoadingSpinner";

// Icons
import { ArrowLeft, Star, MapPin, Clock, Share2, Heart } from "lucide-react";
import { getOpeningStatusLabel } from "@/utils/restaurantStatus";

import "./RestaurantDetail.scss";

const GET_PUBLIC_RESTAURANT = gql`
  query GetPublicRestaurant($id: ID!) {
    publicRestaurant(id: $id) {
      id name avatar coverImage spaceImages description cuisineType avgRating reviewCount
      openingStatus openingStatusReason canReserve canOrder
      address { line1 district city lat lng }
      phone
    }
  }
`;

const GET_RESTAURANT_REVIEW_STATS = gql`
  query GetRestaurantReviewStatsForHeader($restaurantId: ID!) {
    reviewStats(restaurantId: $restaurantId, targetType: "restaurant") {
      total
      avgRating
    }
  }
`;

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreviewMode = new URLSearchParams(location.search).get("preview") === "1";
  const { data: restaurantData, loading, error } = useQuery(GET_PUBLIC_RESTAURANT, { variables: { id }, skip: !id });
  const restaurant = restaurantData?.publicRestaurant;
  const { data: reviewStatsData } = useQuery(GET_RESTAURANT_REVIEW_STATS, {
    variables: { restaurantId: id },
    skip: !id,
  });

  const [activeTab, setActiveTab] = useState("info");
  const [favoriteActive, setFavoriteActive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [previewRestaurantOverride, setPreviewRestaurantOverride] =
    useState(null);

  // Xử lý hiệu ứng scroll cho Navbar
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isPreviewMode) return;

    const onPreviewMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "restaurant-preview:update") return;
      setPreviewRestaurantOverride(event.data.payload || null);
    };

    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, [isPreviewMode]);

  if (loading)
    return (
      <div className="detail-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  if (error || !restaurant)
    return <div className="detail-error">Không tìm thấy nhà hàng.</div>;

  const resolvedRestaurant = (() => {
    if (!previewRestaurantOverride) return restaurant;

    const mergedAddress = {
      ...(restaurant.address || {}),
      ...(previewRestaurantOverride.address || {}),
    };

    const merged = {
      ...restaurant,
      ...previewRestaurantOverride,
      address: mergedAddress,
    };

    if (!merged.addressText) {
      merged.addressText = [
        mergedAddress.line1,
        mergedAddress.district,
        mergedAddress.city,
      ]
        .filter(Boolean)
        .join(", ");
    }

    if (!merged.district) {
      merged.district = mergedAddress.district || "";
    }

    if (!merged.cuisine) {
      merged.cuisine = merged.cuisineType || "";
    }

    if (merged.rating == null && merged.avgRating != null) {
      merged.rating = merged.avgRating;
    }

    return merged;
  })();

  const imgAvaUrl =
    resolvedRestaurant.avatar ||
    resolvedRestaurant.imgAvaUrl ||
    "/default-avatar.png";
  const imgThumbUrl =
    resolvedRestaurant.coverImage ||
    resolvedRestaurant.imgThumbUrl ||
    "/default-cover.jpg";

  const reviewStats = reviewStatsData?.reviewStats;
  const headerReviewCount = reviewStats?.total ?? resolvedRestaurant.reviewCount ?? 0;
  const headerRating = headerReviewCount > 0 ? Number(reviewStats?.avgRating ?? resolvedRestaurant.avgRating ?? 0).toFixed(1) : "Chưa có đánh giá";

  const canReserve = !!resolvedRestaurant.canReserve;

  const handleBookTable = () => {
    if (isPreviewMode) return;
    if (!canReserve) return;
    navigate(`/restaurant/${resolvedRestaurant.id}/layout`);
  };

  const handleFavorite = () => {
    if (isPreviewMode) return;
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      navigate("/login", { state: { from: location } });
      return;
    }
    const key = `restaurant_favorites`;
    const nextSet = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    if (nextSet.has(resolvedRestaurant.id)) nextSet.delete(resolvedRestaurant.id);
    else nextSet.add(resolvedRestaurant.id);
    localStorage.setItem(key, JSON.stringify([...nextSet]));
    setFavoriteActive(nextSet.has(resolvedRestaurant.id));
  };

  const handleShare = async () => {
    if (isPreviewMode) return;
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: resolvedRestaurant.name, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  };

  const tabs = [
    { id: "info", label: "Thông tin" },
    { id: "menu", label: "Thực đơn" },
    { id: "reviews", label: "Đánh giá" },
    { id: "promotions", label: "Khuyến mãi" },
    { id: "photos", label: "Hình ảnh" },
  ];

  return (
    <div className="restaurant-detail-page">
      {/* 1. HERO SECTION (FULL WIDTH) */}
      <section className="rd-hero">
        <div
          className="hero-cover"
          style={{ backgroundImage: `url(${imgThumbUrl})` }}
        >
          <div className="overlay"></div>
          <button
            className="btn-back"
            onClick={() => {
              if (isPreviewMode) return;
              navigate(-1);
            }}
            disabled={isPreviewMode}
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        <div className="hero-content container">
          <div className="res-info-card">
            <div className="avatar-wrapper">
              <img src={imgAvaUrl} alt={resolvedRestaurant.name} />
            </div>

            <div className="info-text">
              <div className="bread-crumbs">
                Trang chủ / Nhà hàng / {resolvedRestaurant.district}
              </div>
              <h1 className="res-name">{resolvedRestaurant.name}</h1>

              <div className="res-meta">
                <span className="rating">
                  <Star size={16} fill="#f59e0b" stroke="none" />
                  <strong>{headerRating}</strong> ({headerReviewCount} đánh giá)
                </span>
                <span className="dot">•</span>
                <span className="cuisine">{resolvedRestaurant.cuisine}</span>
                <span className="dot">•</span>
                <span
                  className={`status ${
                    resolvedRestaurant.openingStatus === "open" ? "open" : "closed"
                  }`}
                >
                  {getOpeningStatusLabel(resolvedRestaurant.openingStatus)}
                </span>
              </div>

              <div className="res-address">
                <MapPin size={16} /> {resolvedRestaurant.addressText}
              </div>
            </div>

            <div className="action-group">
              <button className={`btn-icon ${favoriteActive ? "active" : ""}`} disabled={isPreviewMode} onClick={handleFavorite}>
                <Heart size={20} />
              </button>
              <button className="btn-icon" disabled={isPreviewMode} onClick={handleShare}>
                <Share2 size={20} />
              </button>
              <button
                className="btn-book desktop-only"
                onClick={handleBookTable}
                disabled={isPreviewMode || !canReserve}
              >
                {resolvedRestaurant.canReserve ? "Đặt bàn ngay" : "Hiện không nhận đặt bàn"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STICKY TABS */}
      <div className={`rd-tabs ${isScrolled ? "stuck" : ""}`}>
        <div className="container tab-scroll">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => !isPreviewMode && setActiveTab(tab.id)}
              disabled={isPreviewMode}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. MAIN CONTENT (2 COLUMNS) */}
      <div className="rd-container container">
        {/* Left Content */}
        <div className="main-content">
          {activeTab === "menu" && (
            <MenuSection restaurantId={resolvedRestaurant.id} />
          )}
          {activeTab === "reviews" && (
            <ReviewsSection restaurantId={resolvedRestaurant.id} />
          )}
          {activeTab === "promotions" && (
            <PromotionsSection restaurantId={resolvedRestaurant.id} />
          )}
          {activeTab === "photos" && (
            <PhotoGallery photos={resolvedRestaurant.photos} />
          )}
          {activeTab === "info" && (
            <RestaurantInfo
              restaurant={resolvedRestaurant}
              isPreviewMode={isPreviewMode}
            />
          )}
        </div>

        {/* Right Sidebar (Sticky) */}
        <aside className="sidebar-content">
          <div className="booking-widget">
            <h3>Đặt bàn giữ chỗ</h3>
            <p>Giữ chỗ miễn phí - Xác nhận tức thì</p>
            <div className="time-picker-mock">
              <Clock size={16} /> {resolvedRestaurant.openingStatusReason || "Kiểm tra lịch trống khi đặt bàn"}
            </div>
            <button className="btn-book-full" onClick={handleBookTable} disabled={isPreviewMode || !canReserve}>
              Tiếp tục đặt bàn
            </button>
          </div>

          {/* Gợi ý nhà hàng tương tự */}
          <div className="similar-widget">
            <h3>Có thể bạn thích</h3>
            <SimilarRestaurants
              currentRestaurantId={resolvedRestaurant.id}
              cuisine={resolvedRestaurant.cuisine}
              district={resolvedRestaurant.district}
            />
          </div>
        </aside>
      </div>

      {/* Mobile Floating Button */}
      <div className="mobile-action-bar mobile-only">
        <button className="btn-book-mobile" onClick={handleBookTable} disabled={isPreviewMode || !canReserve}>
          {resolvedRestaurant.canReserve ? "Đặt bàn ngay" : "Hiện không nhận đặt bàn"}
        </button>
      </div>
    </div>
  );
};

export default RestaurantDetail;

