// src/components/Customer/Homepage_Client/Sections/RestaurantGrid.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "../../../../styles/Homepage/RestaurantGrid.scss";

/* =========================
   GraphQL: Top Restaurants (no pagination)
   - Lấy đúng 6 nhà hàng có avgRating cao nhất
   ========================= */
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
  if (opening && closing) return `${opening}–${closing}`;
  if (opening) return `${opening}`;
  return `${closing}`;
};

const RestaurantGrid = ({
  onRestaurantOrderClick, // optional: nếu truyền vào thì dùng để mở chi tiết
  addressFilter = undefined, // optional: { city, district }
  title = "Nhà hàng nổi bật", // tuỳ biến tiêu đề
  showViewAll = true, // có hiển thị nút "Xem tất cả" không
}) => {
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_TOP_RESTAURANTS, {
    variables: { limit: 6, addressFilter },
    fetchPolicy: "cache-and-network",
  });

  // Chuẩn hoá dữ liệu để đổ vào card
  const restaurants = useMemo(() => {
    const list = data?.restaurantsTop ?? [];
    return list.map((node) => ({
      id: node.id,
      name: node.name ?? "Nhà hàng",
      description: node.description ?? "Mô tả đang cập nhật...",
      image: node.coverImage || node.avatar || "",
      priceRange: node.priceRange ?? "",
      hours: formatHours(node.openingHours, node.closingHours),
      addressText: formatAddress(node.address),
      avgRating:
        typeof node.avgRating === "number" ? Number(node.avgRating) : undefined,
    }));
  }, [data]);

  const goDetail = (id) => {
    navigate(`/restaurant/${id}`);
  };

  const goLayout = (e, id) => {
    e.stopPropagation();
    navigate(`/restaurant/${id}/layout`);
  };

  const goOrder = (e, id) => {
    e.stopPropagation();
    // Nếu có route đặt món riêng, thay bằng `/restaurants/${id}/order`
    navigate(`/restaurant/${id}`);
  };

  const viewAll = () => navigate("/restaurants");

  return (
    <section id="restaurants" className="restaurants">
      <div className="restaurants__container">
        <div className="restaurants__header">
          <h3 className="restaurants__title">{title}</h3>
          {showViewAll && (
            <button
              className="restaurants__view-all"
              onClick={viewAll}
              aria-label="Xem tất cả nhà hàng"
            >
              Xem tất cả →
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="restaurants__grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="restaurant-card skeleton" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <p className="restaurants__error">
            Không tải được danh sách nhà hàng. Vui lòng thử lại.
          </p>
        )}

        {/* Data */}
        {!loading && !error && (
          <div className="restaurants__grid">
            {restaurants.map((r) => (
              <div
                key={r.id}
                className="restaurant-card"
                onClick={() => goDetail(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goDetail(r.id);
                  }
                }}
                aria-label={`Mở chi tiết ${r.name}`}
              >
                <div className="restaurant-card__image">
                  {r.image ? (
                    <img src={r.image} alt={r.name} loading="lazy" />
                  ) : (
                    <span className="restaurant-card__image-fallback">
                      {r.name?.charAt(0) ?? "🍽️"}
                    </span>
                  )}
                </div>

                <div className="restaurant-card__content">
                  <h4 className="restaurant-card__name">{r.name}</h4>
                  <p className="restaurant-card__description">
                    {r.description}
                  </p>

                  <div className="restaurant-card__info">
                    {typeof r.avgRating === "number" && (
                      <span
                        className="restaurant-card__rating"
                        title="Đánh giá trung bình"
                      >
                        ⭐ {r.avgRating.toFixed(1)}
                      </span>
                    )}
                    {r.priceRange && (
                      <span className="restaurant-card__price">
                        {r.priceRange}
                      </span>
                    )}
                    {r.hours && (
                      <span className="restaurant-card__hours">
                        🕒 {r.hours}
                      </span>
                    )}
                    {r.addressText && (
                      <span className="restaurant-card__address">
                        📍 {r.addressText}
                      </span>
                    )}
                  </div>

                  <div className="restaurant-card__actions">
                    <button
                      type="button"
                      className="restaurant-card__btn restaurant-card__btn--primary"
                      onClick={(e) => {
                        e.stopPropagation(); // ⬅️ Không kích hoạt onClick của thẻ
                        goLayout(e, r.id); // /restaurants/:id/layout
                      }}
                    >
                      Đặt bàn
                    </button>
                    <button
                      type="button"
                      className="restaurant-card__btn restaurant-card__btn--ghost"
                      onClick={(e) => {
                        e.stopPropagation(); // ⬅️ Không kích hoạt onClick của thẻ
                        goOrder(e, r.id); // /restaurants/:id (hoặc /order)
                      }}
                    >
                      Đặt món
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Nếu server trả ít hơn 6, vẫn render đúng số có sẵn */}
            {restaurants.length === 0 && (
              <div className="restaurants__empty">
                Chưa có nhà hàng nổi bật.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default RestaurantGrid;
