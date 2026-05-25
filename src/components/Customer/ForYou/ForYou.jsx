import React from "react";
import { ChevronLeft, Info, Check, Leaf, AlertTriangle, Flame, Droplet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import useFoodPreferences from "@/hooks/useFoodPreferences";
import {
  DIETS,
  ALLERGIES,
  SUGAR_LEVELS,
  SPICE_LEVELS,
  buildFoodPreferenceNote,
} from "./foodPreferenceConfig";
import "./ForYou.scss";

const ForYou = () => {
  const navigate = useNavigate();
  const { preferences, setPreferences, loading, error, saving, savePreferences } = useFoodPreferences();

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
      alert("Đã lưu hồ sơ khẩu vị");
    } catch (err) {
      alert(`Lưu thất bại: ${err.message}`);
    }
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
        {error && <div className="profile-error">Lỗi tải khẩu vị: {error.message}</div>}
        <section className="section">
          <h2 className="section-title"><Leaf size={18} /> Chế độ ăn uống</h2>
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

      <footer className="footer-action"><button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ khẩu vị"}</button></footer>
    </div>
  );
};

export default ForYou;
