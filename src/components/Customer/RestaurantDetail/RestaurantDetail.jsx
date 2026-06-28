import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Clock, Heart, MapPin, Share2, Star } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";
import { getOpeningStatusLabel, getRestaurantPrimaryCTA } from "@/utils/restaurantStatus";
import MenuSection from "./components/MenuSection/MenuSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import PromotionsSection from "./components/PromotionsSection/PromotionsSection";
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";

import "./RestaurantDetail.scss";
import "./RestaurantDetail.refinements.scss";
import "./RestaurantDetail.fallbacks.scss";

const DETAIL_FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=82",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=82",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=82",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=82",
  "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=1600&q=82",
];

const formatAddressText = (address = {}) => {
  return [address.line1, address.district, address.city].filter(Boolean).join(", ");
};

const isPlaceholderAsset = (url = "") => {
  const normalizedUrl = String(url || "").trim().toLowerCase();
  return (
    !normalizedUrl ||
    normalizedUrl.includes("default-") ||
    normalizedUrl.includes("/default") ||
    normalizedUrl.includes("picsum.photos") ||
    normalizedUrl.includes("source.unsplash") ||
    normalizedUrl.includes("/random")
  );
};

const getStableIndex = (value = "") => {
  const source = String(value || "restaurant");
  return source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

const getFallbackCoverUrl = (restaurantId) => {
  const index = getStableIndex(restaurantId) % DETAIL_FALLBACK_COVERS.length;
  return DETAIL_FALLBACK_COVERS[index];
};

const getRestaurantInitials = (name = "") => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "FH";
  return words.map((word) => word[0]).join("").toUpperCase();
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

const MY_RESTAURANT_FAVORITES = gql`
  query MyRestaurantFavoritesForDetail {
    myFavorites(type: "restaurant") {
      id
      targetId
    }
  }
`;

const TOGGLE_RESTAURANT_FAVORITE = gql`
  mutation ToggleRestaurantFavoriteForDetail($input: ToggleFavoriteInput!) {
    toggleFavorite(input: $input) {
      id
      type
      targetId
    }
  }
`;

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useContext(AuthContext) || {};

  const isPreviewMode = new URLSearchParams(location.search).get("preview") === "1";

  const { data: restaurantData, loading, error } = useQuery(GET_PUBLIC_RESTAURANT, {
    variables: { id },
    skip: !id,
  });
  const { data: reviewStatsData } = useQuery(GET_RESTAURANT_REVIEW_STATS, {
    variables: { restaurantId: id },
    skip: !id,
  });
  const {
    data: favoriteData,
    refetch: refetchRestaurantFavorites,
  } = useQuery(MY_RESTAURANT_FAVORITES, {
    skip: isPreviewMode || !isAuthenticated || !user?.id,
    fetchPolicy: "cache-and-network",
  });
  const [toggleRestaurantFavorite, { loading: favoriteLoading }] = useMutation(
    TOGGLE_RESTAURANT_FAVORITE,
    {
      onCompleted: () => refetchRestaurantFavorites?.(),
    },
  );

  const [activeTab, setActiveTab] = useState("info");
  const [isScrolled, setIsScrolled] = useState(false);
  const [previewRestaurantOverride, setPreviewRestaurantOverride] = useState(null);

  const favoriteRestaurantIds = useMemo(
    () => new Set((favoriteData?.myFavorites || []).map((favorite) => String(favorite?.targetId))),
    [favoriteData?.myFavorites],
  );

  useEffect(() => {
    const tabFromHash =
      location.hash === "#reviews"
        ? "reviews"
        : location.hash === "#promotions"
        ? "promotions"
        : location.state?.openTab;
    if (!["reviews", "promotions"].includes(tabFromHash)) return;

    setActiveTab(tabFromHash);
    window.setTimeout(() => {
      const selector = tabFromHash === "promotions" ? ".promo-section" : ".reviews-section";
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [location.hash, location.state]);

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

  const favoriteActive = favoriteRestaurantIds.has(String(resolvedRestaurant.id));
  const canReserve = !!resolvedRestaurant.canReserve;
  const primaryCtaText = getRestaurantPrimaryCTA({
    canReserve: resolvedRestaurant.canReserve,
    openingStatus: resolvedRestaurant.openingStatus,
  });
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

  const handleFavorite = async () => {
    if (isPreviewMode || favoriteLoading) return;

    if (!isAuthenticated || !user?.id) {
      navigate("/login", { state: { from: location } });
      return;
    }

    try {
      await toggleRestaurantFavorite({
        variables: {
          input: {
            type: "restaurant",
            targetId: resolvedRestaurant.id,
          },
        },
      });
    } catch {
      // Notification system is not guaranteed on this public page; keep UX stable.
    }
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

  const rawAvatarUrl = resolvedRestaurant.avatar || resolvedRestaurant.imgAvaUrl || "";
  const hasRealAvatar = !isPlaceholderAsset(rawAvatarUrl);
  const avatarInitials = getRestaurantInitials(resolvedRestaurant.name);
  const rawCoverUrl = resolvedRestaurant.coverImage || resolvedRestaurant.imgThumbUrl || "";
  const hasCoverImage = !isPlaceholderAsset(rawCoverUrl);
  const imgThumbUrl = hasCoverImage ? rawCoverUrl : getFallbackCoverUrl(resolvedRestaurant.id);
  const cuisineText = resolvedRestaurant.cuisine || "Ẩm thực đang cập nhật";
  const areaText =
    resolvedRestaurant.district ||
    resolvedRestaurant.address?.district ||
    resolvedRestaurant.address?.city ||
    "Khu vực đang cập nhật";
  const reviewSummaryText = headerReviewCount > 0 ? `${headerReviewCount} đánh giá` : "Chưa có đánh giá";
  const profileSummaryItems = [cuisineText, areaText, reviewSummaryText];

  const aiQuickPrompts = [
    { label: "Món bán chạy", message: "Gợi ý món bán chạy" },
    { label: "Món dưới 100k", message: "Gợi ý món dưới 100k" },
    { label: "Combo cho 2 người", message: "Gợi ý combo cho 2 người" },
    { label: "Đặt bàn", message: "Tôi muốn đặt bàn ở nhà hàng này" },
    { label: "Giờ mở cửa", message: "Nhà hàng này đang mở cửa không?" },
    { label: "Ưu đãi", message: "Nhà hàng này có mã giảm giá hoặc ưu đãi nào không?" },
    { label: "Đánh giá", message: "Xem đánh giá nhà hàng" },
  ];
  return (
    <div className="restaurant-detail-page">
      <section className="rd-hero">
        <div
          className={`hero-cover ${hasCoverImage ? "has-cover" : "fallback-cover"}`}
          style={{ backgroundImage: `url(${imgThumbUrl})` }}
        >
          <div className="overlay" />
          {!hasCoverImage && (
            <div className="fallback-cover-copy" aria-hidden="true">
              <span>FoodHub Pick</span>
              <strong>{cuisineText}</strong>
            </div>
          )}
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
          <div className={`res-info-card ${!hasCoverImage ? "res-info-card--compact" : ""}`}>
            <div className="avatar-wrapper">
              {hasRealAvatar ? (
                <img src={rawAvatarUrl} alt={resolvedRestaurant.name} />
              ) : (
                <div className="avatar-fallback" aria-label={`Logo ${resolvedRestaurant.name}`}>
                  <span>{avatarInitials}</span>
                  <small>FoodHub</small>
                </div>
              )}
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
                <span className="cuisine">{cuisineText}</span>
                <span className="dot">•</span>
                <span className={`status ${resolvedRestaurant.openingStatus || "closed"}`}>
                  {getOpeningStatusLabel(resolvedRestaurant.openingStatus)}
                </span>
              </div>

              <div className="res-address">
                <MapPin size={16} /> {resolvedRestaurant.addressText || "Địa chỉ đang cập nhật"}
              </div>

              <div className="profile-summary">
                {profileSummaryItems.map((item, idx) => (
                  <span key={`${item}-${idx}`} className="summary-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="action-group">
              <div className="icon-actions">
                <button
                  type="button"
                  className={`btn-icon ${favoriteActive ? "active" : ""}`}
                  disabled={isPreviewMode || favoriteLoading}
                  onClick={handleFavorite}
                  aria-pressed={favoriteActive}
                  title={favoriteActive ? "Bỏ lưu nhà hàng" : "Lưu nhà hàng yêu thích"}
                >
                  <Heart size={20} />
                </button>
                <button type="button" className="btn-icon" disabled={isPreviewMode} onClick={handleShare}>
                  <Share2 size={20} />
                </button>
              </div>
              <button
                type="button"
                className="btn-book desktop-only"
                onClick={handleBookTable}
                disabled={isPreviewMode || !canReserve}
              >
                {primaryCtaText}
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
          <div className="booking-widget booking-widget--ai">
            <h3>AI hỗ trợ nhà hàng</h3>
            <p>Hỏi nhanh về món, combo, ưu đãi, giờ mở cửa hoặc đặt bàn</p>
            <button
              type="button"
              className="btn-book-full"
              onClick={() => openAiMenuAssistant({ message: "Gợi ý món cho 2 người dưới 100k", autoSend: false, restaurantId: resolvedRestaurant.id })}
            >
              Hỏi AI ngay
            </button>
            <div className="quick-prompts">
              {aiQuickPrompts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="prompt-chip"
                  onClick={() => openAiMenuAssistant({ message: item.message, autoSend: true, restaurantId: resolvedRestaurant.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="booking-widget booking-widget--primary-cta">
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
              {primaryCtaText}
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
          {primaryCtaText}
        </button>
      </div>
    </div>
  );
};

export default RestaurantDetail;
