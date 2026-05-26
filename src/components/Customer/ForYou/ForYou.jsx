import React, { useMemo, useState } from "react";
import { ChevronLeft, Info, Check, Leaf, AlertTriangle, Flame, Droplet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import useFoodPreferences from "@/hooks/useFoodPreferences";
import useForYouRecommendations from "@/hooks/useForYouRecommendations";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import {
  DIETS,
  ALLERGIES,
  SUGAR_LEVELS,
  SPICE_LEVELS,
  buildFoodPreferenceNote,
} from "./foodPreferenceConfig";
import "./ForYou.scss";

const formatPrice = (price) => Number(price || 0).toLocaleString("vi-VN");

const ForYou = () => {
  const navigate = useNavigate();
  const { preferences, setPreferences, loading, error, saving, savePreferences } = useFoodPreferences();
  const [saveMessage, setSaveMessage] = useState("");
  const {
    loading: recommendationLoading,
    error: recommendationError,
    recommendedItems: allRecommendedItems,
    warningItems: allWarningItems,
    fallbackItems: allFallbackItems,
    accessibleRestaurants,
  } = useForYouRecommendations({
    enabled: true,
    preferencesOverride: preferences,
  });

  const recommendedItems = useMemo(() => allRecommendedItems.slice(0, 8), [allRecommendedItems]);
  const warningItems = useMemo(() => allWarningItems.slice(0, 6), [allWarningItems]);
  const fallbackItems = useMemo(() => allFallbackItems.slice(0, 8), [allFallbackItems]);

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

  const handleViewDish = (item) => {
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

  const handleSave = async () => {
    setSaveMessage("");
    try {
      await savePreferences(preferences);
      setSaveMessage("Đã lưu hồ sơ khẩu vị thành công.");
    } catch (err) {
      setSaveMessage(`Lưu thất bại: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="foryou-container"><LoadingSpinner size="large" /></div>;
  }

  const displayItems = recommendedItems.length > 0 ? recommendedItems : fallbackItems;

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
          <h2>FOR YOU</h2>
          <p>Gợi ý món dựa trên khẩu vị, dị ứng và thói quen ăn uống của bạn.</p>
        </section>

        <section className="section recommendation-section">
          <h2 className="section-title">Món dành cho bạn</h2>

          {recommendationLoading && <div className="recommendation-empty">Đang tìm món phù hợp...</div>}

          {!recommendationLoading && recommendationError && (
            <div className="recommendation-error">{recommendationError}</div>
          )}

          {!recommendationLoading && !recommendationError && !accessibleRestaurants.length && (
            <div className="recommendation-empty">Chưa có nhà hàng để gợi ý món. Hãy khám phá nhà hàng trước.</div>
          )}

          {!recommendationLoading && !recommendationError && accessibleRestaurants.length > 0 && (
            <>
              {recommendedItems.length === 0 && displayItems.length > 0 && (
                <p className="section-desc">Món phổ biến có thể bạn thích</p>
              )}

              {displayItems.length > 0 ? (
                <div className="recommendation-grid">
                  {displayItems.map((item) => (
                    <article className="recommendation-card" key={item.id}>
                      <img
                        className="recommendation-card__image"
                        src={item.thumbImage || "https://placehold.co/320x220?text=Mon+an"}
                        alt={item.name}
                        loading="lazy"
                      />
                      <div className="recommendation-card__content">
                        <h3>{item.name}</h3>
                        <p className="recommendation-restaurant">{item.restaurantName}</p>
                        <p className="recommendation-price">{formatPrice(item.basePrice)}đ</p>
                        <div className="recommendation-badges">
                          {item.foodPreferenceMeta?.isRecommended && (
                            <span className="recommendation-badge recommendation-badge--match">✨ Phù hợp khẩu vị</span>
                          )}
                          {item.foodPreferenceMeta?.hasAllergyWarning && (
                            <span className="recommendation-badge recommendation-badge--warning">⚠ Có thể chứa dị ứng</span>
                          )}
                        </div>
                        {item.foodPreferenceMeta?.reasons?.[0] && (
                          <p className="recommendation-reason">{item.foodPreferenceMeta.reasons[0]}</p>
                        )}
                        <button className="btn-view-dish" onClick={() => handleViewDish(item)}>Xem món</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="recommendation-empty">Chưa có món phù hợp rõ ràng. Hãy thử cập nhật khẩu vị hoặc khám phá thêm nhà hàng.</div>
              )}
            </>
          )}
        </section>

        {!recommendationLoading && warningItems.length > 0 && (
          <section className="section recommendation-section">
            <h2 className="section-title">Món cần kiểm tra trước khi đặt</h2>
            <p className="section-desc">Các món này có thể chứa thành phần bạn đã đánh dấu dị ứng. Vui lòng kiểm tra lại với nhà hàng.</p>
            <div className="recommendation-grid">
              {warningItems.map((item) => (
                <article className="recommendation-card" key={`warning-${item.id}`}>
                  <img
                    className="recommendation-card__image"
                    src={item.thumbImage || "https://placehold.co/320x220?text=Mon+an"}
                    alt={item.name}
                    loading="lazy"
                  />
                  <div className="recommendation-card__content">
                    <h3>{item.name}</h3>
                    <p className="recommendation-restaurant">{item.restaurantName}</p>
                    <p className="recommendation-price">{formatPrice(item.basePrice)}đ</p>
                    <span className="recommendation-badge recommendation-badge--warning">⚠ Có thể chứa dị ứng</span>
                    <p className="recommendation-reason">{item.foodPreferenceMeta?.warningReason || "Vui lòng xác nhận thành phần với nhà hàng."}</p>
                    <button className="btn-view-dish" onClick={() => handleViewDish(item)}>Xem món</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {error && <div className="profile-error">Lỗi tải khẩu vị: {error.message}</div>}
        <section className="section">
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
      </div>

      <footer className="footer-action">
        {saveMessage && <div className={`save-message ${saveMessage.startsWith("Lưu thất bại") ? "error" : "success"}`}>{saveMessage}</div>}
        <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ khẩu vị"}</button>
      </footer>
    </div>
  );
};

export default ForYou;
