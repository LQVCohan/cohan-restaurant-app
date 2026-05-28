import React, { useContext, useMemo, useState } from "react";
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
      <img className="recommendation-card__image" src={item?.thumbImage || "https://placehold.co/320x220?text=Mon+an"} alt={item?.name || "Món ăn"} loading="lazy" />
      <div className="recommendation-card__content">
        <h3>{item?.name || "Món ăn"}</h3>
        <p className="recommendation-restaurant">{item?.restaurantName || "Nhà hàng đang cập nhật"}</p>
        <p className="recommendation-price">{formatPrice(item?.basePrice)}đ</p>
        {variant === "match" && <span className="recommendation-badge recommendation-badge--match">✨ Món phù hợp với bạn</span>}
        {variant === "warning" && <span className="recommendation-badge recommendation-badge--warning">⚠ Cần kiểm tra dị ứng</span>}
        {variant === "fallback" && <p className="recommendation-fallback-note">Món phổ biến để tham khảo</p>}
        {reasons.map((reason) => (<p className="recommendation-reason" key={`${itemId}-${reason}`}>{reason}</p>))}
        {variant === "warning" && <p className="recommendation-warning-note">Hãy kiểm tra thành phần trước khi đặt.</p>}
        <button className="btn-view-dish" onClick={() => onView(item)}>Xem món</button>
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
    const recommendedIds = new Set(
      visibleRecommendedItems.map((item) => String(item?.id || "")),
    );
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
  const shouldShowPreferenceNudge = Boolean(
    isAuthenticated &&
      isCustomer &&
      !loading &&
      completion.shouldNudge,
  );

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
    ? "Chúng tôi dùng các món bạn đã xem hoặc quan tâm gần đây trên thiết bị này để sắp xếp gợi ý phù hợp hơn."
    : "Chưa có dữ liệu gợi ý gần đây trên thiết bị này. Khi bạn xem hoặc quan tâm món nào đó, chúng tôi sẽ dùng tín hiệu này để sắp xếp gợi ý phù hợp hơn.";

  const handleViewDish = (item) => {
    if (!item?.id) return;
    if (isCustomer) {
      recordForYouItemInteraction(user?.id, item, "click");
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
    refreshBehaviorSignals?.();
    setClearMessage("Đã xóa dữ liệu gợi ý gần đây trên thiết bị này.");
  };

  if (loading) {
    return <div className="foryou-container"><LoadingSpinner size="large" /></div>;
  }

  

  return (
    <div className="foryou-container">
      <header className="header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>Khẩu vị của bạn</h1>
        <button
          className="btn-info"
          onClick={() => alert("Hồ sơ khẩu vị giúp hệ thống gợi ý món và tự tạo ghi chú đơn hàng.")}
        >
          <Info size={24} />
        </button>
      </header>

      <div className="content-scroll">
        <section className="foryou-hero">
          <h2>Món phù hợp với bạn</h2>
          <p>{personalizationSubtitle}</p>
        </section>

        {shouldShowPreferenceNudge && (
          <section className="food-preference-nudge" aria-live="polite">
            <div className="food-preference-nudge__content">
              <span className="food-preference-nudge__eyebrow">Gợi ý chính xác hơn</span>
              <h3>Thêm vài thông tin khẩu vị để gợi ý sát hơn</h3>
              <p>
                Bạn có thể chọn chế độ ăn hoặc thói quen như mức cay/ngọt,
                hành/ngò. Nếu có dị ứng, hãy thêm để chúng tôi nhắc bạn kiểm tra món trước khi đặt.
              </p>
              <div className="food-preference-nudge__chips">
                {completion.missingChips.diet && (
                  <span className="food-preference-nudge__chip">Chế độ ăn</span>
                )}
                {completion.missingChips.allergy && (
                  <span className="food-preference-nudge__chip">Dị ứng nếu có</span>
                )}
                {completion.missingChips.taste && (
                  <span className="food-preference-nudge__chip">Mức cay/ngọt, hành/ngò</span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="food-preference-nudge__action"
              onClick={handleScrollToPreferenceProfile}
            >
              Cập nhật khẩu vị
            </button>
          </section>
        )}

        <section className="section recommendation-section">
          <h2 className="section-title">Món phù hợp với bạn</h2>

          {recommendationLoading && <div className="recommendation-empty">Đang tìm món phù hợp với bạn...</div>}

          {!recommendationLoading && recommendationError && (
            <div className="recommendation-error">Chưa thể tải gợi ý lúc này. Vui lòng thử lại sau.</div>
          )}

          {!recommendationLoading && !recommendationError && !(accessibleRestaurants || []).length && (
            <div className="recommendation-empty recommendation-empty--rich">
              <div className="recommendation-empty__icon">🍽️</div>
              <p>Chưa có nhà hàng để gợi ý món. Hãy khám phá nhà hàng trước.</p>
              <button type="button" className="btn-view-dish" onClick={handleScrollToPreferenceProfile}>Cập nhật khẩu vị</button>
            </div>
          )}

          {!recommendationLoading && !recommendationError && (accessibleRestaurants || []).length > 0 && (
            <>
              {visibleRecommendedItems.length > 0 && (
                <div className="recommendation-group">
                  <p className="section-desc">{personalizationSubtitle}</p>
                  <div className="recommendation-grid">{visibleRecommendedItems.map((item, index) => (<RecommendationCard key={`match-${item?.id || index}`} item={item} variant="match" onView={handleViewDish} />))}</div>
                </div>
              )}

              {visibleWarningItems.length > 0 && (
                <div className="recommendation-group">
                  <h2 className="section-title">Món cần kiểm tra dị ứng</h2>
                  <p className="section-desc">Các món này có thể chứa thành phần bạn dị ứng. Nên kiểm tra lại với nhà hàng trước khi đặt.</p>
                  <div className="recommendation-grid">{visibleWarningItems.map((item, index) => (<RecommendationCard key={`warning-${item?.id || index}`} item={item} variant="warning" onView={handleViewDish} />))}</div>
                </div>
              )}

              {visibleFallbackItems.length > 0 && (
                <div className="recommendation-group">
                  <h2 className="section-title">Món phổ biến để tham khảo</h2>
                  <div className="recommendation-grid">{visibleFallbackItems.map((item, index) => (<RecommendationCard key={`fallback-${item?.id || index}`} item={item} variant="fallback" onView={handleViewDish} />))}</div>
                </div>
              )}

              {visibleRecommendedItems.length === 0 && visibleWarningItems.length === 0 && visibleFallbackItems.length === 0 && (
                <div className="recommendation-empty recommendation-empty--rich">
                  <div className="recommendation-empty__icon">✨</div>
                  <p>Chưa có gợi ý nổi bật lúc này. Hãy cập nhật khẩu vị hoặc khám phá thêm nhà hàng.</p>
                  <button type="button" className="btn-view-dish" onClick={handleScrollToPreferenceProfile}>Cập nhật khẩu vị</button>
                </div>
              )}
            </>
          )}
        </section>

        {error && <div className="profile-error">Lỗi tải khẩu vị: {error.message}</div>}

        <section className="section" id="food-preference-profile">
          <h2 className="profile-section-heading"><Leaf size={18} /> Hồ sơ khẩu vị</h2>
          <h3 className="section-title"><Leaf size={18} /> Chế độ ăn uống</h3>
          <p className="section-desc">Chúng tôi sẽ ưu tiên gợi ý món phù hợp.</p>
          <div className="diet-grid">
            {DIETS.map((diet) => (
              <div key={diet.id} className={`diet-card ${preferences.diet === diet.id ? "active" : ""}`} onClick={() => setPreferences((prev) => ({ ...prev, diet: diet.id }))}>
                <span className="diet-icon">{diet.icon}</span><div className="diet-info"><h3>{diet.label}</h3><span>{diet.desc}</span></div>
                {preferences.diet === diet.id && <div className="check-badge"><Check size={12} /></div>}
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <h2 className="section-title"><AlertTriangle size={18} /> Cảnh báo dị ứng</h2>
          <div className="allergy-chips">
            {ALLERGIES.map((item) => (
              <button key={item.id} className={`chip ${preferences.allergies.includes(item.id) ? "active" : ""}`} onClick={() => handleAllergyToggle(item.id)}>{item.icon} {item.label}</button>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Thói quen ăn uống</h2>
          <div className="habit-row"><div className="habit-label"><span>🚫🧅</span><span>Không hành</span></div><label className="switch"><input type="checkbox" checked={preferences.habits.noOnion} onChange={(e) => handleHabitChange("noOnion", e.target.checked)} /><span className="slider round"></span></label></div>
          <div className="habit-row"><div className="habit-label"><span>🚫🌿</span><span>Không ngò</span></div><label className="switch"><input type="checkbox" checked={preferences.habits.noCilantro} onChange={(e) => handleHabitChange("noCilantro", e.target.checked)} /><span className="slider round"></span></label></div>
          <div className="habit-row"><div className="habit-label"><span>🧊</span><span>Đá</span></div><div className="segment-control"><button className={preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", true)}>Có đá</button><button className={!preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", false)}>Không đá</button></div></div>
          <div className="habit-control"><div className="control-label"><Droplet size={16} /> Độ ngọt</div><div className="segment-control">{SUGAR_LEVELS.map((level) => <button key={level} className={preferences.habits.sugar === level ? "active" : ""} onClick={() => handleHabitChange("sugar", level)}>{level}%</button>)}</div></div>
          <div className="habit-control"><div className="control-label"><Flame size={16} /> Độ cay</div><div className="segment-control">{SPICE_LEVELS.map((level) => <button key={level} className={preferences.habits.spice === level ? "active" : ""} onClick={() => handleHabitChange("spice", level)}>{level}</button>)}</div></div>
        </section>

        <section className="section preview-section"><h3>Xem trước ghi chú đơn hàng</h3><div className="preview-box"><span className="label">Note:</span><span className="text">{buildFoodPreferenceNote(preferences)}</span></div><p className="section-desc">Hồ sơ này sẽ được dùng để ưu tiên gợi ý món phù hợp.</p></section>
        {isAuthenticated && isCustomer && (
          <section
            className={`section recent-suggestion-data ${hasBehaviorSignals ? "" : "recent-suggestion-data--empty"}`}
            aria-labelledby="recent-suggestion-data-title"
          >
            <div>
              <h2 className="section-title" id="recent-suggestion-data-title">Dữ liệu gợi ý gần đây</h2>
              <p className="section-desc">{recentSuggestionDescription}</p>
              {clearMessage && <p className="recent-suggestion-data__message" aria-live="polite">{clearMessage}</p>}
            </div>
            {hasBehaviorSignals && (
              <button type="button" className="recent-suggestion-data__clear" onClick={handleClearRecentSuggestionData}>
                Xóa dữ liệu gợi ý gần đây
              </button>
            )}
          </section>
        )}
      </div>

      <footer className="footer-action">
        {saveMessage && <div className={`save-message ${saveMessage.startsWith("Lưu thất bại") ? "error" : "success"}`}>{saveMessage}</div>}
        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ khẩu vị"}</button>
      </footer>
    </div>
  );
};

export default ForYou;
