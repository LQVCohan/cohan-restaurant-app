import React, { useContext, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Info, Check, Leaf, AlertTriangle, Flame, Droplet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import useFoodPreferences from "@/hooks/useFoodPreferences";
import useForYouRecommendations from "@/hooks/useForYouRecommendations";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import { getFoodPreferenceCompletion } from "@/utils/foodPreferenceCompletion";
import { getFoodPreferenceDisplayReasons } from "@/utils/foodPreferenceDisplay";
import { clearForYouBehaviorSignals, recordForYouItemInteraction } from "@/utils/forYouBehaviorSignals";
import { FOR_YOU_ANALYTICS_EVENTS, recordForYouAnalyticsEvent } from "@/utils/forYouAnalytics";
import { getForYouReasonType } from "@/utils/forYouRanking";
import {
  DIETS,
  ALLERGIES,
  SUGAR_LEVELS,
  SPICE_LEVELS,
  buildFoodPreferenceNote,
} from "./foodPreferenceConfig";
import "./ForYou.scss";

const formatPrice = (price) => Number(price || 0).toLocaleString("vi-VN");

const RecommendationCard = ({ item, variant = "match", onView }) => {
  const reasons = getFoodPreferenceDisplayReasons(item?.foodPreferenceMeta).slice(0, 2);
  const itemId = item?.id ?? item?.menuItemId ?? item?.name ?? "unknown";

  return (
    <article className={`recommendation-card recommendation-card--${variant}`}>
      <div className="recommendation-card__media">
        <img
          className="recommendation-card__image"
          src={item?.thumbImage || "https://placehold.co/640x440/fff3e7/ff6b00?text=FoodHub"}
          alt={item?.name || "Món ăn"}
          loading="lazy"
        />
        {variant === "match" && <span className="recommendation-card__floating-badge">Phù hợp</span>}
        {variant === "warning" && <span className="recommendation-card__floating-badge is-warning">Kiểm tra</span>}
      </div>
      <div className="recommendation-card__content">
        <p className="recommendation-restaurant">{item?.restaurantName || "Nhà hàng đang cập nhật"}</p>
        <h3>{item?.name || "Món ăn"}</h3>
        <p className="recommendation-price">{formatPrice(item?.basePrice)}đ</p>
        {variant === "fallback" && <p className="recommendation-fallback-note">Món phổ biến để tham khảo</p>}
        {reasons.map((reason) => (
          <p className="recommendation-reason" key={`${itemId}-${reason}`}>{reason}</p>
        ))}
        {variant === "warning" && <p className="recommendation-warning-note">Hãy kiểm tra thành phần trước khi đặt.</p>}
        <button className="btn-view-dish" type="button" onClick={() => onView(item)}>Xem món</button>
      </div>
    </article>
  );
};

const ForYou = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useContext(AuthContext) || {};
  const { preferences, setPreferences, loading, error, saving, savePreferences } = useFoodPreferences();
  const [saveMessage, setSaveMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const isCustomer = String(user?.roleName || "").toLowerCase() === "customer";
  const {
    loading: recommendationLoading,
    error: recommendationError,
    recommendedItems: allRecommendedItems,
    warningItems: allWarningItems,
    fallbackItems: allFallbackItems,
    accessibleRestaurants,
    hasBehaviorSignals,
    refreshBehaviorSignals,
  } = useForYouRecommendations({
    enabled: true,
    preferencesOverride: preferences,
  });

  const recommendedItems = useMemo(() => (Array.isArray(allRecommendedItems) ? allRecommendedItems : []).slice(0, 8), [allRecommendedItems]);
  const warningItems = useMemo(() => (Array.isArray(allWarningItems) ? allWarningItems : []).slice(0, 6), [allWarningItems]);
  const fallbackItems = useMemo(() => (Array.isArray(allFallbackItems) ? allFallbackItems : []).slice(0, 8), [allFallbackItems]);
  const visibleRecommendedItems = recommendedItems;
  const visibleWarningItems = useMemo(() => {
    const recommendedIds = new Set(visibleRecommendedItems.map((item) => String(item?.id || "")));
    return warningItems.filter((item) => !recommendedIds.has(String(item?.id || "")));
  }, [visibleRecommendedItems, warningItems]);
  const visibleFallbackItems = useMemo(() => {
    const usedIds = new Set([
      ...visibleRecommendedItems.map((item) => String(item?.id || "")),
      ...visibleWarningItems.map((item) => String(item?.id || "")),
    ]);
    return fallbackItems.filter((item) => !usedIds.has(String(item?.id || "")));
  }, [visibleRecommendedItems, visibleWarningItems, fallbackItems]);
  const completion = useMemo(() => getFoodPreferenceCompletion(preferences), [preferences]);
  const selectedDiet = useMemo(() => DIETS.find((diet) => diet.id === preferences.diet) || DIETS[0], [preferences.diet]);
  const selectedAllergies = useMemo(
    () => preferences.allergies.map((id) => ALLERGIES.find((item) => item.id === id)).filter(Boolean),
    [preferences.allergies],
  );
  const completionPercent = useMemo(() => {
    const score = [completion.hasDietPreference, completion.hasAllergyInfo, completion.hasTasteInfo].filter(Boolean).length;
    return Math.max(18, Math.round((score / 3) * 100));
  }, [completion.hasAllergyInfo, completion.hasDietPreference, completion.hasTasteInfo]);
  const totalSuggestionCount = visibleRecommendedItems.length + visibleWarningItems.length + visibleFallbackItems.length;
  const shouldShowPreferenceNudge = Boolean(isAuthenticated && isCustomer && !loading && completion.shouldNudge);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.VIEW, {
      userId: user?.id,
      source: "for_you",
    });
  }, [isAuthenticated, isCustomer, user?.id]);

  const handleAllergyToggle = (id) => {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(id)
        ? prev.allergies.filter((item) => item !== id)
        : [...prev.allergies, id],
    }));
  };

  const handleHabitChange = (field, value) => {
    setPreferences((prev) => ({ ...prev, habits: { ...prev.habits, [field]: value } }));
  };

  const personalizationSubtitle = hasBehaviorSignals
    ? "Kết hợp khẩu vị của bạn và món bạn quan tâm gần đây."
    : "Gợi ý dựa trên khẩu vị của bạn.";
  const recentSuggestionDescription = hasBehaviorSignals
    ? "Chúng tôi dùng các món bạn đã xem hoặc quan tâm gần đây trên thiết bị này để sắp xếp gợi ý phù hợp hơn. Dữ liệu cũ sẽ tự hết hiệu lực sau 30 ngày."
    : "Chưa có dữ liệu gợi ý gần đây trên thiết bị này. Khi bạn xem hoặc quan tâm món nào đó, chúng tôi sẽ dùng tín hiệu này để sắp xếp gợi ý phù hợp hơn trong 30 ngày.";

  const handleViewDish = (item) => {
    if (!item?.id) return;
    if (isCustomer) {
      recordForYouItemInteraction(user?.id, item, "click");
      recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.CARD_CLICK, {
        userId: user?.id,
        itemId: item.id,
        restaurantId: item.restaurantId,
        categoryId: item.categoryId,
        source: "for_you",
        reasonType: getForYouReasonType(item),
      });
    }
    navigate(
      buildFoodDetailPath(item.id, {
        restaurantId: item.restaurantId,
        categoryId: item.categoryId,
      }),
      {
        state: buildFoodDetailState(item, {
          restaurantId: item.restaurantId,
          categoryId: item.categoryId,
        }),
      },
    );
  };

  const handleScrollToPreferenceProfile = () => {
    document.getElementById("food-preference-profile")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleSave = async () => {
    setSaveMessage("");
    try {
      await savePreferences(preferences);
      setSaveMessage("Đã lưu hồ sơ khẩu vị thành công.");
    } catch (err) {
      setSaveMessage(`Lưu thất bại: ${err.message}`);
    }
  };

  const handleClearRecentSuggestionData = () => {
    clearForYouBehaviorSignals(user?.id);
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.CLEAR_RECENT_SIGNALS, {
      userId: user?.id,
      source: "for_you",
      reasonType: "behavior",
    });
    refreshBehaviorSignals?.();
    setClearMessage("Đã xóa dữ liệu gợi ý gần đây trên thiết bị này.");
  };

  if (loading) {
    return (
      <div className="foryou-container foryou-container--loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="foryou-container">
      <header className="header">
        <button className="btn-back" type="button" onClick={() => navigate(-1)} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <div className="header-title-block">
          <span>FoodHub cá nhân hóa</span>
          <h1>Khẩu vị của bạn</h1>
        </div>
        <button
          className={`btn-info ${showGuide ? "active" : ""}`}
          type="button"
          onClick={() => setShowGuide((value) => !value)}
          aria-label="Xem hướng dẫn hồ sơ khẩu vị"
        >
          <Info size={21} />
        </button>
      </header>

      <main className="content-scroll">
        <section className="foryou-hero">
          <div className="foryou-hero__copy">
            <span className="foryou-eyebrow">Món hợp gu hơn</span>
            <h2>Chọn khẩu vị một lần, FoodHub gợi ý sát hơn cho các lần sau.</h2>
            <p>{personalizationSubtitle}</p>
            <div className="foryou-hero__actions">
              <button type="button" className="hero-primary" onClick={handleScrollToPreferenceProfile}>Cập nhật khẩu vị</button>
              <button type="button" className="hero-secondary" onClick={() => navigate("/restaurants")}>Khám phá nhà hàng</button>
            </div>
          </div>
          <aside className="taste-score-card" aria-label="Tóm tắt hồ sơ khẩu vị">
            <div className="taste-score-card__top">
              <span>Độ hoàn thiện hồ sơ</span>
              <strong>{completionPercent}%</strong>
            </div>
            <div className="taste-score-meter"><span style={{ width: `${completionPercent}%` }} /></div>
            <div className="taste-score-tags">
              <span>{selectedDiet.icon} {selectedDiet.label}</span>
              <span>{selectedAllergies.length || "0"} dị ứng</span>
              <span>{totalSuggestionCount} gợi ý</span>
            </div>
          </aside>
        </section>

        {showGuide && (
          <section className="taste-guide" aria-live="polite">
            <strong>Cách FoodHub dùng hồ sơ này</strong>
            <p>Chế độ ăn, dị ứng và thói quen như mức cay/ngọt sẽ được dùng để xếp hạng món phù hợp và tạo ghi chú nhanh khi đặt hàng.</p>
          </section>
        )}

        {shouldShowPreferenceNudge && (
          <section className="food-preference-nudge" aria-live="polite">
            <div className="food-preference-nudge__content">
              <span className="food-preference-nudge__eyebrow">Gợi ý chính xác hơn</span>
              <h3>Thêm vài thông tin khẩu vị để gợi ý sát hơn</h3>
              <p>
                Chọn chế độ ăn, dị ứng và mức cay/ngọt để FoodHub ưu tiên món phù hợp, đồng thời nhắc bạn kiểm tra thành phần trước khi đặt.
              </p>
              <div className="food-preference-nudge__chips">
                {completion.missingChips.diet && <span className="food-preference-nudge__chip">Chế độ ăn</span>}
                {completion.missingChips.allergy && <span className="food-preference-nudge__chip">Dị ứng nếu có</span>}
                {completion.missingChips.taste && <span className="food-preference-nudge__chip">Mức cay/ngọt, hành/ngò</span>}
              </div>
            </div>
            <button type="button" className="food-preference-nudge__action" onClick={handleScrollToPreferenceProfile}>Bổ sung ngay</button>
          </section>
        )}

        <section className="section recommendation-section">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">Gợi ý hôm nay</span>
              <h2 className="section-title">Món phù hợp với bạn</h2>
            </div>
            <span className="section-count">{totalSuggestionCount} món</span>
          </div>

          {recommendationLoading && <div className="recommendation-skeleton" aria-label="Đang tìm món phù hợp" />}

          {!recommendationLoading && recommendationError && (
            <div className="recommendation-error">Chưa thể tải gợi ý lúc này. Vui lòng thử lại sau.</div>
          )}

          {!recommendationLoading && !recommendationError && !(accessibleRestaurants || []).length && (
            <div className="recommendation-empty recommendation-empty--rich">
              <div className="recommendation-empty__icon">🍽️</div>
              <h3>Chưa có nhà hàng để gợi ý món</h3>
              <p>Hãy khám phá nhà hàng trước, FoodHub sẽ dùng dữ liệu đó để gợi ý chính xác hơn.</p>
              <button type="button" className="btn-view-dish" onClick={() => navigate("/restaurants")}>Khám phá nhà hàng</button>
            </div>
          )}

          {!recommendationLoading && !recommendationError && (accessibleRestaurants || []).length > 0 && (
            <>
              {visibleRecommendedItems.length > 0 && (
                <div className="recommendation-group">
                  <p className="section-desc">{personalizationSubtitle}</p>
                  <div className="recommendation-grid">
                    {visibleRecommendedItems.map((item, index) => (
                      <RecommendationCard key={`match-${item?.id || index}`} item={item} variant="match" onView={handleViewDish} />
                    ))}
                  </div>
                </div>
              )}

              {visibleWarningItems.length > 0 && (
                <div className="recommendation-group">
                  <h2 className="section-title">Món cần kiểm tra dị ứng</h2>
                  <p className="section-desc">Các món này có thể chứa thành phần bạn dị ứng. Nên kiểm tra lại với nhà hàng trước khi đặt.</p>
                  <div className="recommendation-grid">
                    {visibleWarningItems.map((item, index) => (
                      <RecommendationCard key={`warning-${item?.id || index}`} item={item} variant="warning" onView={handleViewDish} />
                    ))}
                  </div>
                </div>
              )}

              {visibleFallbackItems.length > 0 && (
                <div className="recommendation-group">
                  <h2 className="section-title">Món phổ biến để tham khảo</h2>
                  <div className="recommendation-grid">
                    {visibleFallbackItems.map((item, index) => (
                      <RecommendationCard key={`fallback-${item?.id || index}`} item={item} variant="fallback" onView={handleViewDish} />
                    ))}
                  </div>
                </div>
              )}

              {visibleRecommendedItems.length === 0 && visibleWarningItems.length === 0 && visibleFallbackItems.length === 0 && (
                <div className="recommendation-empty recommendation-empty--rich">
                  <div className="recommendation-empty__icon">✨</div>
                  <h3>Chưa có gợi ý nổi bật lúc này</h3>
                  <p>Hãy cập nhật khẩu vị hoặc khám phá thêm nhà hàng.</p>
                  <button type="button" className="btn-view-dish" onClick={handleScrollToPreferenceProfile}>Cập nhật khẩu vị</button>
                </div>
              )}
            </>
          )}
        </section>

        {error && <div className="profile-error">Lỗi tải khẩu vị: {error.message}</div>}

        <section className="section preference-profile" id="food-preference-profile">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">Hồ sơ khẩu vị</span>
              <h2 className="profile-section-heading"><Leaf size={18} /> Chế độ ăn uống</h2>
            </div>
            <span className="section-count">{selectedDiet.label}</span>
          </div>
          <p className="section-desc">Chúng tôi sẽ ưu tiên gợi ý món phù hợp.</p>
          <div className="diet-grid">
            {DIETS.map((diet) => (
              <button
                key={diet.id}
                type="button"
                className={`diet-card ${preferences.diet === diet.id ? "active" : ""}`}
                onClick={() => setPreferences((prev) => ({ ...prev, diet: diet.id }))}
              >
                <span className="diet-icon">{diet.icon}</span>
                <span className="diet-info"><strong>{diet.label}</strong><small>{diet.desc}</small></span>
                {preferences.diet === diet.id && <span className="check-badge"><Check size={12} /></span>}
              </button>
            ))}
          </div>
        </section>

        <section className="section allergy-section">
          <h2 className="section-title"><AlertTriangle size={18} /> Cảnh báo dị ứng</h2>
          <p className="section-desc">Chọn thành phần cần tránh để hệ thống nhắc bạn kiểm tra món trước khi đặt.</p>
          <div className="allergy-chips">
            {ALLERGIES.map((item) => (
              <button key={item.id} type="button" className={`chip ${preferences.allergies.includes(item.id) ? "active" : ""}`} onClick={() => handleAllergyToggle(item.id)}>{item.icon} {item.label}</button>
            ))}
          </div>
        </section>

        <section className="section habits-section">
          <h2 className="section-title">Thói quen ăn uống</h2>
          <div className="habit-row"><div className="habit-label"><span>🚫🧅</span><span>Không hành</span></div><label className="switch"><input type="checkbox" checked={preferences.habits.noOnion} onChange={(e) => handleHabitChange("noOnion", e.target.checked)} /><span className="slider round" /></label></div>
          <div className="habit-row"><div className="habit-label"><span>🚫🌿</span><span>Không ngò</span></div><label className="switch"><input type="checkbox" checked={preferences.habits.noCilantro} onChange={(e) => handleHabitChange("noCilantro", e.target.checked)} /><span className="slider round" /></label></div>
          <div className="habit-row"><div className="habit-label"><span>🧊</span><span>Đá</span></div><div className="segment-control"><button type="button" className={preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", true)}>Có đá</button><button type="button" className={!preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", false)}>Không đá</button></div></div>
          <div className="habit-control"><div className="control-label"><Droplet size={16} /> Độ ngọt</div><div className="segment-control">{SUGAR_LEVELS.map((level) => <button type="button" key={level} className={preferences.habits.sugar === level ? "active" : ""} onClick={() => handleHabitChange("sugar", level)}>{level}%</button>)}</div></div>
          <div className="habit-control"><div className="control-label"><Flame size={16} /> Độ cay</div><div className="segment-control">{SPICE_LEVELS.map((level) => <button type="button" key={level} className={preferences.habits.spice === level ? "active" : ""} onClick={() => handleHabitChange("spice", level)}>{level}</button>)}</div></div>
        </section>

        <section className="section preview-section">
          <span className="section-kicker">Ghi chú tự động</span>
          <h3>Xem trước ghi chú đơn hàng</h3>
          <div className="preview-box"><span className="label">Note</span><span className="text">{buildFoodPreferenceNote(preferences)}</span></div>
          <p className="section-desc">Hồ sơ này sẽ được dùng để ưu tiên gợi ý món phù hợp.</p>
        </section>

        {isAuthenticated && isCustomer && (
          <section className={`section recent-suggestion-data ${hasBehaviorSignals ? "" : "recent-suggestion-data--empty"}`} aria-labelledby="recent-suggestion-data-title">
            <div>
              <h2 className="section-title" id="recent-suggestion-data-title">Dữ liệu gợi ý gần đây</h2>
              <p className="section-desc">{recentSuggestionDescription}</p>
              {clearMessage && <p className="recent-suggestion-data__message" aria-live="polite">{clearMessage}</p>}
            </div>
            {hasBehaviorSignals && (
              <button type="button" className="recent-suggestion-data__clear" onClick={handleClearRecentSuggestionData}>Xóa dữ liệu gợi ý gần đây</button>
            )}
          </section>
        )}
      </main>

      <footer className="footer-action">
        <div className="footer-action__inner">
          <button type="button" className="btn-quick" onClick={() => navigate("/restaurants")}>Khám phá món</button>
          {saveMessage && <div className={`save-message ${saveMessage.startsWith("Lưu thất bại") ? "error" : "success"}`}>{saveMessage}</div>}
          <button className="btn-save" type="button" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ khẩu vị"}</button>
        </div>
      </footer>
    </div>
  );
};

export default ForYou;
