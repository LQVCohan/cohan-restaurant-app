import React from "react";
import useFoodPreferences from "@/hooks/useFoodPreferences";
import {
  DIETS,
  ALLERGIES,
  SUGAR_LEVELS,
  SPICE_LEVELS,
  buildFoodPreferenceNote,
} from "@/components/Customer/ForYou/foodPreferenceConfig";
import "./FoodPreferences.scss";

const FoodPreferences = () => {
  const { preferences, setPreferences, loading, saving, error, savePreferences } = useFoodPreferences();

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

  const handleSave = async () => {
    try {
      await savePreferences(preferences);
      alert("Đã lưu sở thích ăn uống của bạn!");
    } catch (err) {
      alert(`Lưu thất bại: ${err.message}`);
    }
  };

  if (loading) return <div className="content-card fade-in">Đang tải dữ liệu khẩu vị...</div>;

  return (
    <div className="content-card fade-in">
      <div className="card-header"><h2 className="card-title">Khẩu vị & Thói quen</h2></div>
      {error && <div className="profile-error">Lỗi tải khẩu vị: {error.message}</div>}
      <div className="food-prefs-container">
        <section className="pref-section"><h4 className="section-title">🥗 Chế độ ăn uống</h4><div className="diet-grid">{DIETS.map((diet) => <div key={diet.id} className={`diet-card ${preferences.diet === diet.id ? "active" : ""}`} onClick={() => setPreferences((prev) => ({ ...prev, diet: diet.id }))}><div className="diet-icon">{diet.icon}</div><div className="diet-info"><strong>{diet.label}</strong><span>{diet.desc}</span></div>{preferences.diet === diet.id && <div className="check-mark">✓</div>}</div>)}</div></section>
        <div className="divider-dashed"></div>
        <section className="pref-section"><h4 className="section-title">⚠️ Cảnh báo dị ứng</h4><div className="allergy-tags">{ALLERGIES.map((item) => <button key={item.id} className={`tag-item ${preferences.allergies.includes(item.id) ? "active" : ""}`} onClick={() => handleAllergyToggle(item.id)}>{item.icon} {item.label}</button>)}</div></section>
        <div className="divider-dashed"></div>
        <section className="pref-section"><h4 className="section-title">🥤 Thói quen pha chế</h4><div className="habit-grid">
          <div className="habit-card"><span className="habit-icon">🌿</span><span className="habit-name">Rau thơm</span><div className="toggles"><label className={`toggle-btn ${preferences.habits.noOnion ? "active" : ""}`}><input type="checkbox" checked={preferences.habits.noOnion} onChange={(e) => handleHabitChange("noOnion", e.target.checked)} />🚫 Hành</label><label className={`toggle-btn ${preferences.habits.noCilantro ? "active" : ""}`}><input type="checkbox" checked={preferences.habits.noCilantro} onChange={(e) => handleHabitChange("noCilantro", e.target.checked)} />🚫 Ngò</label></div></div>
          <div className="habit-card"><span className="habit-icon">❄️</span><span className="habit-name">Đá lạnh</span><div className="segment-control"><button className={preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", true)}>Có đá</button><button className={!preferences.habits.ice ? "active" : ""} onClick={() => handleHabitChange("ice", false)}>Không đá</button></div></div>
          <div className="habit-card full-width"><span className="habit-icon">💧</span><span className="habit-name">Độ ngọt (% Đường)</span><div className="segment-control">{SUGAR_LEVELS.map((lv) => <button key={lv} className={preferences.habits.sugar === lv ? "active" : ""} onClick={() => handleHabitChange("sugar", lv)}>{lv}%</button>)}</div></div>
          <div className="habit-card full-width"><span className="habit-icon">🌶️</span><span className="habit-name">Độ cay</span><div className="segment-control">{SPICE_LEVELS.map((lv) => <button key={lv} className={preferences.habits.spice === lv ? "active" : ""} onClick={() => handleHabitChange("spice", lv)}>{lv}</button>)}</div></div>
        </div></section>
        <div className="preview-box"><div className="preview-header">📝 Ghi chú tự động cho đơn hàng:</div><div className="preview-text">"{buildFoodPreferenceNote(preferences)}"</div></div>
        <div className="action-footer"><button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thiết lập"}</button></div>
      </div>
    </div>
  );
};

export default FoodPreferences;
