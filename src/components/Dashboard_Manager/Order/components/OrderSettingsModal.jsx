import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../components/common/Modal";
import useModalDraft from "../../../../hooks/useModalDraft";
import { useNotification } from "../../../../hooks/useNotification";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Layout,
  MonitorCog,
  Palette,
  RotateCcw,
  Settings2,
} from "lucide-react";
import "./OrderSettingsModal.scss";

const DEFAULT_TIME_SETTINGS = {
  warn: 10,
  danger: 20,
  critical: 30,
};

const DEFAULT_TIME_COLORS = {
  ok: "#16a34a",
  warn: "#eab308",
  danger: "#f97316",
  critical: "#b91c1c",
};

const COLOR_LABELS = {
  ok: "Đúng tiến độ",
  warn: "Cảnh báo",
  danger: "Cần ưu tiên",
  critical: "Khẩn cấp",
};

const CHIP_SIZE_OPTIONS = [
  { value: "s", label: "Nhỏ", description: "Ưu tiên hiển thị nhiều món" },
  {
    value: "m",
    label: "Vừa",
    description: "Cân bằng số lượng và độ rõ",
  },
  { value: "l", label: "Lớn", description: "Dễ đọc khi đứng xa màn hình" },
];

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
    name: "Dịu mắt",
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

const isHexColor = (value) =>
  /^#[0-9a-f]{6}$/i.test(String(value || "").trim());

const normalizeChipSize = (value) =>
  CHIP_SIZE_OPTIONS.some((option) => option.value === value) ? value : "m";

const normalizeTimeColors = (colors) =>
  Object.fromEntries(
    Object.keys(DEFAULT_TIME_COLORS).map((key) => [
      key,
      isHexColor(colors?.[key]) ? colors[key] : DEFAULT_TIME_COLORS[key],
    ]),
  );

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const normalizeTimeSettings = (settings) => {
  const warn = toPositiveNumber(settings?.warn, DEFAULT_TIME_SETTINGS.warn);
  const dangerValue = toPositiveNumber(
    settings?.danger,
    DEFAULT_TIME_SETTINGS.danger,
  );
  const danger = dangerValue > warn ? dangerValue : warn + 5;
  const criticalValue = toPositiveNumber(
    settings?.critical,
    DEFAULT_TIME_SETTINGS.critical,
  );
  const critical = criticalValue > danger ? criticalValue : danger + 5;

  return { warn, danger, critical };
};

const MockOrderCard = ({ chipSize, colors, timeSettings }) => {
  const [demoMinutes, setDemoMinutes] = useState(5);

  useEffect(() => {
    const maxTime = timeSettings.critical + 5;
    const interval = window.setInterval(() => {
      setDemoMinutes((previous) => (previous > maxTime ? 1 : previous + 1));
    }, 2000);

    return () => window.clearInterval(interval);
  }, [timeSettings.critical]);

  const currentColor = useMemo(() => {
    if (demoMinutes >= timeSettings.critical) return colors.critical;
    if (demoMinutes >= timeSettings.danger) return colors.danger;
    if (demoMinutes >= timeSettings.warn) return colors.warn;
    return colors.ok;
  }, [colors, demoMinutes, timeSettings]);

  const statusIcon = useMemo(() => {
    if (demoMinutes >= timeSettings.critical) return <AlertOctagon size={16} />;
    if (demoMinutes >= timeSettings.danger) return <Flame size={16} />;
    if (demoMinutes >= timeSettings.warn) return <AlertTriangle size={16} />;
    return <CheckCircle2 size={16} />;
  }, [demoMinutes, timeSettings]);

  return (
    <div className="mockCard" aria-label="Bản xem trước thẻ món">
      <div className="mockCard__header" style={{ borderColor: currentColor }}>
        <span className="mockCard__id">Đơn #0123</span>
        <div
          className="mockCard__timer"
          style={{ backgroundColor: currentColor, color: "#fff" }}
        >
          {statusIcon}
          <span>{demoMinutes} phút</span>
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
        <div className="mockItem note">Ghi chú: Ít cay, không hành</div>
      </div>
      <div className="mockCard__hint">
        Màu thẻ thay đổi theo thời gian chờ
      </div>
    </div>
  );
};

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
    timeSettings || DEFAULT_TIME_SETTINGS,
  );
  const [localChip, setLocalChip] = useState(normalizeChipSize(chipSize));
  const [localColors, setLocalColors] = useState(
    normalizeTimeColors(timeColors),
  );

  const normalizedBaseTime = useMemo(
    () => normalizeTimeSettings(timeSettings),
    [timeSettings],
  );
  const normalizedBaseColors = useMemo(
    () => normalizeTimeColors(timeColors),
    [timeColors],
  );
  const previewTimeSettings = useMemo(
    () => normalizeTimeSettings(localTime),
    [localTime],
  );
  const previewColors = useMemo(
    () => normalizeTimeColors(localColors),
    [localColors],
  );
  const normalizedLocalChip = normalizeChipSize(localChip);

  const activePresetName = useMemo(
    () =>
      COLOR_PRESETS.find(
        (preset) =>
          JSON.stringify(preset.colors) === JSON.stringify(previewColors),
      )?.name || null,
    [previewColors],
  );

  const isDirty = useMemo(
    () =>
      JSON.stringify(localTime) !== JSON.stringify(normalizedBaseTime) ||
      normalizedLocalChip !== normalizeChipSize(chipSize) ||
      JSON.stringify(localColors) !== JSON.stringify(normalizedBaseColors),
    [
      chipSize,
      localColors,
      localTime,
      normalizedBaseColors,
      normalizedBaseTime,
      normalizedLocalChip,
    ],
  );

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
      schemaVersion: "2",
    },
    formValue: { localTime, localChip, localColors },
    isDirty,
    sanitize: (value) => ({
      localTime: value?.localTime || DEFAULT_TIME_SETTINGS,
      localChip: normalizeChipSize(value?.localChip),
      localColors: normalizeTimeColors(value?.localColors),
    }),
    onRestore: (draft) => {
      setLocalTime(draft?.localTime || DEFAULT_TIME_SETTINGS);
      setLocalChip(normalizeChipSize(draft?.localChip));
      setLocalColors(normalizeTimeColors(draft?.localColors));
    },
    notify: showNotification,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.orderChipSize = normalizeChipSize(chipSize);
  }, [chipSize]);

  useEffect(() => {
    if (!open || didRestore) return;
    setLocalTime(timeSettings || DEFAULT_TIME_SETTINGS);
    setLocalChip(normalizeChipSize(chipSize));
    setLocalColors(normalizeTimeColors(timeColors));
  }, [chipSize, didRestore, open, timeColors, timeSettings]);

  const handleTimeChange = (field, value) => {
    setLocalTime((previous) => ({
      ...previous,
      [field]: value === "" ? "" : Number(value),
    }));
  };

  const handleColorChange = (field, value) => {
    setLocalColors((previous) => ({ ...previous, [field]: value }));
  };

  const applyPreset = (presetColors) => {
    setLocalColors({ ...presetColors });
  };

  const handleResetDefaults = () => {
    setLocalTime({ ...DEFAULT_TIME_SETTINGS });
    setLocalChip("m");
    setLocalColors({ ...DEFAULT_TIME_COLORS });
  };

  const handleSave = () => {
    const savedTimeSettings = normalizeTimeSettings(localTime);
    const savedColors = normalizeTimeColors(localColors);
    const savedChipSize = normalizeChipSize(localChip);

    onSaveTimeSettings?.(savedTimeSettings);
    onSaveChipSize?.(savedChipSize);
    onSaveTimeColors?.(savedColors);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.orderChipSize = savedChipSize;
    }

    clearDraft();
    showNotification?.(
      "Đã lưu cài đặt hiển thị trên trình duyệt này.",
      "success",
    );
    onClose?.();
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => requestCloseWithDraft(onClose)}
      title={
        <span className="osm-modal-title">
          <Settings2 size={18} aria-hidden="true" />
          <span>Cài đặt màn hình Bếp và Quầy bar</span>
        </span>
      }
      size="xl"
    >
      <Modal.Body className="osm-scroll-body">
        <div className="osm-scope-note" role="note">
          <MonitorCog size={20} aria-hidden="true" />
          <div>
            <strong>Áp dụng trên trình duyệt hiện tại</strong>
            <span>
              Cài đặt dùng chung cho màn hình Bếp và Quầy bar. Thay đổi có hiệu lực
              sau khi chọn Lưu cài đặt.
            </span>
          </div>
        </div>

        <div className="osm-layout">
          <div className="osm-form">
            <section className="osm-section" aria-labelledby="osm-time-title">
              <div className="osm-section__header">
                <Clock className="icon" size={20} aria-hidden="true" />
                <div>
                  <h4 id="osm-time-title">Thời gian chờ và mức cảnh báo</h4>
                  <p>
                    Đặt số phút để thẻ món đổi màu, giúp nhân viên nhận biết món cần
                    ưu tiên. Mỗi mốc phải lớn hơn mốc trước.
                  </p>
                </div>
              </div>

              <div className="osm-time-inputs">
                {[
                  {
                    key: "warn",
                    label: "Bắt đầu cảnh báo",
                    tone: "warn",
                  },
                  { key: "danger", label: "Cần ưu tiên", tone: "danger" },
                  { key: "critical", label: "Khẩn cấp", tone: "critical" },
                ].map((item) => (
                  <div className="input-group" key={item.key}>
                    <label htmlFor={`osm-time-${item.key}`}>{item.label}</label>
                    <div className={`input-wrapper ${item.tone}`}>
                      <input
                        id={`osm-time-${item.key}`}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={localTime[item.key]}
                        onChange={(event) =>
                          handleTimeChange(item.key, event.target.value)
                        }
                        aria-label={`${item.label} (phút)`}
                      />
                      <span>phút</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="osm-section" aria-labelledby="osm-color-title">
              <div className="osm-section__header">
                <Palette className="icon" size={20} aria-hidden="true" />
                <div>
                  <h4 id="osm-color-title">Màu nhận biết theo mức độ</h4>
                  <p>
                    Chọn màu dễ phân biệt trong điều kiện ánh sáng tại khu chế biến.
                  </p>
                </div>
              </div>

              <div className="osm-colors-grid">
                {Object.keys(DEFAULT_TIME_COLORS).map((key) => (
                  <div key={key} className="color-picker-item">
                    <label htmlFor={`osm-color-${key}`}>{COLOR_LABELS[key]}</label>
                    <div className="color-input-wrapper">
                      <input
                        id={`osm-color-${key}`}
                        type="color"
                        value={previewColors[key]}
                        onChange={(event) =>
                          handleColorChange(key, event.target.value)
                        }
                        aria-label={`Màu ${COLOR_LABELS[key]}`}
                      />
                      <span className="hex-code">{previewColors[key]}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="osm-presets">
                <span>Bộ màu có sẵn</span>
                <div
                  className="preset-badges"
                  role="group"
                  aria-label="Chọn bộ màu hiển thị"
                >
                  {COLOR_PRESETS.map((preset) => {
                    const active = activePresetName === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        className={`preset-btn ${active ? "active" : ""}`}
                        onClick={() => applyPreset(preset.colors)}
                        aria-pressed={active}
                      >
                        <span className="preset-dots" aria-hidden="true">
                          {Object.values(preset.colors).map((color) => (
                            <span key={color} style={{ background: color }} />
                          ))}
                        </span>
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="osm-section" aria-labelledby="osm-size-title">
              <div className="osm-section__header">
                <Layout className="icon" size={20} aria-hidden="true" />
                <div>
                  <h4 id="osm-size-title">Kích thước hiển thị món</h4>
                  <p>
                    Điều chỉnh cỡ chữ và khoảng cách trong thẻ món theo vị trí đặt
                    màn hình.
                  </p>
                </div>
              </div>

              <div className="osm-chip-options">
                {CHIP_SIZE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`chip-radio ${
                      normalizedLocalChip === option.value ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="chipSize"
                      value={option.value}
                      checked={normalizedLocalChip === option.value}
                      onChange={(event) => setLocalChip(event.target.value)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="osm-preview" aria-label="Xem trước cài đặt">
            <div className="osm-preview__sticky">
              <h3 className="preview-title">Xem trước</h3>
              <div className="preview-container">
                <MockOrderCard
                  chipSize={normalizedLocalChip}
                  colors={previewColors}
                  timeSettings={previewTimeSettings}
                />
              </div>
              <div className="osm-preview__actions">
                <button
                  type="button"
                  className="btn-reset"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Đặt lại mặc định
                </button>
              </div>
            </div>
          </aside>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => requestCloseWithDraft(onClose)}
        >
          Hủy
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSave}
          disabled={!isDirty}
        >
          Lưu cài đặt
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrderSettingsModal;
