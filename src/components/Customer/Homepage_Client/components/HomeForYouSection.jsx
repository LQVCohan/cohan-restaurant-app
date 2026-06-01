import React, { useContext, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import useForYouRecommendations from "@/hooks/useForYouRecommendations";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import { getFoodPreferenceCompletion } from "@/utils/foodPreferenceCompletion";
import { recordForYouItemInteraction } from "@/utils/forYouBehaviorSignals";
import { FOR_YOU_ANALYTICS_EVENTS, recordForYouAnalyticsEvent } from "@/utils/forYouAnalytics";
import { getForYouReasonType } from "@/utils/forYouRanking";
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
    preferences,
    hasBehaviorSignals,
  } = useForYouRecommendations({ limitPerRestaurant: 8, maxRestaurants: 5, enabled, timeSlot });

  const completion = useMemo(
    () => getFoodPreferenceCompletion(preferences),
    [preferences],
  );

  const displayItems = useMemo(() => {
    const source = recommendedItems.length > 0 ? recommendedItems : fallbackItems;
    return source.slice(0, 6);
  }, [fallbackItems, recommendedItems]);

  useEffect(() => {
    if (!enabled || displayItems.length === 0) return;
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.VIEW, {
      userId: user?.id,
      source: "home_for_you",
    });
  }, [displayItems.length, enabled, user?.id]);

  if (!enabled || accessibleRestaurants.length === 0) return null;
  if (loading) return <section className="home-for-you"><div className="home-for-you__container"><div className="home-for-you__skeleton">Đang tìm món hợp khẩu vị của bạn...</div></div></section>;
  if (error || displayItems.length === 0) return null;

  const usingFallback = recommendedItems.length === 0;
  const subtitle = usingFallback
    ? "Món phổ biến để tham khảo."
    : hasBehaviorSignals
      ? "Dựa trên khẩu vị và món bạn quan tâm gần đây."
      : "Gợi ý dựa trên khẩu vị của bạn.";

  const handleViewItem = (item) => {
    if (!item?.id) return;
    recordForYouItemInteraction(user?.id, item, "click");
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.CARD_CLICK, {
      userId: user?.id,
      itemId: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      source: "home_for_you",
      reasonType: getForYouReasonType(item),
    });
    navigate(
      buildFoodDetailPath(item.id, { restaurantId: item.restaurantId, categoryId: item.categoryId, timeSlot }),
      { state: buildFoodDetailState(item, { restaurantId: item.restaurantId, categoryId: item.categoryId, timeSlot }) },
    );
  };

  return (
    <section className="home-for-you">
      <div className="home-for-you__container">
        <div className="home-for-you__header">
          <div>
            <h3 className="home-for-you__title">Món phù hợp với bạn</h3>
            <p className="home-for-you__subtitle">{subtitle}</p>
          </div>
          <div className="home-for-you__actions">
            <button type="button" className="home-for-you__cta" onClick={() => navigate("/for-you")}>Xem thêm món gợi ý</button>
            {usingFallback && completion.shouldNudge && (
              <button
                type="button"
                className="home-for-you__profile-cta"
                onClick={() => navigate("/for-you")}
              >
                Cập nhật khẩu vị để gợi ý sát hơn
              </button>
            )}
          </div>
        </div>

        <div className="home-for-you__grid">
          {displayItems.map((item) => (
            <article
              key={item.id}
              className="home-for-you-card"
              onClick={() => handleViewItem(item)}
            >
              <img className="home-for-you-card__image" src={item.thumbImage || "https://placehold.co/320x220?text=Mon+an"} alt={item.name} loading="lazy" />
              <div className="home-for-you-card__body">
                <h4>{item.name}</h4>
                <p className="home-for-you-card__restaurant">{item.restaurantName}</p>
                <p className="home-for-you-card__price">{formatPrice(item.basePrice)}đ</p>
                <div className="home-for-you-card__badges">
                  {item.foodPreferenceMeta?.isRecommended && <span className="home-for-you-badge home-for-you-badge--match">✨ Món phù hợp với bạn</span>}
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
