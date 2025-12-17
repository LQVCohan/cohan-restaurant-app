import React, { useState, useMemo } from "react";
import "./FoodPreferences.scss";

// --- DATA ---
const DIETS = [
  {
    id: "omni",
    label: "Tiêu chuẩn",
    icon: "🍖",
    desc: "Ăn uống đa dạng, không kiêng khem",
  },
  {
    id: "vegan",
    label: "Thuần chay",
    icon: "🥗",
    desc: "Không thịt, trứng, sữa, mật ong",
  },
  {
    id: "keto",
    label: "Keto / Low Carb",
    icon: "🥑",
    desc: "Nhiều đạm, ít đường & tinh bột",
  },
  { id: "halal", label: "Halal", icon: "🕌", desc: "Thực phẩm chuẩn Hồi giáo" },
];

const ALLERGIES = [
  { id: "seafood", label: "Hải sản vỏ cứng", icon: "🦐" },
  { id: "peanut", label: "Đậu phộng", icon: "🥜" },
  { id: "milk", label: "Sữa / Lactose", icon: "🥛" },
  { id: "egg", label: "Trứng", icon: "🥚" },
  { id: "gluten", label: "Gluten (Bột mì)", icon: "🍞" },
];

const SUGAR_LEVELS = [0, 30, 50, 70, 100];
const SPICE_LEVELS = ["Không", "Vừa", "Nồng", "Rất cay"];

const FoodPreferences = () => {
  const [selectedDiet, setSelectedDiet] = useState("omni");
  const [allergies, setAllergies] = useState([]);
  const [habits, setHabits] = useState({
    noOnion: false,
    noCilantro: false,
    sugar: 100,
    spice: "Vừa",
    ice: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // --- HANDLERS ---
  const handleAllergyToggle = (id) => {
    setAllergies((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleHabitChange = (field, value) => {
    setHabits((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Giả lập API call
    setTimeout(() => {
      setIsSaving(false);
      alert("Đã lưu sở thích ăn uống của bạn!");
    }, 800);
  };

  // --- PREVIEW NOTE ---
  const autoNotePreview = useMemo(() => {
    let notes = [];
    if (selectedDiet !== "omni")
      notes.push(`Chế độ ${DIETS.find((d) => d.id === selectedDiet)?.label}`);
    if (allergies.length > 0)
      notes.push(
        `Dị ứng: ${allergies
          .map((id) => ALLERGIES.find((a) => a.id === id)?.label)
          .join(", ")}`
      );

    if (habits.noOnion) notes.push("KHÔNG HÀNH");
    if (habits.noCilantro) notes.push("KHÔNG NGÒ");

    if (habits.sugar !== 100) notes.push(`${habits.sugar}% đường`);
    if (habits.spice !== "Vừa") notes.push(`Cay: ${habits.spice}`);
    if (!habits.ice) notes.push("Không đá");

    return notes.length > 0 ? notes.join(". ") : "Không có ghi chú đặc biệt.";
  }, [selectedDiet, allergies, habits]);

  return (
    <div className="content-card fade-in">
      <div className="card-header">
        <h2 className="card-title">Khẩu vị & Thói quen</h2>
      </div>

      <div className="food-prefs-container">
        {/* 1. CHẾ ĐỘ ĂN */}
        <section className="pref-section">
          <h4 className="section-title">🥗 Chế độ ăn uống</h4>
          <p className="section-desc">
            Chúng tôi sẽ ưu tiên gợi ý món ăn phù hợp với chế độ của bạn.
          </p>

          <div className="diet-grid">
            {DIETS.map((diet) => (
              <div
                key={diet.id}
                className={`diet-card ${
                  selectedDiet === diet.id ? "active" : ""
                }`}
                onClick={() => setSelectedDiet(diet.id)}
              >
                <div className="diet-icon">{diet.icon}</div>
                <div className="diet-info">
                  <strong>{diet.label}</strong>
                  <span>{diet.desc}</span>
                </div>
                {selectedDiet === diet.id && (
                  <div className="check-mark">✓</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="divider-dashed"></div>

        {/* 2. DỊ ỨNG */}
        <section className="pref-section">
          <h4 className="section-title">⚠️ Cảnh báo dị ứng</h4>
          <p className="section-desc">
            Món ăn chứa thành phần này sẽ được cảnh báo đỏ.
          </p>
          <div className="allergy-tags">
            {ALLERGIES.map((item) => (
              <button
                key={item.id}
                className={`tag-item ${
                  allergies.includes(item.id) ? "active" : ""
                }`}
                onClick={() => handleAllergyToggle(item.id)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </section>

        <div className="divider-dashed"></div>

        {/* 3. THÓI QUEN CỤ THỂ */}
        <section className="pref-section">
          <h4 className="section-title">🥤 Thói quen pha chế</h4>

          <div className="habit-grid">
            {/* Hàng 1: Hành/Ngò */}
            <div className="habit-card">
              <span className="habit-icon">🌿</span>
              <span className="habit-name">Rau thơm</span>
              <div className="toggles">
                <label
                  className={`toggle-btn ${habits.noOnion ? "active" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={habits.noOnion}
                    onChange={(e) =>
                      handleHabitChange("noOnion", e.target.checked)
                    }
                  />
                  🚫 Hành
                </label>
                <label
                  className={`toggle-btn ${habits.noCilantro ? "active" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={habits.noCilantro}
                    onChange={(e) =>
                      handleHabitChange("noCilantro", e.target.checked)
                    }
                  />
                  🚫 Ngò
                </label>
              </div>
            </div>

            {/* Hàng 2: Đá */}
            <div className="habit-card">
              <span className="habit-icon">❄️</span>
              <span className="habit-name">Đá lạnh</span>
              <div className="segment-control">
                <button
                  className={habits.ice ? "active" : ""}
                  onClick={() => handleHabitChange("ice", true)}
                >
                  Có đá
                </button>
                <button
                  className={!habits.ice ? "active" : ""}
                  onClick={() => handleHabitChange("ice", false)}
                >
                  Không đá
                </button>
              </div>
            </div>

            {/* Hàng 3: Đường */}
            <div className="habit-card full-width">
              <span className="habit-icon">💧</span>
              <span className="habit-name">Độ ngọt (% Đường)</span>
              <div className="segment-control">
                {SUGAR_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    className={habits.sugar === lv ? "active" : ""}
                    onClick={() => handleHabitChange("sugar", lv)}
                  >
                    {lv}%
                  </button>
                ))}
              </div>
            </div>

            {/* Hàng 4: Cay */}
            <div className="habit-card full-width">
              <span className="habit-icon">🌶️</span>
              <span className="habit-name">Độ cay</span>
              <div className="segment-control">
                {SPICE_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    className={habits.spice === lv ? "active" : ""}
                    onClick={() => handleHabitChange("spice", lv)}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. PREVIEW BOX */}
        <div className="preview-box">
          <div className="preview-header">📝 Ghi chú tự động cho đơn hàng:</div>
          <div className="preview-text">"{autoNotePreview}"</div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="action-footer">
          <button className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu thiết lập"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FoodPreferences;
