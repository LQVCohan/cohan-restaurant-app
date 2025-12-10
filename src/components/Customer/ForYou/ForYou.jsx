import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Info,
  Check,
  Leaf,
  AlertTriangle,
  Flame,
  Snowflake,
  Droplet,
} from "lucide-react";
import "./ForYou.scss";

// --- MOCK DATA (Dữ liệu mẫu) ---
const DIETS = [
  { id: "omni", label: "Bình thường", icon: "🍖", desc: "Ăn uống đa dạng" },
  {
    id: "vegan",
    label: "Thuần chay",
    icon: "🥗",
    desc: "Không thịt, trứng, sữa",
  },
  {
    id: "keto",
    label: "Keto / Low Carb",
    icon: "🥑",
    desc: "Ít đường & tinh bột",
  },
  { id: "halal", label: "Halal", icon: "🕌", desc: "Chuẩn Hồi giáo" },
];

const ALLERGIES = [
  { id: "seafood", label: "Hải sản vỏ cứng", icon: "🦐" },
  { id: "peanut", label: "Đậu phộng", icon: "🥜" },
  { id: "milk", label: "Sữa / Lactose", icon: "🥛" },
  { id: "egg", label: "Trứng", icon: "🥚" },
  { id: "gluten", label: "Gluten", icon: "🍞" },
];

const SUGAR_LEVELS = [0, 30, 50, 70, 100];
const SPICE_LEVELS = ["Không", "Vừa", "Nồng"];

const ForYou = () => {
  // --- STATE ---
  const [selectedDiet, setSelectedDiet] = useState("omni");
  const [allergies, setAllergies] = useState([]);
  const [habits, setHabits] = useState({
    noOnion: false, // Team không hành
    sugar: 100,
    spice: "Vừa",
    ice: true,
  });

  // --- HANDLERS ---
  const handleAllergyToggle = (id) => {
    setAllergies((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleHabitChange = (field, value) => {
    setHabits((prev) => ({ ...prev, [field]: value }));
  };

  // --- LOGIC TẠO GHI CHÚ TỰ ĐỘNG (PREVIEW) ---
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
    if (habits.sugar !== 100) notes.push(`${habits.sugar}% đường`);
    if (habits.spice !== "Vừa") notes.push(`Cay: ${habits.spice}`);

    return notes.length > 0 ? notes.join(". ") : "Chưa có ghi chú đặc biệt.";
  }, [selectedDiet, allergies, habits]);

  return (
    <div className="foryou-container">
      {/* HEADER */}
      <header className="header">
        <button className="btn-back">
          <ChevronLeft size={24} />
        </button>
        <h1>Khẩu vị của bạn</h1>
        <button className="btn-info">
          <Info size={24} />
        </button>
      </header>

      <div className="content-scroll">
        {/* SECTION 1: DIET */}
        <section className="section">
          <h2 className="section-title">
            <Leaf size={18} /> Chế độ ăn uống
          </h2>
          <p className="section-desc">
            Chúng tôi sẽ ưu tiên gợi ý món phù hợp.
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
                <span className="diet-icon">{diet.icon}</span>
                <div className="diet-info">
                  <h3>{diet.label}</h3>
                  <span>{diet.desc}</span>
                </div>
                {selectedDiet === diet.id && (
                  <div className="check-badge">
                    <Check size={12} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: ALLERGIES */}
        <section className="section">
          <h2 className="section-title">
            <AlertTriangle size={18} /> Cảnh báo dị ứng
          </h2>
          <p className="section-desc">
            Món ăn chứa thành phần này sẽ được đánh dấu đỏ.
          </p>
          <div className="allergy-chips">
            {ALLERGIES.map((item) => (
              <button
                key={item.id}
                className={`chip ${
                  allergies.includes(item.id) ? "active" : ""
                }`}
                onClick={() => handleAllergyToggle(item.id)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 3: HABITS */}
        <section className="section">
          <h2 className="section-title">Thói quen ăn uống</h2>

          {/* Toggle Hành */}
          <div className="habit-row">
            <div className="habit-label">
              <span>🚫🧅</span>
              <span>Không ăn hành/ngò</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={habits.noOnion}
                onChange={(e) => handleHabitChange("noOnion", e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="divider"></div>

          {/* Chọn Độ Ngọt */}
          <div className="habit-control">
            <div className="control-label">
              <Droplet size={16} /> Độ ngọt (Mặc định)
            </div>
            <div className="segment-control">
              {SUGAR_LEVELS.map((level) => (
                <button
                  key={level}
                  className={habits.sugar === level ? "active" : ""}
                  onClick={() => handleHabitChange("sugar", level)}
                >
                  {level}%
                </button>
              ))}
            </div>
          </div>

          {/* Chọn Độ Cay */}
          <div className="habit-control">
            <div className="control-label">
              <Flame size={16} /> Độ cay
            </div>
            <div className="segment-control">
              {SPICE_LEVELS.map((level) => (
                <button
                  key={level}
                  className={habits.spice === level ? "active" : ""}
                  onClick={() => handleHabitChange("spice", level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* PREVIEW CARD */}
        <section className="section preview-section">
          <h3>Xem trước ghi chú đơn hàng</h3>
          <div className="preview-box">
            <span className="label">Note:</span>
            <span className="text">{autoNotePreview}</span>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="footer-action">
        <button className="btn-save">Lưu hồ sơ khẩu vị</button>
      </footer>
    </div>
  );
};

export default ForYou;
