import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Clock, Heart, MapPin, Share2, Star } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";
import { getOpeningStatusLabel, getRestaurantPrimaryCTA } from "@/utils/restaurantStatus";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";
import MenuSection from "./components/MenuSection/MenuSection";
import PhotoGallery from "./components/PhotoGallery/PhotoGallery";
import PromotionsSection from "./components/PromotionsSection/PromotionsSection";
import RestaurantInfo from "./components/RestaurantInfo/RestaurantInfo";
import ReviewsSection from "./components/ReviewsSection/ReviewsSection";
import SimilarRestaurants from "./components/SimilarRestaurants/SimilarRestaurants";

import "./RestaurantDetail.scss";
import "./RestaurantDetail.refinements.scss";
import "./RestaurantDetail.fallbacks.scss";
import "./RestaurantDetail.complete.scss";

const formatAddressText = (address = {}) =>
  [address.line1, address.ward, address.district, address.city]
    .filter(Boolean)
    .join(", ");

const isPlaceholderAsset = (url = "") => {
  const normalizedUrl = String(url || "").trim().toLowerCase();
  return (
    !normalizedUrl ||
    normalizedUrl.includes("default-") ||
    normalizedUrl.includes("/default") ||
    normalizedUrl.includes("picsum.photos") ||
    normalizedUrl.includes("source.unsplash") ||
    normalizedUrl.includes("images.unsplash.com") ||
    normalizedUrl.includes("/random")
  );
};

const getRestaurantInitials = (name = "") => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "CH";
  return words.map((word) => word[0]).join("").toUpperCase();
};

const getServiceSummary = (restaurant = {}) => {
  const labels = [];
  if (restaurant.canTableOrder) labels.push("Gọi món tại bàn");
  if (restaurant.canDelivery) labels.push("Giao hàng");
  if (restaurant.canPickup) labels.push("Mang đi");
  if (restaurant.canOrder && labels.length === 0) labels.push("Đặt món online");
  return labels.slice(0, 2).join(" · ") || "Dịch vụ đang cập nhật";
};

const getGalleryPhotos = (restaurant = {}) => {
  const preferred = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos
    : restaurant.spaceImages;

  return (Array.isArray(preferred) ? preferred : []).filter((photo) => {
    const url = typeof photo === "string" ? photo : photo?.url;
    return !isPlaceholderAsset(url);
  });
};

const GET_PUBLIC_RESTAURANT = gql`
  query GetPublicRestaurant($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      avatar
      coverImage
      spaceImages
      vrTourUrl
      description
      cuisineType
      avgRating
      reviewCount
      priceRange
      seatingCapacity
      openingHours
      closingHours
      notesOnHours
      weeklyOpeningHours
      specialHours
      timezone
      openingStatus
      openingStatusReason
      nextOpeningTime
      canReserve
      canOrder
      canTableOrder
      canDelivery
      canPickup
      amenities
      notesOnAmenities
      reservationPolicy
      reservationSettings {
        baseDepositAmount
        menuDepositPercent
        changeTimeFee
        changeTableFee
        vatRate
        serviceFee
      }
      address {
        line1
        line2
        ward
        district
        city
        country
        postalCode
        lat
        lng
      }
      phone
      email
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

const RECORD_RECENT_RESTAURANT = gql`
  mutation RecordRecentRestaurantForDetail($restaurantId: ID!) {
    recordRecentRestaurant(restaurantId: $restaurantId)
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
    { onCompleted: () => refetchRestaurantFavorites?.() },
  );
  const [recordRecentRestaurant] = useMutation(RECORD_RECENT_RESTAURANT);
  const recordedRestaurantIdRef = React.useRef(null);
  const recordingRestaurantIdRef = React.useRef(null);
  const isCustomer = String(
    user?.userType || user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase() === "customer";

  const [activeTab, setActiveTab] = useState("info");
  const [isScrolled, setIsScrolled] = useState(false);
  const [previewRestaurantOverride, setPreviewRestaurantOverride] = useState(null);
  const [shareStatus, setShareStatus] = useState("");

  const favoriteRestaurantIds = useMemo(
    () => new Set((favoriteData?.myFavorites || []).map((favorite) => String(favorite?.targetId))),
    [favoriteData?.myFavorites],
  );

  useEffect(() => {
    const tabFromHash =
      location.hash === "#menu"
        ? "menu"
        : location.hash === "#reviews"
          ? "reviews"
          : location.hash === "#promotions"
            ? "promotions"
            : location.hash === "#photos"
              ? "photos"
              : location.state?.openTab;

    if (!["menu", "reviews", "promotions", "photos"].includes(tabFromHash)) return;

    setActiveTab(tabFromHash);
    window.setTimeout(() => {
      const selectorByTab = {
        menu: "#rd-panel-menu",
        promotions: ".promo-section",
        photos: ".photo-gallery",
        reviews: ".reviews-section",
      };
      document
        .querySelector(selectorByTab[tabFromHash])
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [location.hash, location.state]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!shareStatus) return undefined;
    const timer = window.setTimeout(() => setShareStatus(""), 2500);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

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

  useEffect(() => {
    const loadedRestaurantId = restaurantData?.publicRestaurant?.id;
    if (isPreviewMode || !isAuthenticated || !isCustomer || !user?.id || !loadedRestaurantId) return;
    if (recordedRestaurantIdRef.current === loadedRestaurantId) return;
    if (recordingRestaurantIdRef.current === loadedRestaurantId) return;

    recordingRestaurantIdRef.current = loadedRestaurantId;
    recordRecentRestaurant({ variables: { restaurantId: loadedRestaurantId } })
      .then(() => {
        recordedRestaurantIdRef.current = loadedRestaurantId;
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn("Không thể ghi nhận nhà hàng đã xem gần đây.", err);
        }
      })
      .finally(() => {
        if (recordingRestaurantIdRef.current === loadedRestaurantId) {
          recordingRestaurantIdRef.current = null;
        }
      });
  }, [
    id,
    isAuthenticated,
    isCustomer,
    isPreviewMode,
    recordRecentRestaurant,
    restaurantData?.publicRestaurant?.id,
    user?.id,
  ]);

  const restaurant = restaurantData?.publicRestaurant;

  if (loading) {
    return (
      <div className="detail-loading" role="status" aria-live="polite">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !restaurant) {
    return <div className="detail-error" role="alert">Không tìm thấy nhà hàng.</div>;
  }

  const mergedAddress = {
    ...(restaurant.address || {}),
    ...(previewRestaurantOverride?.address || {}),
  };

  const resolvedRestaurant = {
    ...restaurant,
    ...(previewRestaurantOverride || {}),
    address: mergedAddress,
    district:
      previewRestaurantOverride?.district ||
      restaurant.district ||
      mergedAddress.district ||
      "",
    cuisine:
      previewRestaurantOverride?.cuisine ||
      restaurant.cuisine ||
      restaurant.cuisineType ||
      "",
    addressText:
      previewRestaurantOverride?.addressText ||
      restaurant.addressText ||
      formatAddressText(mergedAddress),
  };

  const favoriteActive = favoriteRestaurantIds.has(String(resolvedRestaurant.id));
  const canReserve = Boolean(resolvedRestaurant.canReserve);
  const primaryCtaText = getRestaurantPrimaryCTA({
    canReserve: resolvedRestaurant.canReserve,
    openingStatus: resolvedRestaurant.openingStatus,
  });
  const galleryPhotos = getGalleryPhotos(resolvedRestaurant);

  const reviewStats = reviewStatsData?.reviewStats;
  const headerReviewCount = reviewStats?.total ?? resolvedRestaurant.reviewCount ?? 0;
  const headerRating = headerReviewCount > 0
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
      // The public page must remain usable when the favorite request fails.
    }
  };

  const handleShare = async () => {
    if (isPreviewMode) return;

    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: resolvedRestaurant.name, url });
        setShareStatus("Đã mở tùy chọn chia sẻ.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Đã sao chép liên kết nhà hàng.");
      }
    } catch {
      // Ignore cancelled native share dialogs and clipboard permission failures.
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
  const cuisineText = resolvedRestaurant.cuisine || "Ẩm thực đang cập nhật";
  const areaText =
    resolvedRestaurant.district ||
    resolvedRestaurant.address?.district ||
    resolvedRestaurant.address?.city ||
    "Khu vực đang cập nhật";
  const priceText = resolvedRestaurant.priceRange || "Mức giá đang cập nhật";
  const serviceText = getServiceSummary(resolvedRestaurant);
  const profileSummaryItems = [priceText, areaText, serviceText];

  const aiQuickPrompts = [
    { label: "Thực đơn", message: "Xem thực đơn nhà hàng" },
    { label: "Món bán chạy", message: "Gợi ý món bán chạy" },
    { label: "Món dưới 100k", message: "Gợi ý món dưới 100k" },
    { label: "Combo cho 2 người", message: "Gợi ý combo cho 2 người" },
    { label: "Đặt bàn", message: "Tôi muốn đặt bàn ở nhà hàng này" },
    { label: "Giờ mở cửa", message: "Nhà hàng này đang mở cửa không?" },
    { label: "Ưu đãi", message: "Nhà hàng này có mã giảm giá hoặc ưu đãi nào không?" },
    { label: "Đánh giá", message: "Xem đánh giá nhà hàng" },
  ];

  return (
    <main className="restaurant-detail-page">
      <section className="rd-hero" aria-labelledby="restaurant-detail-title">
        <div
          className={`hero-cover ${hasCoverImage ? "has-cover" : "fallback-cover"}`}
          style={hasCoverImage ? { backgroundImage: `url(${rawCoverUrl})` } : undefined}
        >
          <div className="overlay" />
          {!hasCoverImage && (
            <div className="fallback-cover-copy" aria-label="Ảnh không gian đang được cập nhật">
              <span>COHAN RESTAURANT</span>
              <strong>{cuisineText}</strong>
              <small>Ảnh không gian đang được cập nhật</small>
            </div>
          )}
          <button
            type="button"
            className="btn-back"
            aria-label="Quay lại trang trước"
            onClick={() => {
              if (!isPreviewMode) navigate(-1);
            }}
            disabled={isPreviewMode}
          >
            <ArrowLeft size={24} aria-hidden="true" />
          </button>
        </div>

        <div className="hero-content container">
          <div className={`res-info-card ${!hasCoverImage ? "res-info-card--compact" : ""}`}>
            <div className="avatar-wrapper">
              {hasRealAvatar ? (
                <img src={rawAvatarUrl} alt={`Logo ${resolvedRestaurant.name}`} />
              ) : (
                <div className="avatar-fallback" aria-label={`Logo ${resolvedRestaurant.name}`}>
                  <span>{avatarInitials}</span>
                  <small>Cohan</small>
                </div>
              )}
            </div>

            <div className="info-text">
              <div className="bread-crumbs">Trang chủ / Nhà hàng / {areaText}</div>
              <h1 className="res-name" id="restaurant-detail-title">{resolvedRestaurant.name}</h1>

              <div className="res-meta" aria-label="Thông tin nhanh của nhà hàng">
                <span className="rating">
                  <Star size={16} fill="currentColor" aria-hidden="true" />
                  <strong>{headerRating}</strong>
                  {headerReviewCount > 0 && <span> ({headerReviewCount} đánh giá)</span>}
                </span>
                <span className="dot" aria-hidden="true">•</span>
                <span className="cuisine">{cuisineText}</span>
                <span className="dot" aria-hidden="true">•</span>
                <span className={`status ${resolvedRestaurant.openingStatus || "closed"}`}>
                  {getOpeningStatusLabel(resolvedRestaurant.openingStatus)}
                </span>
              </div>

              <div className="res-address">
                <MapPin size={16} aria-hidden="true" />
                {resolvedRestaurant.addressText || "Địa chỉ đang cập nhật"}
              </div>

              <div className="profile-summary" aria-label="Thông tin cần biết">
                {profileSummaryItems.map((item) => (
                  <span key={item} className="summary-chip">{item}</span>
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
                  aria-label={favoriteActive ? "Bỏ lưu nhà hàng yêu thích" : "Lưu nhà hàng yêu thích"}
                  title={favoriteActive ? "Bỏ lưu nhà hàng" : "Lưu nhà hàng yêu thích"}
                >
                  <Heart size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={isPreviewMode}
                  onClick={handleShare}
                  aria-label="Chia sẻ nhà hàng"
                >
                  <Share2 size={20} aria-hidden="true" />
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
              <span className="share-feedback" role="status" aria-live="polite">
                {shareStatus}
              </span>
            </div>
          </div>
        </div>
      </section>

      <nav className={`rd-tabs ${isScrolled ? "stuck" : ""}`} aria-label="Nội dung nhà hàng">
        <div className="container tab-scroll" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`rd-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`rd-panel-${tab.id}`}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => !isPreviewMode && setActiveTab(tab.id)}
              disabled={isPreviewMode}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="rd-container container">
        <section
          className="main-content"
          id={`rd-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`rd-tab-${activeTab}`}
        >
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
          {activeTab === "photos" && <PhotoGallery photos={galleryPhotos} restaurantName={resolvedRestaurant.name} />}
          {activeTab === "info" && (
            <RestaurantInfo restaurant={resolvedRestaurant} isPreviewMode={isPreviewMode} />
          )}
        </section>

        <aside className="sidebar-content" aria-label="Hành động nhà hàng">
          <div className="booking-widget booking-widget--primary-cta">
            <h3>Đặt bàn giữ chỗ</h3>
            <p>Xem bàn trống, điều kiện đặt chỗ và chi phí trước khi xác nhận.</p>
            <div className="time-picker-mock">
              <Clock size={16} aria-hidden="true" />
              {resolvedRestaurant.openingStatusReason || "Kiểm tra lịch trống khi đặt bàn"}
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

          <div className="booking-widget booking-widget--ai">
            <h3>Hỏi nhanh trước khi chọn</h3>
            <p>Tra cứu món, combo, ưu đãi, giờ mở cửa hoặc hỗ trợ đặt bàn.</p>
            <button
              type="button"
              className="btn-book-full"
              onClick={() => openAiMenuAssistant({
                message: "Gợi ý món cho 2 người dưới 100k",
                autoSend: false,
                restaurantId: resolvedRestaurant.id,
              })}
            >
              Hỏi AI
            </button>
            <div className="quick-prompts" aria-label="Gợi ý câu hỏi nhanh">
              {aiQuickPrompts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="prompt-chip"
                  onClick={() => openAiMenuAssistant({
                    message: item.message,
                    autoSend: true,
                    restaurantId: resolvedRestaurant.id,
                  })}
                >
                  {item.label}
                </button>
              ))}
            </div>
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
    </main>
  );
};

export default RestaurantDetail;
