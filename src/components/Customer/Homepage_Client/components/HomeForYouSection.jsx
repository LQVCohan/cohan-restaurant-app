import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import useForYouRecommendations from "@/hooks/useForYouRecommendations";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import "@/styles/Homepage/HomeForYouSection.scss";

const formatPrice = (price) => Number(price || 0).toLocaleString("vi-VN");

export default function HomeForYouSection({ timeSlot = null }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useContext(AuthContext) || {};
  const isCustomer = String(user?.roleName || "").toLowerCase() === "customer";
  const enabled = Boolean(isAuthenticated && isCustomer);

  const {
    loading,
    error,
    recommendedItems,
    fallbackItems,
    accessibleRestaurants,
  } = useForYouRecommendations({ limitPerRestaurant: 8, maxRestaurants: 5, enabled, timeSlot });

  const displayItems = useMemo(() => {
    const source = recommendedItems.length > 0 ? recommendedItems : fallbackItems;
    return source.slice(0, 6);
  }, [fallbackItems, recommendedItems]);

  if (!enabled || accessibleRestaurants.length === 0) return null;
  if (loading) return <section className="home-for-you"><div className="home-for-you__container"><div className="home-for-you__skeleton">Đang tải gợi ý dành cho bạn...</div></div></section>;
  if (error || displayItems.length === 0) return null;

  const usingFallback = recommendedItems.length === 0;

  return (
    <section className="home-for-you">
      <div className="home-for-you__container">
        <div className="home-for-you__header">
          <div>
            <h3 className="home-for-you__title">Dành riêng cho bạn</h3>
            <p className="home-for-you__subtitle">{usingFallback ? "Món phổ biến có thể bạn thích" : "Gợi ý cá nhân hóa theo hồ sơ khẩu vị."}</p>
          </div>
          <button className="home-for-you__cta" onClick={() => navigate("/for-you")}>Xem thêm FOR YOU</button>
        </div>

        <div className="home-for-you__grid">
          {displayItems.map((item) => (
            <article
              key={item.id}
              className="home-for-you-card"
              onClick={() => navigate(buildFoodDetailPath(item.id, { restaurantId: item.restaurantId, categoryId: item.categoryId, timeSlot }), { state: buildFoodDetailState(item, { restaurantId: item.restaurantId, categoryId: item.categoryId, timeSlot }) })}
            >
              <img className="home-for-you-card__image" src={item.thumbImage || "https://placehold.co/320x220?text=Mon+an"} alt={item.name} loading="lazy" />
              <div className="home-for-you-card__body">
                <h4>{item.name}</h4>
                <p className="home-for-you-card__restaurant">{item.restaurantName}</p>
                <p className="home-for-you-card__price">{formatPrice(item.basePrice)}đ</p>
                <div className="home-for-you-card__badges">
                  {item.foodPreferenceMeta?.isRecommended && <span className="home-for-you-badge home-for-you-badge--match">✨ Phù hợp khẩu vị</span>}
                  {item.foodPreferenceMeta?.hasAllergyWarning && <span className="home-for-you-badge home-for-you-badge--warning">⚠ Cần kiểm tra dị ứng</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
