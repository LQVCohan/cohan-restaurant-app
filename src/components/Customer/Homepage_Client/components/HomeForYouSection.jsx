import React, { useContext, useEffect, useMemo } from "react";
import { AlertCircle, ArrowRight, MapPin, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import useForYouRecommendations from "@/hooks/useForYouRecommendations";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import { getFoodPreferenceCompletion } from "@/utils/foodPreferenceCompletion";
import { recordForYouItemInteraction } from "@/utils/forYouBehaviorSignals";
import { FOR_YOU_ANALYTICS_EVENTS, recordForYouAnalyticsEvent } from "@/utils/forYouAnalytics";
import { getForYouReasonType } from "@/utils/forYouRanking";
import "@/styles/Homepage/HomeForYouSection.scss";

const priceFormatter = new Intl.NumberFormat("vi-VN");
const fallbackImage = "https://placehold.co/640x420/fff1e6/c94f02?text=Mon+an";
const skeletonItems = [0, 1, 2];

const formatPrice = (price) => priceFormatter.format(Number(price || 0));

function HomeForYouSkeleton() {
  return (
    <section className="home-for-you" aria-label="Món phù hợp với bạn">
      <div className="home-for-you__container">
        <div className="home-for-you__surface home-for-you__surface--loading" aria-busy="true">
          <p className="home-for-you__loading-copy">Đang tìm món hợp khẩu vị của bạn…</p>
          <div className="home-for-you__skeleton-grid" aria-hidden="true">
            {skeletonItems.map((item) => (
              <div className="home-for-you__skeleton-card" key={item}>
                <span className="home-for-you__skeleton-image" />
                <span className="home-for-you__skeleton-line home-for-you__skeleton-line--short" />
                <span className="home-for-you__skeleton-line" />
                <span className="home-for-you__skeleton-line home-for-you__skeleton-line--price" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeForYouSection({ timeSlot = null }) {
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
  if (loading) return <HomeForYouSkeleton />;
  if (error || displayItems.length === 0) return null;

  const usingFallback = recommendedItems.length === 0;
  const subtitle = usingFallback
    ? "Khám phá những món đang được nhiều thực khách quan tâm."
    : hasBehaviorSignals
      ? "Chọn từ khẩu vị và những món bạn vừa quan tâm gần đây."
      : "Gợi ý được chọn theo hồ sơ khẩu vị của bạn.";

  const handleItemClick = (item) => {
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
  };

  return (
    <section className="home-for-you" aria-labelledby="home-for-you-title">
      <div className="home-for-you__container">
        <div className="home-for-you__surface">
          <header className="home-for-you__header">
            <div className="home-for-you__copy">
              <span className="home-for-you__eyebrow">
                <Sparkles aria-hidden="true" />
                {usingFallback ? "Đang được yêu thích" : "Dành riêng cho bạn"}
              </span>
              <h3 className="home-for-you__title" id="home-for-you-title">Món phù hợp với bạn</h3>
              <p className="home-for-you__subtitle">{subtitle}</p>
            </div>

            <div className="home-for-you__actions">
              <Link className="home-for-you__cta" to="/for-you">
                Xem tất cả gợi ý
                <ArrowRight aria-hidden="true" />
              </Link>
              {usingFallback && completion.shouldNudge && (
                <Link className="home-for-you__profile-cta" to="/for-you">
                  Cập nhật khẩu vị
                </Link>
              )}
            </div>
          </header>

          <div className="home-for-you__grid">
            {displayItems.map((item) => {
              const navigationContext = {
                restaurantId: item.restaurantId,
                categoryId: item.categoryId,
                timeSlot,
              };
              const rate = Number(item.rate);
              const hasRate = Number.isFinite(rate) && rate > 0;
              const restaurantName = item.restaurantName || "Nhà hàng";

              return (
                <article className="home-for-you-card" key={item.id}>
                  <Link
                    className="home-for-you-card__link"
                    to={buildFoodDetailPath(item.id, navigationContext)}
                    state={buildFoodDetailState(item, navigationContext)}
                    onClick={() => handleItemClick(item)}
                    aria-label={`Xem món ${item.name} tại ${restaurantName}`}
                  >
                    <span className="home-for-you-card__media">
                      <img
                        className="home-for-you-card__image"
                        src={item.thumbImage || fallbackImage}
                        alt={item.name}
                        width="640"
                        height="420"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="home-for-you-card__badges">
                        {item.foodPreferenceMeta?.isRecommended ? (
                          <span className="home-for-you-badge home-for-you-badge--match">
                            <Sparkles aria-hidden="true" />
                            Hợp khẩu vị
                          </span>
                        ) : usingFallback ? (
                          <span className="home-for-you-badge home-for-you-badge--popular">
                            <Star aria-hidden="true" />
                            Gợi ý phổ biến
                          </span>
                        ) : null}
                        {item.foodPreferenceMeta?.hasAllergyWarning && (
                          <span className="home-for-you-badge home-for-you-badge--warning">
                            <AlertCircle aria-hidden="true" />
                            Kiểm tra dị ứng
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="home-for-you-card__body">
                      <span className="home-for-you-card__meta">
                        <span className="home-for-you-card__restaurant">
                          <MapPin aria-hidden="true" />
                          <span>{restaurantName}</span>
                        </span>
                        {hasRate && (
                          <span className="home-for-you-card__rating">
                            <Star aria-hidden="true" />
                            {rate.toFixed(1)}
                          </span>
                        )}
                      </span>

                      <h4 className="home-for-you-card__name">{item.name}</h4>

                      <span className="home-for-you-card__footer">
                        <span className="home-for-you-card__price">
                          {formatPrice(item.basePrice)} <small>đ</small>
                        </span>
                        <span className="home-for-you-card__view">
                          Xem món
                          <ArrowRight aria-hidden="true" />
                        </span>
                      </span>
                    </span>
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
