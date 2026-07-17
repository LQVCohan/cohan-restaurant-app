import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";

import Modal from "../../../common/Modal";
import {
  buildSmartShiftRules,
  jobOptions,
  resizeShiftRules,
  shiftTemplatesToRules,
  toShiftMinutes,
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

const SCORING_FIELDS = [
  ["roleFit", "Đúng vị trí", 0, 30, "15–25"],
  ["availabilityFit", "Đúng ngày khả dụng", 0, 25, "10–20"],
  ["workloadBalance", "Cân bằng giờ làm", 0, 25, "10–20"],
  ["fairness", "Công bằng ca", 0, 20, "5–15"],
  ["performance", "Hiệu suất", 0, 20, "5–15"],
  ["employmentTypeFit", "Phù hợp loại nhân sự", 0, 20, "5–15"],
  ["costEfficiency", "Tối ưu chi phí", 0, 15, "3–10"],
  ["reliability", "Độ tin cậy", 0, 15, "3–10"],
  ["fatiguePenalty", "Phạt quá tải", 0, 35, "15–25"],
  ["overtimePenalty", "Phạt tăng ca", 0, 30, "10–20"],
  ["ruleRiskPenalty", "Phạt rủi ro rule", 0, 40, "20–35"],
].map(([key, label, min, max, recommended]) => ({
  key,
  label,
  min,
  max,
  recommended,
  penalty: key.endsWith("Penalty"),
}));

const SCORING_PRESETS = {
  balanced: {
    label: "Cân bằng",
    description: "Mặc định cho hầu hết nhà hàng.",
    values: DEFAULT_SCORING_WEIGHTS,
  },
  complianceFirst: {
    label: "Ưu tiên tuân thủ",
    description: "Tăng trọng số khả dụng, nghỉ và giới hạn giờ.",
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
    description: "Ưu tiên người mạnh cho ca cao điểm.",
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
    description: "Giảm nguy cơ tăng ca và chi phí nhân sự.",
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

const stripTypenameDeep = (value) => {
  if (Array.isArray(value)) return value.map(stripTypenameDeep);
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (key !== "__typename") acc[key] = stripTypenameDeep(item);
      return acc;
    }, {});
  }
  return value;
};

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
};

const normalizeScoringWeights = (weights = {}) =>
  SCORING_FIELDS.reduce((result, field) => {
    result[field.key] = Math.round(
      clampNumber(
        weights?.[field.key],
        field.min,
        field.max,
        DEFAULT_SCORING_WEIGHTS[field.key],
      ),
    );
    return result;
  }, {});

const toPolicyTemplates = (rules = []) =>
  rules.map((rule) => ({
    key: String(rule.type || "").toLowerCase(),
    label: rule.label || rule.type,
    startTime: rule.startTime,
    endTime: rule.endTime,
    enabled: true,
    allowCrossDay:
      toShiftMinutes(rule.endTime) < toShiftMinutes(rule.startTime),
  }));

const normalizeLaborRules = (laborRules = {}) => ({
  ...DEFAULT_LABOR_RULES,
  ...stripTypenameDeep(laborRules || {}),
});

const validateLaborRules = (rules) => {
  const errors = [];
  const weeklyCap = Number(rules.weeklyHoursCap);
  const recommendedCap = Number(rules.recommendedWeeklyHoursCap);
  const maxShifts = Number(rules.maxShiftsPerDay);
  const restHours = Number(rules.minRestHoursBetweenShifts);
  const warningDays = Number(rules.maxConsecutiveWorkingDays);
  const hardDays = Number(rules.hardMaxConsecutiveWorkingDays);

  if (!Number.isFinite(weeklyCap) || weeklyCap <= 0 || weeklyCap > 168) {
    errors.push("Giới hạn giờ làm tuần phải từ 1 đến 168 giờ.");
  }
  if (
    !Number.isFinite(recommendedCap) ||
    recommendedCap < 0 ||
    recommendedCap > weeklyCap
  ) {
    errors.push("Giờ khuyến nghị phải từ 0 đến giới hạn giờ tuần.");
  }
  if (!Number.isInteger(maxShifts) || maxShifts < 1 || maxShifts > 6) {
    errors.push("Số ca tối đa mỗi ngày phải là số nguyên từ 1 đến 6.");
  }
  if (!Number.isFinite(restHours) || restHours < 0 || restHours > 24) {
    errors.push("Giờ nghỉ giữa hai ca phải từ 0 đến 24 giờ.");
  }
  if (
    !Number.isInteger(warningDays) ||
    warningDays < 1 ||
    warningDays > 31 ||
    !Number.isInteger(hardDays) ||
    hardDays < warningDays ||
    hardDays > 31
  ) {
    errors.push(
      "Ngày chặn cứng phải lớn hơn hoặc bằng ngày cảnh báo và không quá 31.",
    );
  }

  return { ok: errors.length === 0, errors };
};

const ShiftRulesModalCore = ({
  isOpen,
  onClose,
  rules = [],
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

    if (policyLoading || initializedOpenRef.current) return;

    const policyRules = shiftTemplatesToRules(policy?.shiftTemplates || []);
    setDraftRules(policyRules.length ? policyRules : rules);
    setDraftLaborRules(normalizeLaborRules(policy?.laborRules));
    setDraftScoringWeights(
      normalizeScoringWeights({
        ...DEFAULT_SCORING_WEIGHTS,
        ...(policy?.scoringWeights || {}),
      }),
    );
    setDraftMandatoryRoles(
      normalizeMandatoryRoles(
        policy?.mandatoryShiftRoles || mandatoryShiftRoles,
      ),
    );
    setActiveTab("shifts");
    initializedOpenRef.current = true;
  }, [isOpen, mandatoryShiftRoles, policy, policyLoading, rules]);

  const shiftValidation = useMemo(
    () => validateShiftRules(draftRules),
    [draftRules],
  );
  const laborValidation = useMemo(
    () => validateLaborRules(draftLaborRules),
    [draftLaborRules],
  );
  const allErrors = [...shiftValidation.errors, ...laborValidation.errors];
  const canSave =
    !policyLoading &&
    !policySaving &&
    shiftValidation.ok &&
    laborValidation.ok;

  const updateLaborRule = (field, value) => {
    setDraftLaborRules((current) => ({ ...current, [field]: value }));
  };

  const handleChangeTime = (type, field, value) => {
    setDraftRules((current) =>
      current.map((rule) =>
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

  const toggleMandatoryRole = (role) => {
    const normalized = normalizeRole(role);
    setDraftMandatoryRoles((current) =>
      current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [...current, normalized],
    );
  };

  const handleSubmit = async () => {
    if (!canSave) return;

    const laborRules = {
      ...stripTypenameDeep(draftLaborRules),
      weeklyHoursCap: Number(draftLaborRules.weeklyHoursCap),
      recommendedWeeklyHoursCap: Number(
        draftLaborRules.recommendedWeeklyHoursCap,
      ),
      maxShiftsPerDay: Number(draftLaborRules.maxShiftsPerDay),
      minRestHoursBetweenShifts: Number(
        draftLaborRules.minRestHoursBetweenShifts,
      ),
      maxConsecutiveWorkingDays: Number(
        draftLaborRules.maxConsecutiveWorkingDays,
      ),
      hardMaxConsecutiveWorkingDays: Number(
        draftLaborRules.hardMaxConsecutiveWorkingDays,
      ),
    };

    await onApply(draftRules, {
      shiftTemplates: toPolicyTemplates(draftRules),
      laborRules,
      scoringWeights: normalizeScoringWeights(draftScoringWeights),
      mandatoryShiftRoles: preserveMandatoryShiftRolesOnSave(
        draftMandatoryRoles,
        policy,
      ),
    });
  };

  const renderRuleLevel = (field) => (
    <select
      value={draftLaborRules[field]}
      onChange={(event) => updateLaborRule(field, event.target.value)}
    >
      {RULE_LEVEL_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="shift-rules-modal"
    >
      <Modal.Header>Cài đặt lịch làm việc</Modal.Header>

      <Modal.Body>
        {policyLoading ? (
          <div className="policy-loading">
            Đang tải cấu hình của nhà hàng. Chưa thể chỉnh hoặc lưu...
          </div>
        ) : null}

        <fieldset
          disabled={policyLoading || policySaving}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
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
                      Giờ kết thúc nhỏ hơn giờ bắt đầu được hiểu là ca kết thúc
                      vào ngày hôm sau.
                    </span>
                  </div>
                </div>
                <div className="smart-count-actions">
                  <button
                    type="button"
                    onClick={() => setDraftRules(buildSmartShiftRules(2))}
                  >
                    Mẫu 2 ca
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftRules(buildSmartShiftRules(3))}
                  >
                    Mẫu 3 ca
                  </button>
                </div>
              </div>

              <div className="shift-rule-list">
                {draftRules.map((rule) => {
                  const isCrossDay =
                    toShiftMinutes(rule.endTime) <
                    toShiftMinutes(rule.startTime);
                  return (
                    <div className="shift-rule-row" key={rule.type}>
                      <div className="rule-name">
                        <span className="rule-icon">{rule.icon}</span>
                        <div>
                          <strong>{rule.label}</strong>
                          <span>
                            {rule.type}
                            {isCrossDay ? " · qua ngày" : ""}
                          </span>
                        </div>
                      </div>

                      <label>
                        Bắt đầu
                        <input
                          aria-label={`${rule.label} bắt đầu`}
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
                          aria-label={`${rule.label} kết thúc`}
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
                  );
                })}
              </div>

              <div className="shift-rule-actions">
                <button
                  type="button"
                  onClick={() =>
                    setDraftRules((current) =>
                      resizeShiftRules(current, current.length + 1),
                    )
                  }
                  disabled={draftRules.length >= 3}
                >
                  <Plus size={16} />
                  Thêm ca
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraftRules((current) =>
                      resizeShiftRules(current, current.length - 1),
                    )
                  }
                  disabled={draftRules.length <= 2}
                >
                  <Trash2 size={16} />
                  Bớt ca
                </button>
              </div>

              <div className="mandatory-roles-box">
                <div className="mandatory-roles-header">
                  <strong>Role bắt buộc trong mọi ca</strong>
                  <span>
                    Dùng để cảnh báo thành phần nhân sự; không tự thêm người vào
                    ca.
                  </span>
                </div>
                <div className="mandatory-role-options">
                  {MANDATORY_ROLE_OPTIONS.map((option) => {
                    const checked = draftMandatoryRoles.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`mandatory-role-chip ${
                          checked ? "active" : ""
                        }`}
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
                  <strong>Backend là nguồn kiểm tra cuối cùng</strong>
                  <span>
                    Các giới hạn dưới đây được kiểm tra lại khi tạo hoặc sửa ca.
                  </span>
                </div>
              </div>

              <div className="rules-grid">
                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Ngày làm cố định</strong>
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
                  {renderRuleLevel("workingDaysRuleLevel")}
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
                  {renderRuleLevel("leaveConflictRuleLevel")}
                </div>

                <div className="rule-card">
                  <div className="rule-card-header">
                    <strong>Chặn ca chồng giờ</strong>
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
                </div>

                <div className="rule-card">
                  <strong>Giờ làm mỗi tuần</strong>
                  <div className="inline-fields">
                    <label>
                      Khuyến nghị
                      <input
                        type="number"
                        min="0"
                        max="168"
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
                        min="1"
                        max="168"
                        value={draftLaborRules.weeklyHoursCap}
                        onChange={(event) =>
                          updateLaborRule(
                            "weeklyHoursCap",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  {renderRuleLevel("weeklyHoursRuleLevel")}
                </div>

                <div className="rule-card">
                  <strong>Số ca tối đa mỗi ngày</strong>
                  <div className="inline-fields single">
                    <label>
                      Số ca
                      <input
                        type="number"
                        min="1"
                        max="6"
                        step="1"
                        value={draftLaborRules.maxShiftsPerDay}
                        onChange={(event) =>
                          updateLaborRule(
                            "maxShiftsPerDay",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  {renderRuleLevel("maxShiftsPerDayRuleLevel")}
                </div>

                <div className="rule-card">
                  <strong>Giờ nghỉ giữa hai ca</strong>
                  <div className="inline-fields single">
                    <label>
                      Số giờ
                      <input
                        type="number"
                        min="0"
                        max="24"
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
                  {renderRuleLevel("minRestRuleLevel")}
                </div>

                <div className="rule-card">
                  <strong>Ngày làm liên tục</strong>
                  <div className="inline-fields">
                    <label>
                      Cảnh báo từ
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
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
                        max="31"
                        step="1"
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
                  {renderRuleLevel("consecutiveDaysRuleLevel")}
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
                      disabled={!draftLaborRules.allowManagerOverride}
                      onChange={(event) =>
                        updateLaborRule(
                          "overrideRequiresReason",
                          event.target.checked,
                        )
                      }
                    />
                    Bắt buộc nhập lý do
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
                  <strong>Trọng số dùng để xếp hạng gợi ý</strong>
                  <span>
                    Không phải điểm đánh giá nhân viên và không cần cộng bằng
                    100.
                  </span>
                </div>
                <button
                  type="button"
                  className="scoring-guide-trigger"
                  onClick={() => setIsScoringGuideOpen(true)}
                >
                  Cách tính điểm
                </button>
              </div>

              <div className="scoring-presets">
                {Object.entries(SCORING_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setDraftScoringWeights(
                        normalizeScoringWeights(preset.values),
                      )
                    }
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>

              <div className="scoring-total-box">
                <div>
                  <strong>
                    Tổng trọng số hiện tại:{" "}
                    {Object.values(draftScoringWeights).reduce(
                      (sum, value) => sum + Number(value || 0),
                      0,
                    )}
                  </strong>
                  <span>Hệ thống sẽ chuẩn hóa khi tính điểm gợi ý.</span>
                </div>
              </div>

              <div className="scoring-grid enhanced">
                {SCORING_FIELDS.map((field) => {
                  const value = Number(draftScoringWeights[field.key] || 0);
                  return (
                    <div
                      className={`score-card ${
                        field.penalty ? "penalty" : "positive"
                      }`}
                      key={field.key}
                    >
                      <div className="score-card-header">
                        <strong>{field.label}</strong>
                        <div className="score-value">{value}</div>
                      </div>
                      <div className="score-range-row">
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          value={value}
                          onChange={(event) =>
                            setDraftScoringWeights((current) => ({
                              ...current,
                              [field.key]: Math.round(
                                clampNumber(
                                  event.target.value,
                                  field.min,
                                  field.max,
                                  DEFAULT_SCORING_WEIGHTS[field.key],
                                ),
                              ),
                            }))
                          }
                        />
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={value}
                          onChange={(event) =>
                            setDraftScoringWeights((current) => ({
                              ...current,
                              [field.key]: Math.round(
                                clampNumber(
                                  event.target.value,
                                  field.min,
                                  field.max,
                                  DEFAULT_SCORING_WEIGHTS[field.key],
                                ),
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="score-meta-row">
                        <span>Khuyến nghị: {field.recommended}</span>
                        <span>
                          Giới hạn: {field.min}–{field.max}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </fieldset>

        {allErrors.length ? (
          <div className="shift-rule-errors">
            {allErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
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
          disabled={!canSave}
        >
          {policyLoading
            ? "Đang tải..."
            : policySaving
              ? "Đang lưu..."
              : "Lưu cài đặt"}
        </button>
      </Modal.Footer>

      <ScoringGuideModal
        isOpen={isOpen && isScoringGuideOpen}
        onClose={() => setIsScoringGuideOpen(false)}
        weights={draftScoringWeights}
      />
    </Modal>
  );
};

export default ShiftRulesModalCore;
