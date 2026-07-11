import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { CheckCircle2, LocateFixed, MapPin, Navigation, Star } from "lucide-react";
import "../../../../styles/Homepage/RestaurantGrid.scss";
import { hasIconInCategoryName, resolveCategoryIcon } from "../../../../utils/categoryIconMap";

const DEFAULT_NEARBY_RADIUS_KM = 20;
const DEFAULT_RESTAURANT_LIMIT = 3;

// --- GRAPHQL QUERY ---
const GET_TOP_RESTAURANTS = gql`
  query GetTopRestaurants($limit: Int, $restaurantFilter: RestaurantFilter) {
    restaurantsTop(limit: $limit, restaurantFilter: $restaurantFilter) {
      id
      name
      coverImage
      avatar
      description
      priceRange
      openingHours
      closingHours
      openingStatus
      canReserve
      canOrder
      canDelivery
      canPickup
      orderCount
      reservationCount
      avgRating
      address {
        line1
        line2
        ward
        district
        city
        country
        lat
        lng
      }
    }
  }
`;

const GET_RESTAURANTS_NEARBY = gql`
  query GetRestaurantsNearby(
    $lat: Float!
    $lng: Float!
    $radiusKm: Float
    $limit: Int
    $restaurantFilter: RestaurantFilter
  ) {
    restaurantsNearby(
      lat: $lat
      lng: $lng
      radiusKm: $radiusKm
      limit: $limit
      restaurantFilter: $restaurantFilter
    ) {
      id
      name
      coverImage
      avatar
      description
      priceRange
      openingHours
      closingHours
      openingStatus
      canReserve
      canOrder
      canDelivery
      canPickup
      orderCount
      reservationCount
      avgRating
      distanceKm
      straightLineDistanceKm
      roadDistanceKm
      estimatedTravelMinutes
      distanceSource
      address {
        line1
        line2
        ward
        district
        city
        country
        lat
        lng
      }
    }
  }
`;

const GET_RESTAURANTS_BY_CATEGORY_TIME_SLOT = gql`
  query GetRestaurantsByCategoryTimeSlot($categoryId: ID!, $timeSlot: TimeSlot!, $limit: Int = 50) {
    restaurantsByCategoryTimeSlot(categoryId: $categoryId, timeSlot: $timeSlot, limit: $limit) {
      id
      name
      coverImage
      avatar
      description
      priceRange
      openingHours
      closingHours
      openingStatus
      canReserve
      canOrder
      canDelivery
      canPickup
      avgRating
      orderCount
      reservationCount
      tableParticipationCount
      address {
        line1
        line2
        ward
        district
        city
        country
        lat
        lng
      }
    }
  }
`;

const formatAddress = (addr) => {
  if (!addr) return "";
  const parts = [addr.line1, addr.line2, addr.ward, addr.district, addr.city, addr.country]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};

const formatHours = (opening, closing) => {
  if (!opening && !closing) return "";
  if (opening && closing) return `${opening} - ${closing}`;
  return opening || closing;
};

const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
};

const nullableNumber = (value) => {
  if (value == null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const formatDistanceMeta = ({ distanceSource, distanceKm, estimatedTravelMinutes }) => {
  const distanceText = formatDistance(distanceKm);
  if (!distanceText) return null;

  const minutes = Number(estimatedTravelMinutes);
  const hasDuration = Number.isFinite(minutes) && minutes >= 0;
  const durationText = hasDuration ? `khoảng ${Math.max(1, Math.round(minutes))} phút` : null;

  if (distanceSource === "road") {
    return durationText
      ? `Đường đi ${distanceText} • ${durationText}`
      : `Cách bạn ${distanceText} đường đi`;
  }

  return `Cách bạn khoảng ${distanceText}`;
};

const formatRating = (rating) => {
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return { value: null, ariaLabel: "Nhà hàng chưa có đánh giá" };
  }

  return { value: rating.toFixed(1), ariaLabel: `Điểm đánh giá ${rating.toFixed(1)}` };
};

const RESTAURANT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
];

const TECHNICAL_TEXT_PATTERNS = [
  /\[[^\]]*(?:demo|pr\d+|scheduling)[^\]]*\]/gi,
  /\bPR\s*\d+\s*demo\b/gi,
  /\bdemo[-_\s]*(?:scheduling|restaurant|data|pr\d+)\b/gi,
  /\b(?:scheduling|seed|placeholder|test)[-_\s]*pr\d+\b/gi,
];

const cleanTechnicalText = (value = "") => {
  let normalized = String(value || "").trim();

  TECHNICAL_TEXT_PATTERNS.forEach((pattern) => {
    normalized = normalized.replace(pattern, " ");
  });

  return normalized.replace(/\s{2,}/g, " ").trim();
};

const hasTechnicalPlaceholderText = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;

  return (
    /\[[^\]]*(?:demo|pr\d+|scheduling)[^\]]*\]/i.test(normalized) ||
    /\bpr\s*\d+\s*demo\b/i.test(normalized) ||
    /\bdemo[-_\s]*(?:scheduling|restaurant|data|pr\d+)\b/i.test(normalized) ||
    /\b(?:placeholder|test address|địa chỉ test|dia chi test)\b/i.test(normalized)
  );
};

const toCustomerText = (value, fallback, { allowEmpty = false } = {}) => {
  const cleaned = cleanTechnicalText(value);
  if (!cleaned || hasTechnicalPlaceholderText(value)) {
    return allowEmpty ? "" : fallback;
  }

  return cleaned;
};

const isPlaceholderRestaurantImage = (url = "") => {
  if (!url) return true;
  const normalizedUrl = url.toLowerCase();
  return normalizedUrl.includes("picsum.photos") || normalizedUrl.includes("source.unsplash") || normalizedUrl.includes("/random");
};

const buildServiceBadges = (restaurant) => {
  const badges = [];
  const openingStatus = String(restaurant.openingStatus || "").toLowerCase();

  if (openingStatus === "open") badges.push({ label: "Đang mở", tone: "success" });
  if (restaurant.canOrder) badges.push({ label: "Đặt món", tone: "primary" });
  if (restaurant.canReserve) badges.push({ label: "Đặt bàn", tone: "neutral" });
  if (restaurant.canDelivery) badges.push({ label: "Giao hàng", tone: "neutral" });
  if (!restaurant.canDelivery && restaurant.canPickup) badges.push({ label: "Tự đến lấy", tone: "neutral" });
  if (restaurant.orderCount > 0) badges.push({ label: "Được đặt nhiều", tone: "warm" });

  return badges.slice(0, 4);
};

const normalizeRestaurant = (node, index) => {
  const candidateImage = node.coverImage || node.avatar || "";
  const fallbackImage = RESTAURANT_FALLBACK_IMAGES[index % RESTAURANT_FALLBACK_IMAGES.length];
  const lat = nullableNumber(node?.address?.lat);
  const lng = nullableNumber(node?.address?.lng);
  const distanceKm = nullableNumber(node?.distanceKm);
  const roadDistanceKm = nullableNumber(node?.roadDistanceKm);
  const straightLineDistanceKm = nullableNumber(node?.straightLineDistanceKm);
  const estimatedTravelMinutes = nullableNumber(node?.estimatedTravelMinutes);

  const normalized = {
    id: node.id,
    name: toCustomerText(node.name, "Nhà hàng đang cập nhật"),
    description: toCustomerText(node.description, "Mô tả đang được cập nhật."),
    image: isPlaceholderRestaurantImage(candidateImage) ? fallbackImage : candidateImage,
    priceRange: node.priceRange ?? "",
    hours: formatHours(node.openingHours, node.closingHours),
    addressText: toCustomerText(formatAddress(node.address), "", { allowEmpty: true }),
    avgRating: nullableNumber(node.avgRating),
    orderCount: nullableNumber(node.orderCount) || 0,
    reservationCount: nullableNumber(node.reservationCount) || 0,
    openingStatus: node.openingStatus,
    canReserve: node.canReserve === true,
    canOrder: node.canOrder === true,
    canDelivery: node.canDelivery === true,
    canPickup: node.canPickup === true,
    lat,
    lng,
    distanceKm,
    roadDistanceKm,
    straightLineDistanceKm,
    estimatedTravelMinutes,
    distanceSource: typeof node?.distanceSource === "string" ? node.distanceSource : null,
  };

  return {
    ...normalized,
    serviceBadges: buildServiceBadges(normalized),
  };
};

const RestaurantGrid = ({ addressFilter = undefined, restaurantFilter = undefined, title = "Nhà hàng nổi bật", showViewAll = true }) => {
  const navigate = useNavigate();

  const effectiveFilter = restaurantFilter || addressFilter || {};
  const nearbyCenter = effectiveFilter?.nearbyCenter;
  const nearbyLat = Number(nearbyCenter?.lat);
  const nearbyLng = Number(nearbyCenter?.lng);
  const nearbyMode = Number.isFinite(nearbyLat) && Number.isFinite(nearbyLng);

  const gqlFilter = { ...effectiveFilter };
  delete gqlFilter.nearbyCenter;
  delete gqlFilter.categoryId;
  delete gqlFilter.categoryName;
  delete gqlFilter.timeSlot;

  const nearbyGqlFilter = { ...gqlFilter };
  // In nearby mode, `search` is the delivery address/current-location label, not a restaurant keyword.
  delete nearbyGqlFilter.search;

  const selectedCategoryName = typeof effectiveFilter?.categoryName === "string" ? effectiveFilter.categoryName.trim() : "";
  const hasCategoryFilter = selectedCategoryName.length > 0;
  const displayCategoryName = hasCategoryFilter
    ? hasIconInCategoryName(selectedCategoryName)
      ? selectedCategoryName
      : `${resolveCategoryIcon(selectedCategoryName)} ${selectedCategoryName}`
    : "";

  const selectedCategoryId = typeof effectiveFilter?.categoryId === "string" ? effectiveFilter.categoryId.trim() : "";

  const { data: restaurantsByCategoryData } = useQuery(GET_RESTAURANTS_BY_CATEGORY_TIME_SLOT, {
    skip: nearbyMode || !hasCategoryFilter || !selectedCategoryId || !effectiveFilter?.timeSlot,
    variables: { categoryId: selectedCategoryId, timeSlot: effectiveFilter?.timeSlot, limit: 100 },
    fetchPolicy: "network-only",
  });

  const { data: topData, loading: loadingTop, error: errorTop } = useQuery(GET_TOP_RESTAURANTS, {
    skip: nearbyMode,
    variables: { limit: DEFAULT_RESTAURANT_LIMIT, restaurantFilter: { ...gqlFilter } },
    fetchPolicy: "cache-and-network",
  });

  const { data: nearbyData, loading: loadingNearby, error: errorNearby } = useQuery(GET_RESTAURANTS_NEARBY, {
    skip: !nearbyMode,
    variables: {
      lat: nearbyLat,
      lng: nearbyLng,
      radiusKm: DEFAULT_NEARBY_RADIUS_KM,
      limit: DEFAULT_RESTAURANT_LIMIT,
      restaurantFilter: { ...nearbyGqlFilter },
    },
    fetchPolicy: "cache-and-network",
  });

  const loading = nearbyMode ? loadingNearby : loadingTop;
  const error = nearbyMode ? errorNearby : errorTop;

  const restaurants = useMemo(() => {
    const list = nearbyMode ? nearbyData?.restaurantsNearby ?? [] : topData?.restaurantsTop ?? [];
    return list.map((node, index) => normalizeRestaurant(node, index));
  }, [nearbyMode, nearbyData, topData]);

  const restaurantsBySelectedCategory = useMemo(() => {
    if (!hasCategoryFilter) return restaurants;
    const direct = restaurantsByCategoryData?.restaurantsByCategoryTimeSlot || [];
    return direct.map((node, index) => normalizeRestaurant(node, index));
  }, [hasCategoryFilter, restaurantsByCategoryData, restaurants]);

  const displayRestaurants = nearbyMode ? restaurants : restaurantsBySelectedCategory;
  const goDetail = (id) => navigate(`/restaurant/${id}`);
  const goLayout = (e, id) => { e.stopPropagation(); navigate(`/restaurant/${id}/layout`); };
  const goOrder = (e, id) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    params.set("restaurantId", String(id));

    const timeSlot =
      typeof effectiveFilter?.timeSlot === "string"
        ? effectiveFilter.timeSlot.trim()
        : "";
    if (timeSlot) params.set("timeSlot", timeSlot);

    navigate(`/cus-menu?${params.toString()}`);
  };
  const viewAll = () => navigate("/restaurants");
  const handleCardKeyDown = (event, id) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goDetail(id);
    }
  };

  const headerBadge = nearbyMode ? "Gần bạn" : hasCategoryFilter ? "Đúng nhu cầu" : "Nổi bật";
  const subtitle = nearbyMode
    ? "Ưu tiên các nhà hàng có khoảng cách rõ ràng để bạn ra quyết định nhanh hơn."
    : hasCategoryFilter
      ? `Những lựa chọn phù hợp với ${displayCategoryName} trong khung giờ hiện tại.`
      : "Các địa điểm ăn uống nổi bật, được sắp xếp để bạn chọn nhanh hơn.";

  return (
    <section id="restaurants" className="restaurant-grid" aria-labelledby="restaurant-grid-title">
      <div className="restaurant-grid__container">
        <div className="restaurant-grid__header">
          <div className="restaurant-grid__heading-copy">
            <span className="restaurant-grid__badge">{headerBadge}</span>
            <h3 id="restaurant-grid-title" className="restaurant-grid__title">{title}</h3>
            <p className="restaurant-grid__subtitle">{subtitle}</p>
          </div>
          {showViewAll && <button type="button" className="restaurant-grid__view-all" onClick={viewAll}>Xem tất cả <span className="arrow">→</span></button>}
        </div>

        {nearbyMode && !loading && (
          <div className="restaurant-grid__nearby-note">
            <span className="restaurant-grid__nearby-icon" aria-hidden="true"><LocateFixed /></span>
            <span>Đang hiển thị nhà hàng gần vị trí hiện tại trong bán kính {DEFAULT_NEARBY_RADIUS_KM} km.</span>
          </div>
        )}

        {!nearbyMode && hasCategoryFilter && !loading && (
          <div className="restaurant-grid__nearby-note restaurant-grid__nearby-note--success">
            <span className="restaurant-grid__nearby-icon" aria-hidden="true"><CheckCircle2 /></span>
            <span>Đây là những nhà hàng có danh mục {displayCategoryName} trong khung giờ hiện tại.</span>
          </div>
        )}

        {error && <div className="restaurant-grid__error" role="alert">Không tải được danh sách nhà hàng. Vui lòng thử lại sau.</div>}

        <div className="restaurant-grid__list" aria-busy={loading ? "true" : "false"}>
          {loading
            ? Array.from({ length: DEFAULT_RESTAURANT_LIMIT }).map((_, idx) => <SkeletonCard key={idx} />)
            : displayRestaurants.map((r) => {
                const distanceMetaText = formatDistanceMeta({ distanceSource: r.distanceSource, distanceKm: r.distanceKm, estimatedTravelMinutes: r.estimatedTravelMinutes });
                const rating = formatRating(r.avgRating);
                return (
                  <article
                    key={r.id}
                    className="res-card"
                    onClick={() => goDetail(r.id)}
                    onKeyDown={(event) => handleCardKeyDown(event, r.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết ${r.name}`}
                  >
                    <div className="res-card__image-wrapper">
                      <img src={r.image} alt={`Không gian của ${r.name}`} className="res-card__img" loading="lazy" />
                      <div className="res-card__scrim" aria-hidden="true" />
                      <div className="res-card__overlay">
                        <div className="res-card__rating" aria-label={rating.ariaLabel}><Star aria-hidden="true" /> {rating.value || "Chưa có đánh giá"}</div>
                        {r.hours && <div className="res-card__status">{r.hours}</div>}
                      </div>
                    </div>

                    <div className="res-card__body">
                      <div className="res-card__main-info">
                        <div className="res-card__name-row">
                          <h4 className="res-card__name" title={r.name}>{r.name}</h4>
                          {r.priceRange && <span className="res-card__price">{r.priceRange}</span>}
                        </div>
                        {r.serviceBadges.length > 0 && (
                          <div className="res-card__badges" aria-label="Dịch vụ nhà hàng">
                            {r.serviceBadges.map((badge) => (
                              <span key={badge.label} className={`res-card__badge res-card__badge--${badge.tone}`}>{badge.label}</span>
                            ))}
                          </div>
                        )}
                        <p className="res-card__address" title={r.addressText}><MapPin aria-hidden="true" /> {r.addressText || "Chưa cập nhật địa chỉ"}</p>
                        {distanceMetaText && <p className="res-card__distance">{r.distanceSource === "road" ? <Navigation aria-hidden="true" /> : <LocateFixed aria-hidden="true" />} {distanceMetaText}</p>}
                      </div>

                      <p className="res-card__desc">{r.description}</p>
                      <div className="res-card__divider" />

                      <div className="res-card__actions">
                        <button type="button" className="res-card__btn res-card__btn--outline" onClick={(e) => goLayout(e, r.id)}>Đặt bàn</button>
                        <button type="button" className="res-card__btn res-card__btn--primary" onClick={(e) => goOrder(e, r.id)}>Đặt món</button>
                      </div>
                    </div>
                  </article>
                );
              })}

          {!loading && displayRestaurants.length === 0 && (
            <div className="restaurant-grid__empty">
              <span className="restaurant-grid__empty-kicker">Chưa có kết quả phù hợp</span>
              <strong>
                {nearbyMode
                  ? "Không tìm thấy nhà hàng gần vị trí của bạn."
                  : hasCategoryFilter
                    ? "Không tìm thấy nhà hàng có danh mục bạn đã chọn trong khung giờ này."
                    : "Chưa có nhà hàng nổi bật."}
              </strong>
              <p>Hãy thử đổi khu vực, danh mục hoặc xem toàn bộ danh sách nhà hàng.</p>
              {showViewAll && <button type="button" className="restaurant-grid__empty-action" onClick={viewAll}>Xem tất cả nhà hàng</button>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const SkeletonCard = () => (
  <div className="res-card res-card--skeleton" aria-hidden="true">
    <div className="skeleton-img" />
    <div className="res-card__body">
      <div className="skeleton-text w-3-4" />
      <div className="skeleton-text w-1-2" />
      <div className="skeleton-text w-full mt-2" />
      <div className="res-card__divider mt-3" />
      <div className="res-card__actions">
        <div className="skeleton-btn" />
        <div className="skeleton-btn" />
      </div>
    </div>
  </div>
);

export default RestaurantGrid;
