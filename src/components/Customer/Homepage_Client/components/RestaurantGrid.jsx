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
        ward
        district
        city
        country
      }
    }
  }
`;

const formatAddress = (addr) => {
  if (!addr) return "";
  const parts = [addr.ward, addr.district, addr.city].filter(Boolean);
  return parts.join(", ");
};

const formatHours = (opening, closing) => {
  if (!opening && !closing) return "";
  if (opening && closing) return `${opening} - ${closing}`;
  return opening || closing;
};

const RestaurantGrid = ({
  addressFilter = undefined,
  title = "Nhà Hàng Nổi Bật",
  showViewAll = true,
}) => {
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_TOP_RESTAURANTS, {
    variables: { limit: 6, addressFilter },
    fetchPolicy: "cache-and-network",
  });

  const restaurants = useMemo(() => {
    const list = data?.restaurantsTop ?? [];
    return list.map((node) => ({
      id: node.id,
      name: node.name ?? "Nhà hàng",
      description: node.description ?? "Mô tả đang cập nhật...",
      image:
        node.coverImage ||
        node.avatar ||
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      priceRange: node.priceRange ?? "",
      hours: formatHours(node.openingHours, node.closingHours),
      addressText: formatAddress(node.address),
      avgRating:
        typeof node.avgRating === "number" ? Number(node.avgRating) : 5.0,
    }));
  }, [data]);

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
            : restaurants.map((r) => (
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

          {!loading && restaurants.length === 0 && (
            <div className="restaurant-grid__empty">
              Chưa có nhà hàng nào nổi bật.
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
