import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "../../../../styles/Homepage/RestaurantGrid.scss";

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

const GET_MENU_ITEMS_BY_CATEGORY = gql`
  query GetMenuItemsByCategory(
    $limit: Int = 300
    $categoryName: String
    $timeSlot: TimeSlot
  ) {
    topMenuItems(
      limit: $limit
      categoryName: $categoryName
      timeSlot: $timeSlot
    ) {
      id
      restaurantId
    }
  }
`;

const formatAddress = (addr) => {
  if (!addr) return "";
  const parts = [
    addr.line1,
    addr.line2,
    addr.ward,
    addr.district,
    addr.city,
    addr.country,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};

const formatHours = (opening, closing) => {
  if (!opening && !closing) return "";
  if (opening && closing) return `${opening} - ${closing}`;
  return opening || closing;
};

const toRad = (deg) => (deg * Math.PI) / 180;

const distanceInKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const RESTAURANT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
];

const isPlaceholderRestaurantImage = (url = "") => {
  if (!url) return true;

  const normalizedUrl = url.toLowerCase();
  return (
    normalizedUrl.includes("picsum.photos") ||
    normalizedUrl.includes("source.unsplash") ||
    normalizedUrl.includes("/random")
  );
};

const RestaurantGrid = ({
  addressFilter = undefined,
  restaurantFilter = undefined,
  title = "Nhà Hàng Nổi Bật",
  showViewAll = true,
}) => {
  const navigate = useNavigate();

  const effectiveFilter = restaurantFilter || addressFilter || {};
  const nearbyCenter = effectiveFilter?.nearbyCenter;
  const gqlFilter = { ...effectiveFilter };
  delete gqlFilter.nearbyCenter;
  delete gqlFilter.categoryId;
  delete gqlFilter.categoryName;
  delete gqlFilter.timeSlot;

  const nearbyMode =
    typeof nearbyCenter?.lat === "number" && typeof nearbyCenter?.lng === "number";
  const selectedCategoryName =
    typeof effectiveFilter?.categoryName === "string"
      ? effectiveFilter.categoryName.trim()
      : "";
  const hasCategoryFilter = selectedCategoryName.length > 0;

  const { data: categoryMenuData } = useQuery(GET_MENU_ITEMS_BY_CATEGORY, {
    skip: !hasCategoryFilter,
    variables: {
      limit: 500,
      categoryName: selectedCategoryName,
      timeSlot: effectiveFilter?.timeSlot || undefined,
    },
    fetchPolicy: "network-only",
  });

  const categoryRestaurantIds = useMemo(() => {
    if (!hasCategoryFilter) return [];

    const ids = (categoryMenuData?.topMenuItems || [])
      .map((item) => item?.restaurantId)
      .filter(Boolean);

    return [...new Set(ids)];
  }, [hasCategoryFilter, categoryMenuData]);

  const { data, loading, error } = useQuery(GET_TOP_RESTAURANTS, {
    variables: {
      limit: nearbyMode ? 50 : 6,
      restaurantFilter:
        nearbyMode
          ? undefined
          : {
              ...gqlFilter,
              ...(hasCategoryFilter ? { restaurantIds: categoryRestaurantIds } : {}),
            },
    },
    fetchPolicy: "cache-and-network",
  });

  const restaurants = useMemo(() => {
    const list = data?.restaurantsTop ?? [];
    return list.map((node, index) => {
      const candidateImage = node.coverImage || node.avatar || "";
      const fallbackImage =
        RESTAURANT_FALLBACK_IMAGES[
          index % RESTAURANT_FALLBACK_IMAGES.length
        ];

      const lat = Number(node?.address?.lat);
      const lng = Number(node?.address?.lng);

      return {
        id: node.id,
        name: node.name ?? "Nhà hàng",
        description: node.description ?? "Mô tả đang cập nhật...",
        image: isPlaceholderRestaurantImage(candidateImage)
          ? fallbackImage
          : candidateImage,
        priceRange: node.priceRange ?? "",
        hours: formatHours(node.openingHours, node.closingHours),
        addressText: formatAddress(node.address),
        avgRating:
          typeof node.avgRating === "number" ? Number(node.avgRating) : 5.0,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      };
    });
  }, [data]);

  const restaurantsWithDistance = useMemo(() => {
    if (!nearbyMode) return restaurants;

    return restaurants
      .map((restaurant) => {
        if (
          typeof restaurant.lat !== "number" ||
          typeof restaurant.lng !== "number"
        ) {
          return { ...restaurant, distanceKm: null };
        }

        const distanceKm = distanceInKm(
          nearbyCenter.lat,
          nearbyCenter.lng,
          restaurant.lat,
          restaurant.lng
        );

        return { ...restaurant, distanceKm };
      })
      .sort((a, b) => {
        if (typeof a.distanceKm !== "number") return 1;
        if (typeof b.distanceKm !== "number") return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [nearbyMode, nearbyCenter, restaurants]);

  const nearestTopRestaurants = useMemo(() => {
    if (!nearbyMode) return restaurantsWithDistance;

    const nearestWithDistance = restaurantsWithDistance
      .filter((restaurant) => typeof restaurant.distanceKm === "number")
      .slice(0, 6);

    if (nearestWithDistance.length > 0) {
      return nearestWithDistance;
    }

    return restaurantsWithDistance.slice(0, 6);
  }, [nearbyMode, restaurantsWithDistance]);


  const restaurantsBySelectedCategory = useMemo(() => {
    if (!hasCategoryFilter) return restaurants;

    const restaurantIdSet = new Set(categoryRestaurantIds.map(String));
    return restaurants.filter((restaurant) =>
      restaurantIdSet.has(String(restaurant.id))
    );
  }, [hasCategoryFilter, categoryRestaurantIds, restaurants]);

  const displayRestaurants = nearbyMode
    ? nearestTopRestaurants
    : restaurantsBySelectedCategory;

  const goDetail = (id) => navigate(`/restaurant/${id}`);

  const goLayout = (e, id) => {
    e.stopPropagation();
    navigate(`/restaurant/${id}/layout`);
  };

  const goOrder = (e, id) => {
    e.stopPropagation();
    navigate(`/restaurant/${id}`);
  };

  const viewAll = () => navigate("/restaurants");

  return (
    <section id="restaurants" className="restaurant-grid">
      <div className="restaurant-grid__container">
        {/* Header Section */}
        <div className="restaurant-grid__header">
          <div>
            <span className="restaurant-grid__badge">Top Rated</span>
            <h3 className="restaurant-grid__title">{title}</h3>
            <p className="restaurant-grid__subtitle">
              Khám phá các địa điểm ăn uống được đánh giá cao nhất.
            </p>
          </div>
          {showViewAll && (
            <button className="restaurant-grid__view-all" onClick={viewAll}>
              Xem tất cả <span className="arrow">→</span>
            </button>
          )}
        </div>

        {nearbyMode && !loading && (
          <div className="restaurant-grid__nearby-note">
            📍 Đang hiển thị 6 nhà hàng gần nhất từ kết quả Top Restaurants và khoảng cách tới vị trí hiện tại của bạn.
          </div>
        )}

        {hasCategoryFilter && !loading && (
          <div className="restaurant-grid__nearby-note">
            ✅ Đây là những nhà hàng có danh mục bạn đã chọn ({selectedCategoryName}) trong khung giờ hiện tại.
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="restaurant-grid__error">
            ⚠️ Không tải được danh sách nhà hàng.
          </div>
        )}

        {/* Content Grid */}
        <div className="restaurant-grid__list">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonCard key={idx} />
              ))
            : displayRestaurants.map((r) => (
                <div
                  key={r.id}
                  className="res-card"
                  onClick={() => goDetail(r.id)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Image & Overlay Info */}
                  <div className="res-card__image-wrapper">
                    <img
                      src={r.image}
                      alt={r.name}
                      className="res-card__img"
                      loading="lazy"
                    />
                    <div className="res-card__overlay">
                      <div className="res-card__rating">
                        ⭐ {r.avgRating.toFixed(1)}
                      </div>
                      {r.hours && (
                        <div className="res-card__status">🕒 {r.hours}</div>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="res-card__body">
                    <div className="res-card__main-info">
                      <h4 className="res-card__name" title={r.name}>
                        {r.name}
                      </h4>
                      <p className="res-card__address" title={r.addressText}>
                        📍 {r.addressText || "Chưa cập nhật địa chỉ"}
                      </p>
                      {typeof r.distanceKm === "number" && (
                        <p className="res-card__address">🧭 Cách bạn {r.distanceKm.toFixed(1)} km</p>
                      )}
                    </div>

                    <p className="res-card__desc">{r.description}</p>

                    <div className="res-card__divider"></div>

                    {/* Actions */}
                    <div className="res-card__actions">
                      <button
                        className="res-card__btn res-card__btn--outline"
                        onClick={(e) => goLayout(e, r.id)}
                      >
                        Đặt bàn
                      </button>
                      <button
                        className="res-card__btn res-card__btn--primary"
                        onClick={(e) => goOrder(e, r.id)}
                      >
                        Đặt món
                      </button>
                    </div>
                  </div>
                </div>
              ))}

          {!loading && displayRestaurants.length === 0 && (
            <div className="restaurant-grid__empty">
              {hasCategoryFilter
                ? "Không tìm thấy nhà hàng nào có danh mục bạn đã chọn trong khung giờ này."
                : "Chưa có nhà hàng nào nổi bật."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// Skeleton Loader Component
const SkeletonCard = () => (
  <div className="res-card res-card--skeleton">
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
