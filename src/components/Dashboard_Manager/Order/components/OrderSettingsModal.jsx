import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../../components/common/Modal";
import useModalDraft from "../../../../hooks/useModalDraft";
import { useNotification } from "../../../../hooks/useNotification";
import {
  Clock,
  Palette,
  Layout,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  AlertOctagon,
} from "lucide-react";
import "./OrderSettingsModal.scss";

const DEFAULT_TIME_COLORS = {
  ok: "#16a34a",
  warn: "#eab308",
  danger: "#f97316",
  critical: "#b91c1c",
};

const COLOR_PRESETS = [
  {
    name: "Tiêu chuẩn",
    colors: {
      ok: "#16a34a",
      warn: "#eab308",
      danger: "#f97316",
      critical: "#b91c1c",
    },
  },
  {
    name: "Pastel (Dịu mắt)",
    colors: {
      ok: "#4ade80",
      warn: "#facc15",
      danger: "#fb923c",
      critical: "#f87171",
    },
  },
  {
    name: "Tương phản cao",
    colors: {
      ok: "#15803d",
      warn: "#b45309",
      danger: "#c2410c",
      critical: "#991b1b",
    },
  },
];

/* --- Mock Component để Preview --- */
const MockOrderCard = ({ chipSize, colors, timeSettings }) => {
  // Giả lập thời gian trôi qua để demo màu sắc
  const [demoMinutes, setDemoMinutes] = useState(5);

  useEffect(() => {
    // Loop demo time từ 0 -> critical + 5 rồi quay lại
    const maxTime = (Number(timeSettings.critical) || 30) + 5;
    const interval = setInterval(() => {
      setDemoMinutes((prev) => (prev > maxTime ? 1 : prev + 1));
    }, 2000); // 2 giây nhảy 1 phút giả lập
    return () => clearInterval(interval);
  }, [timeSettings]);

  // Xác định màu hiện tại dựa trên demoMinutes
  const currentColor = useMemo(() => {
    const m = demoMinutes;
    if (m >= timeSettings.critical) return colors.critical;
    if (m >= timeSettings.danger) return colors.danger;
    if (m >= timeSettings.warn) return colors.warn;
    return colors.ok;
  }, [demoMinutes, timeSettings, colors]);

  const getStatusIcon = () => {
    const m = demoMinutes;
    if (m >= timeSettings.critical) return <AlertOctagon size={16} />;
    if (m >= timeSettings.danger) return <Flame size={16} />;
    if (m >= timeSettings.warn) return <AlertTriangle size={16} />;
    return <CheckCircle2 size={16} />;
  };

  return (
    <div className="mockCard">
      <div className="mockCard__header" style={{ borderColor: currentColor }}>
        <span className="mockCard__id">#0123</span>
        <div
          className="mockCard__timer"
          style={{ backgroundColor: currentColor, color: "#fff" }}
        >
          {getStatusIcon()}
          <span>{demoMinutes}p</span>
        </div>
      </div>
      <div className={`mockCard__body size-${chipSize}`}>
        <div className="mockItem">
          <span className="qty">1</span>
          <span>Bò bít tết</span>
        </div>
        <div className="mockItem">
          <span className="qty">2</span>
          <span>Mì Ý sốt kem</span>
        </div>
        <div className="mockItem note">Note: Ít cay, không hành</div>
      </div>
      <div className="mockCard__hint">
        Preview: Màu sẽ thay đổi theo thời gian cài đặt
      </div>
    </div>
  );
};

/* --- Main Component --- */
const OrderSettingsModal = ({
  open,
  onClose,
  timeSettings,
  onSaveTimeSettings,
  chipSize,
  onSaveChipSize,
  timeColors,
  onSaveTimeColors,
}) => {
  const { showNotification } = useNotification();
  const [localTime, setLocalTime] = useState(
    timeSettings || { warn: 10, danger: 20, critical: 30 }
  );
  const [localChip, setLocalChip] = useState(chipSize || "m");
  const [localColors, setLocalColors] = useState(
    timeColors || DEFAULT_TIME_COLORS
  );
  const isDirty = useMemo(() => {
    const baseTime = timeSettings || { warn: 10, danger: 20, critical: 30 };
    const baseChip = chipSize || "m";
    const baseColors = timeColors || DEFAULT_TIME_COLORS;
    return (
      JSON.stringify(localTime) !== JSON.stringify(baseTime) ||
      localChip !== baseChip ||
      JSON.stringify(localColors) !== JSON.stringify(baseColors)
    );
  }, [chipSize, localChip, localColors, localTime, timeColors, timeSettings]);

  const { requestCloseWithDraft, clearDraft, didRestore } = useModalDraft({
    enabled: open,
    draftIdentity: {
      module: "order",
      modal: "order-settings-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "order-settings",
      recordId: null,
      context: "kitchen-board",
      schemaVersion: "1",
    },
    formValue: { localTime, localChip, localColors },
    isDirty,
    sanitize: (v) => ({
      localTime: v?.localTime || { warn: 10, danger: 20, critical: 30 },
      localChip: v?.localChip || "m",
      localColors: v?.localColors || DEFAULT_TIME_COLORS,
    }),
    onRestore: (draft) => {
      setLocalTime(draft?.localTime || { warn: 10, danger: 20, critical: 30 });
      setLocalChip(draft?.localChip || "m");
      setLocalColors(draft?.localColors || DEFAULT_TIME_COLORS);
    },
    notify: showNotification,
  });

  // Sync props -> state
  useEffect(() => {
    if (open) {
      if (didRestore) return;
      setLocalTime(timeSettings || { warn: 10, danger: 20, critical: 30 });
      setLocalChip(chipSize || "m");
      setLocalColors(timeColors || DEFAULT_TIME_COLORS);
    }
  }, [timeSettings, chipSize, timeColors, open, didRestore]);

  const handleTimeChange = (field, value) => {
    setLocalTime((prev) => ({
      ...prev,
      [field]: value === "" ? "" : Number(value),
    }));
  };

  const handleColorChange = (field, value) => {
    setLocalColors((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (presetColors) => {
    setLocalColors(presetColors);
  };

  const handleResetDefaults = () => {
    setLocalTime({ warn: 10, danger: 20, critical: 30 });
    setLocalChip("m");
    setLocalColors(DEFAULT_TIME_COLORS);
  };

  const handleSave = () => {
    let normalized = {
      warn: Number(localTime.warn) || 0,
      danger: Number(localTime.danger) || 0,
      critical: Number(localTime.critical) || 0,
    };

    // Auto-fix logic: ensure strict generic ascending order
    if (normalized.danger <= normalized.warn)
      normalized.danger = normalized.warn + 5;
    if (normalized.critical <= normalized.danger)
      normalized.critical = normalized.danger + 5;

    onSaveTimeSettings?.(normalized);
    onSaveChipSize?.(localChip);
    onSaveTimeColors?.(localColors);
    clearDraft();
    onClose?.();
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => requestCloseWithDraft(onClose)}
      title="⚙️ Cài đặt hiển thị & Bếp"
      size="xl"
    >
      <div className="osm-layout">
        {/* LEFT COLUMN: Settings Form */}
        <div className="osm-form">
          {/* 1. Time Thresholds */}
          <section className="osm-section">
            <div className="osm-section__header">
              <Clock className="icon" size={20} />
              <div>
                <h4>Ngưỡng cảnh báo thời gian</h4>
                <p>Đơn vị: phút. Màu sắc thẻ sẽ đổi khi vượt quá mốc này.</p>
              </div>
            </div>
            <div className="osm-time-inputs">
              <div className="input-group">
                <label>Cảnh báo</label>
                <div className="input-wrapper warn">
                  <input
                    type="number"
                    min="1"
                    value={localTime.warn}
                    onChange={(e) => handleTimeChange("warn", e.target.value)}
                  />
                  <span>phút</span>
                </div>
              </div>
              <div className="input-group">
                <label>Nguy hiểm</label>
                <div className="input-wrapper danger">
                  <input
                    type="number"
                    min={localTime.warn}
                    value={localTime.danger}
                    onChange={(e) => handleTimeChange("danger", e.target.value)}
                  />
                  <span>phút</span>
                </div>
              </div>
              <div className="input-group">
                <label>Khẩn cấp</label>
                <div className="input-wrapper critical">
                  <input
                    type="number"
                    min={localTime.danger}
                    value={localTime.critical}
                    onChange={(e) =>
                      handleTimeChange("critical", e.target.value)
                    }
                  />
                  <span>phút</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Colors */}
          <section className="osm-section">
            <div className="osm-section__header">
              <Palette className="icon" size={20} />
              <div>
                <h4>Màu sắc nhận diện</h4>
                <p>Tùy chỉnh màu theo ánh sáng bếp hoặc sở thích.</p>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="osm-colors-grid">
              {Object.keys(DEFAULT_TIME_COLORS).map((key) => (
                <div key={key} className="color-picker-item">
                  <label>
                    {key === "ok" && "Mới / Ổn"}
                    {key === "warn" && "Cảnh báo"}
                    {key === "danger" && "Nguy hiểm"}
                    {key === "critical" && "Khẩn cấp"}
                  </label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      value={localColors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                    />
                    <span className="hex-code">{localColors[key]}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="osm-presets">
              <span>Mẫu nhanh:</span>
              <div className="preset-badges">
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    className="preset-btn"
                    onClick={() => applyPreset(preset.colors)}
                    title="Áp dụng bộ màu này"
                  >
                    <div className="preset-dots">
                      {Object.values(preset.colors).map((c, i) => (
                        <span key={i} style={{ background: c }} />
                      ))}
                    </div>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Layout / Size */}
          <section className="osm-section">
            <div className="osm-section__header">
              <Layout className="icon" size={20} />
              <div>
                <h4>Chế độ hiển thị món (Chip Size)</h4>
                <p>Điều chỉnh độ lớn chữ để đầu bếp dễ nhìn từ xa.</p>
              </div>
            </div>
            <div className="osm-chip-options">
              {[
                { val: "s", label: "Nhỏ (Nhiều món)" },
                { val: "m", label: "Vừa (Tiêu chuẩn)" },
                { val: "l", label: "Lớn (Dễ đọc)" },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`chip-radio ${
                    localChip === opt.val ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="chipSize"
                    value={opt.val}
                    checked={localChip === opt.val}
                    onChange={(e) => setLocalChip(e.target.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Live Preview */}
        <div className="osm-preview">
          <div className="osm-preview__sticky">
            <h3 className="preview-title">Xem trước hiển thị</h3>
            <div className="preview-container">
              <MockOrderCard
                chipSize={localChip}
                colors={localColors}
                timeSettings={localTime}
              />
            </div>
            <div className="osm-preview__actions">
              <button className="btn-reset" onClick={handleResetDefaults}>
                <RotateCcw size={14} /> Khôi phục mặc định
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={() => requestCloseWithDraft(onClose)}>
          Hủy bỏ
        </button>
        <button className="btn btn--primary" onClick={handleSave}>
          Lưu cài đặt
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrderSettingsModal;
