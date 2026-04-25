import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import { Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  buildSmartShiftRules,
  validateShiftRules,
} from "../utils/scheduleHelpers";
import "./ShiftRulesModal.scss";

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
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState("shifts");
  const [draftRules, setDraftRules] = useState(rules);
  const [draftLaborRules, setDraftLaborRules] = useState(DEFAULT_LABOR_RULES);
  const [draftScoringWeights, setDraftScoringWeights] = useState(
    DEFAULT_SCORING_WEIGHTS,
  );

  useEffect(() => {
    if (!isOpen) return;

    setDraftRules(rules);

    setDraftLaborRules({
      ...DEFAULT_LABOR_RULES,
      ...(policy?.laborRules || {}),
    });

    setDraftScoringWeights({
      ...DEFAULT_SCORING_WEIGHTS,
      ...(policy?.scoringWeights || {}),
    });

    setActiveTab("shifts");
  }, [isOpen, policy, rules]);

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
      [field]: coerceNumber(value, prev[field]),
    }));
  };

  const handleSubmit = () => {
    if (!validation.ok) return;

    onApply(draftRules, {
      shiftTemplates: shiftRulesToTemplates(draftRules),
      laborRules: {
        ...draftLaborRules,
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
      scoringWeights: draftScoringWeights,
    });
  };

  return (
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
            <div className="policy-banner">
              <SlidersHorizontal size={18} />
              <div>
                <strong>Trọng số ưu tiên 0–100</strong>
                <span>
                  Dùng cho engine gợi ý nhân viên phù hợp. Giai đoạn này lưu
                  policy trước, auto schedule có thể tích hợp sâu ở bước sau.
                </span>
              </div>
            </div>

            <div className="scoring-grid">
              {Object.entries(draftScoringWeights).map(([key, value]) => (
                <label key={key} className="score-field">
                  <span>{key}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(event) =>
                      updateScoringWeight(key, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {policyLoading ? (
          <div className="policy-loading">Đang tải SchedulingPolicy...</div>
        ) : null}
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="btn-secondary" onClick={onClose}>
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
  );
};

export default ShiftRulesModal;
