import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { ArrowLeft, Clock, Heart, MapPin, Share2, Star } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getOpeningStatusLabel } from "@/utils/restaurantStatus";
import MenuSection from "./components/MenuSection/MenuSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import PromotionsSection from "./components/PromotionsSection/PromotionsSection";
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";

import "./RestaurantDetail.scss";

const FAVORITES_STORAGE_KEY = "restaurant_favorites";

const readFavoriteIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
};

const formatAddressText = (address = {}) => {
  return [address.line1, address.district, address.city].filter(Boolean).join(", ");
};

const GET_PUBLIC_RESTAURANT = gql`
  query GetPublicRestaurant($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      avatar
      coverImage
      spaceImages
      description
      cuisineType
      avgRating
      reviewCount
      openingStatus
      openingStatusReason
      canReserve
      canOrder
      address {
        line1
        district
        city
        lat
        lng
      }
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

  const { data: restaurantData, loading, error } = useQuery(GET_PUBLIC_RESTAURANT, {
    variables: { id },
    skip: !id,
  });
  const { data: reviewStatsData } = useQuery(GET_RESTAURANT_REVIEW_STATS, {
    variables: { restaurantId: id },
    skip: !id,
  });

  const [activeTab, setActiveTab] = useState("info");
  const [favoriteActive, setFavoriteActive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [previewRestaurantOverride, setPreviewRestaurantOverride] = useState(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isPreviewMode) return undefined;

    const onPreviewMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "restaurant-preview:update") return;
      setPreviewRestaurantOverride(event.data.payload || null);
    };

    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, [isPreviewMode]);

  const restaurant = restaurantData?.publicRestaurant;

  useEffect(() => {
    if (!restaurant?.id) return;
    const ids = readFavoriteIds();
    setFavoriteActive(ids.has(String(restaurant.id)));
  }, [restaurant?.id]);

  if (loading) {
    return (
      <div className="detail-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !restaurant) {
    return <div className="detail-error">Không tìm thấy nhà hàng.</div>;
  }

  const mergedAddress = {
    ...(restaurant.address || {}),
    ...(previewRestaurantOverride?.address || {}),
  };

  const resolvedRestaurant = {
    ...restaurant,
    ...(previewRestaurantOverride || {}),
    address: mergedAddress,
    district: previewRestaurantOverride?.district || restaurant.district || mergedAddress.district || "",
    cuisine: previewRestaurantOverride?.cuisine || restaurant.cuisine || restaurant.cuisineType || "",
    addressText: previewRestaurantOverride?.addressText || restaurant.addressText || formatAddressText(mergedAddress),
  };

  const canReserve = !!resolvedRestaurant.canReserve;
  const galleryPhotos = resolvedRestaurant.photos || resolvedRestaurant.spaceImages || [];

  const reviewStats = reviewStatsData?.reviewStats;
  const headerReviewCount = reviewStats?.total ?? resolvedRestaurant.reviewCount ?? 0;
  const headerRating =
    headerReviewCount > 0
      ? Number(reviewStats?.avgRating ?? resolvedRestaurant.avgRating ?? 0).toFixed(1)
      : "Chưa có đánh giá";

  const handleBookTable = () => {
    if (isPreviewMode || !canReserve) return;
    navigate(`/restaurant/${resolvedRestaurant.id}/layout`);
  };

  const handleFavorite = () => {
    if (isPreviewMode) return;

    if (!localStorage.getItem("token")) {
      navigate("/login", { state: { from: location } });
      return;
    }

    const favoriteIds = readFavoriteIds();
    const targetId = String(resolvedRestaurant.id);
    if (favoriteIds.has(targetId)) favoriteIds.delete(targetId);
    else favoriteIds.add(targetId);

    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteIds]));
    setFavoriteActive(favoriteIds.has(targetId));
  };

  const handleShare = async () => {
    if (isPreviewMode) return;

    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: resolvedRestaurant.name, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore cancelled share dialog / clipboard failures
    }
  };

  const tabs = [
    { id: "info", label: "Thông tin" },
    { id: "menu", label: "Thực đơn" },
    { id: "reviews", label: "Đánh giá" },
    { id: "promotions", label: "Khuyến mãi" },
    { id: "photos", label: "Hình ảnh" },
  ];

  const imgAvaUrl = resolvedRestaurant.avatar || resolvedRestaurant.imgAvaUrl || "/default-avatar.png";
  const hasCoverImage = Boolean(resolvedRestaurant.coverImage || resolvedRestaurant.imgThumbUrl);
  const imgThumbUrl = hasCoverImage
    ? resolvedRestaurant.coverImage || resolvedRestaurant.imgThumbUrl
    : null;
const aiQuickPrompts = [
    { label: "Món bán chạy", message: "Gợi ý món bán chạy" },
    { label: "Món dưới 100k", message: "Gợi ý món dưới 100k" },
    { label: "Món chay", message: "Gợi ý món chay" },
    { label: "Combo cho 2 người", message: "Gợi ý combo cho 2 người" },
  ];
  return (
    <div className="restaurant-detail-page">
      <section className="rd-hero">
        <div
          className={`hero-cover ${hasCoverImage ? "has-cover" : "no-cover"}`}
          style={imgThumbUrl ? { backgroundImage: `url(${imgThumbUrl})` } : undefined}
        >
          <div className="overlay" />
          <button
            type="button"
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
              <div className="bread-crumbs">Trang chủ / Nhà hàng / {resolvedRestaurant.district}</div>
              <h1 className="res-name">{resolvedRestaurant.name}</h1>

              <div className="res-meta">
                <span className="rating">
                  <Star size={16} fill="#f59e0b" stroke="none" />
                  <strong>{headerRating}</strong>
                  {headerReviewCount > 0 && <span> ({headerReviewCount} đánh giá)</span>}
                </span>
                <span className="dot">•</span>
                <span className="cuisine">{resolvedRestaurant.cuisine}</span>
                <span className="dot">•</span>
                <span className={`status ${resolvedRestaurant.openingStatus || "closed"}`}>
                  {getOpeningStatusLabel(resolvedRestaurant.openingStatus)}
                </span>
              </div>

              <div className="res-address">
                <MapPin size={16} /> {resolvedRestaurant.addressText || "Địa chỉ đang cập nhật"}
              </div>
            </div>

            <div className="action-group">
              <button
                type="button"
                className={`btn-icon ${favoriteActive ? "active" : ""}`}
                disabled={isPreviewMode}
                onClick={handleFavorite}
              >
                <Heart size={20} />
              </button>
              <button type="button" className="btn-icon" disabled={isPreviewMode} onClick={handleShare}>
                <Share2 size={20} />
              </button>
              <button
                type="button"
                className="btn-book desktop-only"
                onClick={handleBookTable}
                disabled={isPreviewMode || !canReserve}
              >
                {canReserve ? "Đặt bàn ngay" : "Hiện không nhận đặt bàn"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className={`rd-tabs ${isScrolled ? "stuck" : ""}`}>
        <div className="container tab-scroll">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => !isPreviewMode && setActiveTab(tab.id)}
              disabled={isPreviewMode}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-container container">
        <div className="main-content">
          {activeTab === "menu" && (
            <MenuSection
              restaurantId={resolvedRestaurant.id}
              canOrder={resolvedRestaurant.canOrder}
              openingStatus={resolvedRestaurant.openingStatus}
              openingStatusReason={resolvedRestaurant.openingStatusReason}
              restaurant={resolvedRestaurant}
            />
          )}
          {activeTab === "reviews" && <ReviewsSection restaurantId={resolvedRestaurant.id} />}
          {activeTab === "promotions" && <PromotionsSection restaurantId={resolvedRestaurant.id} />}
          {activeTab === "photos" && <PhotoGallery photos={galleryPhotos} />}
          {activeTab === "info" && <RestaurantInfo restaurant={resolvedRestaurant} isPreviewMode={isPreviewMode} />}
        </div>

        <aside className="sidebar-content">
          <div className="booking-widget">
            <h3>AI gợi ý món</h3>
            <p>Cho mình biết ngân sách, số người hoặc khẩu vị</p>
            <button
              type="button"
              className="btn-book-full"
              onClick={() => openAiMenuAssistant({ message: "Gợi ý món cho 2 người dưới 100k", autoSend: false, restaurantId: resolvedRestaurant.id })}
            >
              AI gợi ý món
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {aiQuickPrompts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="btn-icon"
                  style={{ width: "auto", padding: "6px 10px", borderRadius: 999 }}
                  onClick={() => openAiMenuAssistant({ message: item.message, autoSend: true, restaurantId: resolvedRestaurant.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="booking-widget">
            <h3>Đặt bàn giữ chỗ</h3>
            <p>Giữ chỗ miễn phí - Xác nhận tức thì</p>
            <div className="time-picker-mock">
              <Clock size={16} /> {resolvedRestaurant.openingStatusReason || "Kiểm tra lịch trống khi đặt bàn"}
            </div>
            <button
              type="button"
              className="btn-book-full"
              onClick={handleBookTable}
              disabled={isPreviewMode || !canReserve}
            >
              Tiếp tục đặt bàn
            </button>
          </div>

          <div className="similar-widget">
            <h3>Có thể bạn thích</h3>
            <SimilarRestaurants
              variant="compact"
              currentRestaurantId={resolvedRestaurant.id}
              cuisine={resolvedRestaurant.cuisine}
              district={resolvedRestaurant.district}
            />
          </div>
        </aside>
      </div>

      <div className="mobile-action-bar mobile-only">
        <button
          type="button"
          className="btn-book-mobile"
          onClick={handleBookTable}
          disabled={isPreviewMode || !canReserve}
        >
          {canReserve ? "Đặt bàn ngay" : "Hiện không nhận đặt bàn"}
        </button>
      </div>
    </div>
  );
};

export default RestaurantDetail;
