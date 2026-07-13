import React, { useEffect, useMemo, useState, useRef } from "react";
import Modal from "../../../common/Modal";
import { Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  buildSmartShiftRules,
  jobOptions,
  validateShiftRules,
} from "../utils/scheduleHelpers";
import ScoringGuideModal from "./ScoringGuideModal";
import "./ShiftRulesModal.scss";

const MANDATORY_ROLE_OPTIONS = jobOptions.map((option) => ({
  value: option.value,
  label: option.label,
}));

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();
const normalizeMandatoryRoles = (roles = []) =>
  Array.from(new Set((roles || []).map(normalizeRole).filter(Boolean)));

export const normalizeMandatoryShiftRoles = (value) => {
  if (!Array.isArray(value)) return undefined;
  return normalizeMandatoryRoles(value);
};

export const preserveMandatoryShiftRolesOnSave = (formState, existingPolicy) => {
  const normalizedDraft = normalizeMandatoryShiftRoles(formState);
  if (normalizedDraft) return normalizedDraft;
  return normalizeMandatoryRoles(existingPolicy?.mandatoryShiftRoles || []);
};

const RULE_LEVEL_OPTIONS = [
  { value: "hard", label: "Chặn cứng" },
  { value: "warning", label: "Cảnh báo / Cho override" },
  { value: "off", label: "Tắt rule" },
];

const DEFAULT_LABOR_RULES = {
  respectWorkingDays: true,
  workingDaysRuleLevel: "hard",

  respectLeaveRequests: true,
  leaveConflictRuleLevel: "hard",

  preventShiftOverlap: true,

  weeklyHoursCap: 48,
  recommendedWeeklyHoursCap: 40,
  weeklyHoursRuleLevel: "hard",

  maxShiftsPerDay: 1,
  maxShiftsPerDayRuleLevel: "warning",

  minRestHoursBetweenShifts: 10,
  minRestRuleLevel: "warning",

  maxConsecutiveWorkingDays: 6,
  hardMaxConsecutiveWorkingDays: 7,
  consecutiveDaysRuleLevel: "hard",

  allowManagerOverride: true,
  overrideRequiresReason: true,
};

const DEFAULT_SCORING_WEIGHTS = {
  roleFit: 20,
  availabilityFit: 15,
  workloadBalance: 15,
  fairness: 10,
  performance: 10,
  employmentTypeFit: 10,
  costEfficiency: 5,
  reliability: 5,
  fatiguePenalty: 20,
  overtimePenalty: 15,
  ruleRiskPenalty: 30,
};
const stripTypenameDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripTypenameDeep);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (key === "__typename") return acc;
      acc[key] = stripTypenameDeep(val);
      return acc;
    }, {});
  }

  return value;
};

const SCORING_FIELD_META = [
  {
    key: "roleFit",
    label: "Đúng vị trí",
    shortLabel: "Role",
    defaultValue: 20,
    min: 0,
    max: 30,
    recommended: "15–25",
    type: "positive",
    description:
      "Ưu tiên nhân viên có đúng vai trò cần xếp, ví dụ cần bartender thì bartender được ưu tiên hơn server.",
    impact:
      "Tăng quá cao sẽ khiến hệ thống ưu tiên đúng role hơn cả cân bằng giờ làm hoặc độ mệt.",
  },
  {
    key: "availabilityFit",
    label: "Đúng ngày khả dụng",
    shortLabel: "Khả dụng",
    defaultValue: 15,
    min: 0,
    max: 25,
    recommended: "10–20",
    type: "positive",
    description:
      "Ưu tiên nhân viên có workingDays phù hợp với ngày cần xếp ca.",
    impact:
      "Tăng cao sẽ làm hệ thống ít gợi ý nhân viên ngoài ngày khả dụng, kể cả khi thiếu người.",
  },
  {
    key: "workloadBalance",
    label: "Cân bằng giờ làm",
    shortLabel: "Cân bằng tải",
    defaultValue: 15,
    min: 0,
    max: 25,
    recommended: "10–20",
    type: "positive",
    description:
      "Ưu tiên nhân viên còn ít giờ trong tuần để chia đều khối lượng làm việc.",
    impact:
      "Tăng cao sẽ giúp chia ca công bằng hơn, nhưng có thể không chọn người giỏi nhất cho ca đông khách.",
  },
  {
    key: "fairness",
    label: "Công bằng ca đẹp / ca xấu",
    shortLabel: "Công bằng",
    defaultValue: 10,
    min: 0,
    max: 20,
    recommended: "5–15",
    type: "positive",
    description:
      "Dùng để chia đều ca tối, cuối tuần, ca cao điểm giữa các nhân viên.",
    impact:
      "Tăng cao giúp lịch công bằng hơn, nhưng có thể giảm tối ưu vận hành.",
  },
  {
    key: "performance",
    label: "Hiệu suất làm việc",
    shortLabel: "Hiệu suất",
    defaultValue: 10,
    min: 0,
    max: 20,
    recommended: "5–15",
    type: "positive",
    description:
      "Ưu tiên nhân viên có hiệu suất, độ phù hợp hoặc đánh giá tốt hơn.",
    impact:
      "Tăng cao sẽ ưu tiên người mạnh hơn cho ca quan trọng, nhưng có thể làm vài người bị xếp nhiều.",
  },
  {
    key: "employmentTypeFit",
    label: "Phù hợp loại nhân sự",
    shortLabel: "Loại nhân sự",
    defaultValue: 10,
    min: 0,
    max: 20,
    recommended: "5–15",
    type: "positive",
    description:
      "Cân nhắc full-time, part-time, thử việc, thời vụ khi chọn người cho ca.",
    impact:
      "Tăng cao sẽ làm hệ thống tôn trọng policy theo loại nhân sự mạnh hơn.",
  },
  {
    key: "costEfficiency",
    label: "Tối ưu chi phí",
    shortLabel: "Chi phí",
    defaultValue: 5,
    min: 0,
    max: 15,
    recommended: "3–10",
    type: "positive",
    description:
      "Ưu tiên phương án ít tạo thêm chi phí, ví dụ tránh tạo tăng ca không cần thiết.",
    impact:
      "Tăng cao giúp tiết kiệm chi phí hơn, nhưng có thể giảm chất lượng vận hành ở ca đông.",
  },
  {
    key: "reliability",
    label: "Độ tin cậy",
    shortLabel: "Tin cậy",
    defaultValue: 5,
    min: 0,
    max: 15,
    recommended: "3–10",
    type: "positive",
    description: "Ưu tiên nhân viên ít đi trễ, ít vắng, ít lỗi chấm công.",
    impact: "Tăng cao sẽ ưu tiên người ổn định hơn, phù hợp cho ca quan trọng.",
  },
  {
    key: "fatiguePenalty",
    label: "Phạt quá tải / làm liên tục",
    shortLabel: "Quá tải",
    defaultValue: 20,
    min: 0,
    max: 35,
    recommended: "15–25",
    type: "penalty",
    description:
      "Trừ điểm nhân viên đã làm nhiều ngày liên tục hoặc có dấu hiệu quá tải.",
    impact:
      "Tăng cao sẽ tránh xếp nhân viên làm quá sức, nhưng có thể khó lấp ca khi thiếu người.",
  },
  {
    key: "overtimePenalty",
    label: "Phạt nguy cơ tăng ca",
    shortLabel: "Tăng ca",
    defaultValue: 15,
    min: 0,
    max: 30,
    recommended: "10–20",
    type: "penalty",
    description: "Trừ điểm nếu phân công có nguy cơ vượt giờ hoặc tạo tăng ca.",
    impact:
      "Tăng cao giúp kiểm soát overtime tốt hơn, nhưng có thể giảm linh hoạt vận hành.",
  },
  {
    key: "ruleRiskPenalty",
    label: "Phạt rủi ro vi phạm rule",
    shortLabel: "Rủi ro rule",
    defaultValue: 30,
    min: 0,
    max: 40,
    recommended: "20–35",
    type: "penalty",
    description:
      "Trừ điểm khi phân công có cảnh báo như ngoài workingDays, vượt khuyến nghị giờ tuần, nghỉ chưa đủ giữa ca.",
    impact:
      "Tăng cao giúp hệ thống né rủi ro mạnh hơn. Nếu đặt quá thấp, lịch có thể linh hoạt nhưng dễ phát sinh cảnh báo.",
  },
];

const SCORING_FIELD_MAP = SCORING_FIELD_META.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

const SCORING_PRESETS = {
  balanced: {
    label: "Cân bằng",
    description: "Phù hợp mặc định cho hầu hết nhà hàng.",
    values: DEFAULT_SCORING_WEIGHTS,
  },
  complianceFirst: {
    label: "Ưu tiên tuân thủ",
    description: "Giảm rủi ro xếp quá giờ, làm liên tục, ngoài rule.",
    values: {
      roleFit: 18,
      availabilityFit: 20,
      workloadBalance: 18,
      fairness: 10,
      performance: 8,
      employmentTypeFit: 12,
      costEfficiency: 5,
      reliability: 7,
      fatiguePenalty: 28,
      overtimePenalty: 24,
      ruleRiskPenalty: 36,
    },
  },
  performanceFirst: {
    label: "Ưu tiên hiệu suất",
    description: "Phù hợp khi cần người mạnh cho ca cao điểm.",
    values: {
      roleFit: 24,
      availabilityFit: 12,
      workloadBalance: 10,
      fairness: 6,
      performance: 18,
      employmentTypeFit: 8,
      costEfficiency: 4,
      reliability: 10,
      fatiguePenalty: 16,
      overtimePenalty: 12,
      ruleRiskPenalty: 24,
    },
  },
  costControl: {
    label: "Kiểm soát chi phí",
    description: "Giảm nguy cơ phát sinh overtime và chi phí nhân sự.",
    values: {
      roleFit: 18,
      availabilityFit: 14,
      workloadBalance: 18,
      fairness: 10,
      performance: 8,
      employmentTypeFit: 10,
      costEfficiency: 14,
      reliability: 6,
      fatiguePenalty: 22,
      overtimePenalty: 26,
      ruleRiskPenalty: 30,
    },
  },
};

const clampScoreValue = (key, value) => {
  const meta = SCORING_FIELD_MAP[key];
  const fallback = meta?.defaultValue ?? DEFAULT_SCORING_WEIGHTS[key] ?? 0;
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;
  if (!meta) return n;

  return Math.max(meta.min, Math.min(meta.max, Math.round(n)));
};

const normalizeScoringWeights = (weights = {}) => {
  const clean = stripTypenameDeep(weights);

  return SCORING_FIELD_META.reduce((acc, meta) => {
    acc[meta.key] = clampScoreValue(
      meta.key,
      clean[meta.key] ?? meta.defaultValue,
    );
    return acc;
  }, {});
};

const getScoringTotal = (weights = {}) =>
  SCORING_FIELD_META.reduce(
    (sum, meta) => sum + Number(weights[meta.key] || 0),
    0,
  );

const shiftRulesToTemplates = (rules = []) =>
  rules.map((rule) => ({
    key: String(rule.type || "").toLowerCase(),
    label: rule.label || rule.type,
    startTime: rule.startTime,
    endTime: rule.endTime,
    enabled: true,
    allowCrossDay: rule.endTime <= rule.startTime,
  }));

const coerceNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const ShiftRulesModal = ({
  isOpen,
  onClose,
  rules,
  policy,
  policyLoading = false,
  policySaving = false,
  saveError = "",
  saveMessage = "",
  mandatoryShiftRoles = [],
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState("shifts");
  const [draftRules, setDraftRules] = useState(rules);
  const [draftLaborRules, setDraftLaborRules] = useState(DEFAULT_LABOR_RULES);
  const [draftScoringWeights, setDraftScoringWeights] = useState(
    DEFAULT_SCORING_WEIGHTS,
  );
  const [draftMandatoryRoles, setDraftMandatoryRoles] = useState([]);
  const [isScoringGuideOpen, setIsScoringGuideOpen] = useState(false);
  const initializedOpenRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      initializedOpenRef.current = false;
      setIsScoringGuideOpen(false);
      return;
    }

    if (initializedOpenRef.current) return;

    initializedOpenRef.current = true;

    setDraftRules(rules);

    setDraftLaborRules({
      ...DEFAULT_LABOR_RULES,
      ...stripTypenameDeep(policy?.laborRules || {}),
    });

    setDraftScoringWeights(
      normalizeScoringWeights({
        ...DEFAULT_SCORING_WEIGHTS,
        ...(policy?.scoringWeights || {}),
      }),
    );

    setDraftMandatoryRoles(normalizeMandatoryRoles(mandatoryShiftRoles));

    setActiveTab("shifts");
  }, [isOpen, mandatoryShiftRoles, policy, rules]);
  const validation = useMemo(
    () => validateShiftRules(draftRules),
    [draftRules],
  );

  const handleUseSmartCount = (count) => {
    setDraftRules(buildSmartShiftRules(count));
  };

  const handleChangeTime = (type, field, value) => {
    setDraftRules((prev) =>
      prev.map((rule) =>
        rule.type === type
          ? {
              ...rule,
              [field]: value,
              time: `${
                field === "startTime" ? value : rule.startTime
              } - ${field === "endTime" ? value : rule.endTime}`,
            }
          : rule,
      ),
    );
  };

  const handleAddShift = () => {
    setDraftRules((prev) => buildSmartShiftRules(Math.min(3, prev.length + 1)));
  };

  const handleRemoveShift = () => {
    setDraftRules((prev) => buildSmartShiftRules(Math.max(2, prev.length - 1)));
  };

  const updateLaborRule = (field, value) => {
    setDraftLaborRules((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateScoringWeight = (field, value) => {
    setDraftScoringWeights((prev) => ({
      ...prev,
      [field]: clampScoreValue(field, value),
    }));
  };

  const applyScoringPreset = (presetKey) => {
    const preset = SCORING_PRESETS[presetKey];
    if (!preset) return;
    setDraftScoringWeights(normalizeScoringWeights(preset.values));
  };

  const toggleMandatoryRole = (role) => {
    const key = normalizeRole(role);
    if (!key) return;
    setDraftMandatoryRoles((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!validation.ok || policySaving) return;

    const policyInput = stripTypenameDeep({
      shiftTemplates: shiftRulesToTemplates(draftRules),
      laborRules: {
        ...stripTypenameDeep(draftLaborRules),
        weeklyHoursCap: coerceNumber(draftLaborRules.weeklyHoursCap, 48),
        recommendedWeeklyHoursCap: coerceNumber(
          draftLaborRules.recommendedWeeklyHoursCap,
          40,
        ),
        maxShiftsPerDay: coerceNumber(draftLaborRules.maxShiftsPerDay, 1),
        minRestHoursBetweenShifts: coerceNumber(
          draftLaborRules.minRestHoursBetweenShifts,
          10,
        ),
        maxConsecutiveWorkingDays: coerceNumber(
          draftLaborRules.maxConsecutiveWorkingDays,
          6,
        ),
        hardMaxConsecutiveWorkingDays: coerceNumber(
          draftLaborRules.hardMaxConsecutiveWorkingDays,
          7,
        ),
      },
      scoringWeights: normalizeScoringWeights(draftScoringWeights),
      mandatoryShiftRoles: preserveMandatoryShiftRolesOnSave(
        draftMandatoryRoles,
        policy,
      ),
    });

    await onApply(draftRules, policyInput);
  };
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        className="shift-rules-modal"
      >
        <Modal.Header>Cài đặt lịch làm việc</Modal.Header>

        <Modal.Body>
          <div className="shift-rules-tabs">
            <button
              type="button"
              className={activeTab === "shifts" ? "active" : ""}
              onClick={() => setActiveTab("shifts")}
            >
              Khung ca
            </button>
            <button
              type="button"
              className={activeTab === "laborRules" ? "active" : ""}
              onClick={() => setActiveTab("laborRules")}
            >
              Quy tắc xếp lịch
            </button>
            <button
              type="button"
              className={activeTab === "scoring" ? "active" : ""}
              onClick={() => setActiveTab("scoring")}
            >
              Trọng số ưu tiên
            </button>
          </div>

          {activeTab === "shifts" ? (
            <>
              <div className="shift-rules-toolbar">
                <div className="toolbar-title">
                  <Settings2 size={18} />
                  <div>
                    <strong>Khung ca theo ngày</strong>
                    <span>
                      Thiết lập giờ bắt đầu/kết thúc cho từng ca. Hỗ trợ ca qua
                      ngày nếu giờ kết thúc nhỏ hơn giờ bắt đầu.
                    </span>
                  </div>
                </div>
                <div className="smart-count-actions">
                  <button type="button" onClick={() => handleUseSmartCount(2)}>
                    2 ca
                  </button>
                  <button type="button" onClick={() => handleUseSmartCount(3)}>
                    3 ca
                  </button>
                </div>
              </div>

              <div className="shift-rule-list">
                {draftRules.map((rule) => (
                  <div className="shift-rule-row" key={rule.type}>
                    <div className="rule-name">
                      <span className="rule-icon">{rule.icon}</span>
                      <div>
                        <strong>{rule.label}</strong>
                        <span>{rule.type}</span>
                      </div>
                    </div>

                    <label>
                      Bắt đầu
                      <input
                        type="time"
                        value={rule.startTime}
                        onChange={(event) =>
                          handleChangeTime(
                            rule.type,
                            "startTime",
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label>
                      Kết thúc
                      <input
                        type="time"
                        value={rule.endTime}
                        onChange={(event) =>
                          handleChangeTime(
                            rule.type,
                            "endTime",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="shift-rule-actions">
                <button
                  type="button"
                  onClick={handleAddShift}
                  disabled={draftRules.length >= 3}
                >
                  <Plus size={16} />
                  Thêm ca
                </button>
                <button
                  type="button"
                  onClick={handleRemoveShift}
                  disabled={draftRules.length <= 2}
                >
                  <Trash2 size={16} />
                  Bớt ca
                </button>
              </div>

              {!validation.ok ? (
                <div className="shift-rule-errors">
                  {validation.errors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              ) : null}
              <div className="mandatory-roles-box">
                <div className="mandatory-roles-header">
                  <strong>Role bắt buộc trong mọi ca</strong>
                  <span>
                    Các role này được dùng để cảnh báo khi một ca chưa đủ thành
                    phần. Không chặn tạo ca.
                  </span>
                  <span>
                    Vai trò bắt buộc toàn cục sẽ được áp dụng khi thêm ca. Chỉ
                    xóa khi muốn thay đổi chính sách.
                  </span>
                </div>
                <div className="mandatory-role-options">
                  {MANDATORY_ROLE_OPTIONS.map((option) => {
                    const checked = draftMandatoryRoles.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`mandatory-role-chip ${checked ? "active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMandatoryRole(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "laborRules" ? (
            <div className="labor-rules-panel">
              <div className="policy-banner">
                <SlidersHorizontal size={18} />
                <div>
                  <strong>Rule này được lưu ở backend SchedulingPolicy</strong>
                  <span>
                    Frontend preview vẫn giữ để UX tốt, nhưng backend sẽ là lớp
                    validate cuối cùng khi tạo/sửa ca.
                  </span>
                </div>
              </div>

              <div className="rules-grid">
                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Ngày khả dụng / workingDays</strong>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={draftLaborRules.respectWorkingDays}
                        onChange={(event) =>
                          updateLaborRule(
                            "respectWorkingDays",
                            event.target.checked,
                          )
                        }
                      />
                      Bật
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.workingDaysRuleLevel}
                    onChange={(event) =>
                      updateLaborRule("workingDaysRuleLevel", event.target.value)
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Nghỉ phép</strong>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={draftLaborRules.respectLeaveRequests}
                        onChange={(event) =>
                          updateLaborRule(
                            "respectLeaveRequests",
                            event.target.checked,
                          )
                        }
                      />
                      Bật
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.leaveConflictRuleLevel}
                    onChange={(event) =>
                      updateLaborRule(
                        "leaveConflictRuleLevel",
                        event.target.value,
                      )
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Chặn trùng ca</strong>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={draftLaborRules.preventShiftOverlap}
                        onChange={(event) =>
                          updateLaborRule(
                            "preventShiftOverlap",
                            event.target.checked,
                          )
                        }
                      />
                      Bật
                    </label>
                  </div>
                  <p>
                    Rule này nên luôn bật để tránh nhân viên bị xếp hai ca chồng
                    giờ.
                  </p>
                </div>

                <div className="rule-card">
                  <strong>Giờ làm / tuần</strong>
                  <div className="inline-fields">
                    <label>
                      Khuyến nghị
                      <input
                        type="number"
                        min="0"
                        value={draftLaborRules.recommendedWeeklyHoursCap}
                        onChange={(event) =>
                          updateLaborRule(
                            "recommendedWeeklyHoursCap",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      Giới hạn
                      <input
                        type="number"
                        min="0"
                        value={draftLaborRules.weeklyHoursCap}
                        onChange={(event) =>
                          updateLaborRule("weeklyHoursCap", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.weeklyHoursRuleLevel}
                    onChange={(event) =>
                      updateLaborRule("weeklyHoursRuleLevel", event.target.value)
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <strong>Số ca tối đa / ngày</strong>
                  <div className="inline-fields single">
                    <label>
                      Số ca
                      <input
                        type="number"
                        min="1"
                        value={draftLaborRules.maxShiftsPerDay}
                        onChange={(event) =>
                          updateLaborRule("maxShiftsPerDay", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.maxShiftsPerDayRuleLevel}
                    onChange={(event) =>
                      updateLaborRule(
                        "maxShiftsPerDayRuleLevel",
                        event.target.value,
                      )
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <strong>Giờ nghỉ giữa 2 ca</strong>
                  <div className="inline-fields single">
                    <label>
                      Số giờ nghỉ tối thiểu
                      <input
                        type="number"
                        min="0"
                        value={draftLaborRules.minRestHoursBetweenShifts}
                        onChange={(event) =>
                          updateLaborRule(
                            "minRestHoursBetweenShifts",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.minRestRuleLevel}
                    onChange={(event) =>
                      updateLaborRule("minRestRuleLevel", event.target.value)
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <strong>Ngày làm liên tục</strong>
                  <div className="inline-fields">
                    <label>
                      Cảnh báo từ
                      <input
                        type="number"
                        min="1"
                        value={draftLaborRules.maxConsecutiveWorkingDays}
                        onChange={(event) =>
                          updateLaborRule(
                            "maxConsecutiveWorkingDays",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      Chặn cứng sau
                      <input
                        type="number"
                        min="1"
                        value={draftLaborRules.hardMaxConsecutiveWorkingDays}
                        onChange={(event) =>
                          updateLaborRule(
                            "hardMaxConsecutiveWorkingDays",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <select
                    value={draftLaborRules.consecutiveDaysRuleLevel}
                    onChange={(event) =>
                      updateLaborRule(
                        "consecutiveDaysRuleLevel",
                        event.target.value,
                      )
                    }
                  >
                    {RULE_LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Override cảnh báo</strong>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={draftLaborRules.allowManagerOverride}
                        onChange={(event) =>
                          updateLaborRule(
                            "allowManagerOverride",
                            event.target.checked,
                          )
                        }
                      />
                      Cho phép
                    </label>
                  </div>
                  <label className="switch-row standalone">
                    <input
                      type="checkbox"
                      checked={draftLaborRules.overrideRequiresReason}
                      onChange={(event) =>
                        updateLaborRule(
                          "overrideRequiresReason",
                          event.target.checked,
                        )
                      }
                    />
                    Override bắt buộc nhập lý do
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "scoring" ? (
            <div className="scoring-panel">
              <div className="policy-banner scoring-help-banner">
                <SlidersHorizontal size={18} />
                <div>
                  <strong>Trọng số ưu tiên không phải điểm chấm nhân viên</strong>
                  <span>
                    Đây là mức độ quan trọng của từng tiêu chí khi hệ thống gợi ý
                    người phù hợp cho một ca. Số càng cao thì tiêu chí đó ảnh
                    hưởng càng mạnh. Nên dùng preset nếu bạn không chắc cần chỉnh
                    gì.
                  </span>
                </div>
                <button
                  type="button"
                  className="scoring-guide-trigger"
                  onClick={() => setIsScoringGuideOpen(true)}
                  aria-haspopup="dialog"
                >
                  Cách tính điểm
                </button>
              </div>

              <div className="scoring-presets">
                {Object.entries(SCORING_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyScoringPreset(key)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>

              <div className="scoring-total-box">
                <div>
                  <strong>
                    Tổng trọng số hiện tại: {getScoringTotal(draftScoringWeights)}
                  </strong>
                  <span>
                    Không bắt buộc bằng 100. Đây là bộ trọng số cộng/trừ trước khi
                    hệ thống quy về thang điểm 0–100.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => applyScoringPreset("balanced")}
                >
                  Khôi phục mặc định
                </button>
              </div>

              <div className="scoring-grid enhanced">
                {SCORING_FIELD_META.map((meta) => {
                  const value = Number(
                    draftScoringWeights[meta.key] ?? meta.defaultValue,
                  );

                  return (
                    <div
                      key={meta.key}
                      className={`score-card ${meta.type === "penalty" ? "penalty" : "positive"}`}
                    >
                      <div className="score-card-header">
                        <div>
                          <strong>{meta.label}</strong>
                          <span>{meta.shortLabel}</span>
                        </div>
                        <div className="score-value">{value}</div>
                      </div>

                      <p>{meta.description}</p>

                      <div className="score-range-row">
                        <input
                          type="range"
                          min={meta.min}
                          max={meta.max}
                          value={value}
                          onChange={(event) =>
                            updateScoringWeight(meta.key, event.target.value)
                          }
                        />
                        <input
                          type="number"
                          min={meta.min}
                          max={meta.max}
                          value={value}
                          onChange={(event) =>
                            updateScoringWeight(meta.key, event.target.value)
                          }
                        />
                      </div>

                      <div className="score-meta-row">
                        <span>Khuyến nghị: {meta.recommended}</span>
                        <span>
                          Giới hạn: {meta.min}–{meta.max}
                        </span>
                      </div>

                      <div className="score-impact">
                        <strong>Ảnh hưởng:</strong> {meta.impact}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {saveError ? (
            <div className="shift-rule-errors">
              <div>{saveError}</div>
            </div>
          ) : null}

          {saveMessage ? (
            <div className="policy-save-success">{saveMessage}</div>
          ) : null}
          {policyLoading ? (
            <div className="policy-loading">Đang tải SchedulingPolicy...</div>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={policySaving}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!validation.ok || policySaving}
          >
            {policySaving ? "Đang lưu..." : "Lưu cài đặt"}
          </button>
        </Modal.Footer>
      </Modal>

      <ScoringGuideModal
        isOpen={isOpen && isScoringGuideOpen}
        onClose={() => setIsScoringGuideOpen(false)}
        weights={draftScoringWeights}
      />
    </>
  );
};

export default ShiftRulesModal;
