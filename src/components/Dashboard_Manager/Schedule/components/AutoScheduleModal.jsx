import React from "react";
import Modal from "../../../common/Modal";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Info,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import "./AutoScheduleModal.scss";
import CandidateScoreBreakdown, {
  getRoleLabel,
} from "./CandidateScoreBreakdown";
const SHIFT_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  full_day: "Cả ngày",
  rotating: "Luân phiên",
};

const compactNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    Number(value || 0),
  );

const severityLabel = (severity) => {
  if (severity === "high") return "Cao";
  if (severity === "medium") return "Trung bình";
  return "Thấp";
};

const statusLabel = (status) => {
  if (status === "understaffed") return "Thiếu người";
  if (status === "overstaffed") return "Dư người";
  return "Cân bằng";
};
const formatRoleNeed = (roleRow) => {
  const role = getRoleLabel(roleRow.role);
  const required = Number(roleRow.required || 0);
  const assigned = Number(roleRow.assigned || 0);
  const missing = Number(roleRow.missing || 0);
  const planned = Number(roleRow.planned || 0);
  const unresolved = Number(roleRow.unresolved || 0);

  return {
    role,
    required,
    assigned,
    missing,
    planned,
    unresolved,
  };
};

const getIssueMessage = (issue) => {
  if (!issue) return "";
  if (typeof issue === "string") return issue;
  return issue.message || "";
};

const getSuggestedAction = (issue) => {
  if (!issue || typeof issue === "string") return "";
  return issue.suggestedAction || "";
};

const getCandidateDisplayName = (candidate) => {
  if (candidate?.fullName || candidate?.employeeName) {
    return candidate.fullName || candidate.employeeName;
  }
  const fallbackId = candidate?.staffId || candidate?.employeeId;
  return fallbackId ? `Nhân viên #${fallbackId}` : "Nhân viên chưa rõ";
};
const AutoScheduleModal = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  requiredRoleOptions = [],
  onGenerate,
  generating = false,
  generateError = "",
  assistantMeta = null,
  assistantSummary = null,
  aiPlannerPayload = null,
  autoScheduleSource = "ai",
  preview = null,
  selectedShiftKeys = {},
  onToggleShift,
  onApply,
  applying = false,
  overrideReason = "",
  onOverrideReasonChange,
  overrideConfirmed = false,
  onOverrideConfirmedChange,
  overrideError = "",
  overrideSummary = null,
}) => {
  const previewItems = preview?.items || [];
  const selectedCount = previewItems.filter(
    (item) => selectedShiftKeys[item.shiftKey],
  ).length;
  const applicableCount = previewItems.filter((item) => item.canApply).length;
  const selectedWarningAssignments =
    Number(overrideSummary?.warningAssignments?.length || 0);
  const selectedCleanAssignments = Number(overrideSummary?.cleanAssignments || 0);
  const selectedUnresolvedPositions = Number(
    overrideSummary?.unresolvedPositions || 0,
  );
  const requiresOverride = Boolean(overrideSummary?.requiresOverride);
  const canApplyWithOverride =
    !requiresOverride ||
    (String(overrideReason || "").trim().length >= 5 && overrideConfirmed);
  return (
    <Modal
      isOpen={isOpen}
      onClose={!generating && !applying ? onClose : undefined}
      size="xl"
      className="auto-schedule-modal"
    >
      <Modal.Header>Chia ca tự động</Modal.Header>

      <Modal.Body className="auto-schedule-body">
        <div className="auto-banner">
          <div className="banner-icon">
            <Sparkles size={20} />
          </div>
          <div className="banner-copy">
            <strong>Chia ca tự động có hỗ trợ AI</strong>
            <p>
              Hệ thống phân tích nhu cầu, lịch rảnh, hiệu suất nhân sự và các ràng buộc vận hành để tạo preview chia ca.
            </p>
            <p>
              Manager kiểm tra preview trước khi áp dụng. Hệ thống không tự lưu lịch nếu chưa được xác nhận.
            </p>
          </div>
        </div>

        <div className="auto-config-grid auto-config-grid--workflow">
          <div className="auto-config-left">
            <div className="config-card">
              <div className="config-head">
                <CalendarRange size={16} />
                <span>Phạm vi trợ lý</span>
              </div>
              <label>
                <span>Số ngày phân tích nhu cầu</span>
                <select
                  value={config.horizonDays}
                  onChange={(event) =>
                    onConfigChange({
                      ...config,
                      horizonDays: Number(event.target.value),
                    })
                  }
                  disabled={generating || applying}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <option key={value} value={value}>
                      {value} ngày
                    </option>
                  ))}
                </select>
              </label>
              <p className="config-hint">
                Preview tạo theo ngày/tuần đang xem; số ngày này chỉ dùng để mở rộng dữ liệu dự báo nhu cầu.
              </p>
            </div>

            <div className="config-card">
              <div className="config-head">
                <Clock3 size={16} />
                <span>Giới hạn giờ làm</span>
              </div>
              <label>
                <span>Giờ tối đa mỗi tuần</span>
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={config.weeklyHoursCap}
                  onChange={(event) =>
                    onConfigChange({
                      ...config,
                      weeklyHoursCap: Number(event.target.value || 40),
                    })
                  }
                  disabled={generating || applying}
                />
              </label>
              <p className="config-hint">
                Preview và apply sẽ chặn nhân sự vượt ngưỡng giờ/tuần này.
              </p>
            </div>
          </div>

          <div className="config-card auto-config-constraints">
            <div className="config-head">
              <Settings size={16} />
              <span>Ràng buộc áp dụng</span>
            </div>
            <label className="toggle-row">
              <span>Tôn trọng nghỉ phép / ngày nghỉ</span>
              <input
                type="checkbox"
                checked={config.respectAvailability}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    respectAvailability: event.target.checked,
                  })
                }
                disabled={generating || applying}
              />
            </label>
            <label className="toggle-row">
              <span>Chặn vượt giờ tuần</span>
              <input
                type="checkbox"
                checked={config.avoidOvertime}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    avoidOvertime: event.target.checked,
                  })
                }
                disabled={generating || applying}
              />
            </label>
          </div>

          <div className="config-card auto-workflow-card">
            <div className="config-head">
              <Sparkles size={16} />
              <span>Quy trình áp dụng</span>
            </div>
            <ol>
              <li>
                <strong>1</strong>
                <span>Phân tích nhu cầu và xung đột lịch.</span>
              </li>
              <li>
                <strong>2</strong>
                <span>Manager chọn ca hợp lệ trong preview.</span>
              </li>
              <li>
                <strong>3</strong>
                <span>Lưu phân công và giữ cảnh báo ca còn thiếu.</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="auto-actions-strip">
          <button
            type="button"
            className="btn-primary"
            onClick={onGenerate}
            disabled={generating || applying}
          >
            <Sparkles size={16} />
            {generating ? "Đang tạo preview..." : "Tạo preview chia ca"}
          </button>

          {assistantMeta && (
            <div className="assistant-meta">
              <span
                className={`meta-pill ${
                  autoScheduleSource === "ai" ? "forecast" : "fallback"
                }`}
              >
                {autoScheduleSource === "ai" ? "AI forecast" : "Fallback nội bộ"}
              </span>
              <span>{assistantMeta?.totalCandidates || 0} ứng viên khả dụng</span>
              <span>{assistantMeta?.totalDemandSlots || 0} slot cần phủ</span>
            </div>
          )}
        </div>

        {generating && (
          <div className="auto-state loading">
            <Info size={16} /> Đang phân tích lịch rảnh, nhu cầu ca và ràng buộc vận hành...
          </div>
        )}

        {generateError && (
          <div className="auto-state error">
            <AlertTriangle size={16} /> {generateError}
          </div>
        )}

        {assistantSummary && (
          <div className="ai-planner-summary-wrap">
            <div className="ai-planner-summary">
              <div>
                <strong>{assistantSummary.headline}</strong>
                <p>{assistantSummary.recommendation}</p>
                <small>{assistantSummary.rationale}</small>
              </div>
              <span className="confidence-pill">
                {assistantSummary.confidence}% tin cậy
              </span>
            </div>
            {assistantSummary.risks?.length > 0 && (
              <ul className="risk-warning-list">
                {assistantSummary.risks.map((risk, index) => (
                  <li key={`${risk}-${index}`}>{risk}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {preview && (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <span className="label">Tổng ca phân tích</span>
                <strong>{preview.summary?.totalShifts || 0}</strong>
              </div>
              <div className="summary-card success">
                <span className="label">Có thể áp dụng</span>
                <strong>{applicableCount}</strong>
              </div>
              <div className="summary-card warning">
                <span className="label">Cần chú ý</span>
                <strong>{preview.summary?.warningCount || 0}</strong>
              </div>
              <div className="summary-card muted">
                <span className="label">Đã chọn</span>
                <strong>{selectedCount}</strong>
              </div>
            </div>

            <div className="preview-list">
              <div className="preview-head">
                <div>
                  <h4>Preview chia ca đề xuất</h4>
                  <p>Chọn các ca hợp lệ để áp dụng vào lịch làm việc.</p>
                </div>
                <div className="preview-stats">
                  <span>
                    {selectedCount}/{applicableCount} ca được chọn
                  </span>
                </div>
              </div>

              {previewItems.length === 0 && (
                <div className="auto-state empty">
                  <Info size={16} /> Trợ lý chưa có gợi ý nào trong phạm vi hiện tại.
                </div>
              )}

              {previewItems.map((item) => {
                const shiftLabel = SHIFT_LABELS[item.shiftType] || item.shiftType;
                const roles = (item.roleNeeds || []).map(formatRoleNeed);
                const unfilledRoles = roles.filter((role) => role.missing > 0 || role.unresolved > 0);
                const assignedRows = item.assignments || [];
                const blockedRows = item.blockedCandidates || [];
                const aiExplanation = aiPlannerPayload?.explanations?.[item.shiftKey];
                return (
                  <div
                    key={item.shiftKey}
                    className={`preview-item ${item.canApply ? "" : "blocked"}`}
                  >
                    <label className="preview-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedShiftKeys[item.shiftKey])}
                        onChange={() => onToggleShift?.(item.shiftKey)}
                        disabled={!item.canApply || applying}
                      />
                      <div className="preview-main">
                        <div className="preview-title-row">
                          <div>
                            <strong>
                              {item.shiftName || "Ca làm"} · {shiftLabel}
                            </strong>
                            <span>{new Date(item.date).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <span className={`severity-pill ${item.severity || "low"}`}>
                            {statusLabel(item.status)} · {severityLabel(item.severity)}
                          </span>
                        </div>

                        <div className="preview-meta-row">
                          <span>
                            <Users size={14} /> Cần {item.requiredStaff || 0} · Có {item.assignedStaff || 0}
                          </span>
                          <span>
                            Thiếu {item.missingStaff || 0} vị trí
                          </span>
                          <span>
                            Nhu cầu {compactNumber(item.forecastedDemand)} khách
                          </span>
                        </div>

                        {roles.length > 0 && (
                          <div className="preview-role-list">
                            {roles.map((role) => (
                              <span key={role.role} className="role-pill">
                                {role.role}: {role.assigned}/{role.required}
                                {role.unresolved > 0 ? ` · thiếu ${role.unresolved}` : ""}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="assignment-explain-chips">
                          {(item.explainChips || []).map((chip, idx) => (
                            <span key={`${chip.label}-${idx}`} className={`explain-chip ${chip.tone || "info"}`}>
                              {chip.label}
                            </span>
                          ))}
                        </div>

                        {aiExplanation && (
                          <div className="ai-explanation-box">
                            <p>{aiExplanation.summary}</p>
                            {aiExplanation.factors?.length > 0 && (
                              <div className="ai-factor-list">
                                {aiExplanation.factors.map((factor, idx) => (
                                  <span key={`${factor}-${idx}`} className="ai-factor-chip">
                                    {factor}
                                  </span>
                                ))}
                              </div>
                            )}
                            {aiExplanation.modelVersion && (
                              <small>Model: {aiExplanation.modelVersion}</small>
                            )}
                          </div>
                        )}

                        {unfilledRoles.length > 0 && (
                          <div className="unfilled-role-panel">
                            <h5>Vai trò còn thiếu</h5>
                            {unfilledRoles.map((role) => (
                              <div key={role.role} className="unfilled-role-card">
                                <div className="unfilled-role-head">
                                  <strong>{role.role}</strong>
                                  <span>
                                    Cần {role.required} · Đã xếp {role.assigned} · Còn thiếu {role.missing || role.unresolved}
                                  </span>
                                </div>
                                {item.unfilledRoleReasons?.[role.role] && (
                                  <p>{item.unfilledRoleReasons[role.role]}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {assignedRows.length > 0 && (
                          <div className="assignment-block">
                            <h5>Nhân sự đề xuất</h5>
                            <ul>
                              {assignedRows.map((assignment, idx) => (
                                <li key={`${assignment.staffId || assignment.employeeId}-${idx}`}>
                                  <CheckCircle2 size={15} />
                                  <div>
                                    <strong>{getCandidateDisplayName(assignment)}</strong>
                                    <span>
                                      {getRoleLabel(assignment.role)} · Điểm {assignment.score ?? "--"}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {blockedRows.length > 0 && (
                          <div className="assignment-block warning">
                            <h5>
                              Ứng viên bị chặn
                              <span className="blocked-candidates-count">{blockedRows.length}</span>
                            </h5>
                            <ul>
                              {blockedRows.slice(0, 4).map((candidate, idx) => (
                                <li key={`${candidate.staffId || idx}-blocked`}>
                                  <AlertTriangle size={15} />
                                  <div>
                                    <strong>{getCandidateDisplayName(candidate)}</strong>
                                    <span>{candidate.reason || "Không đạt ràng buộc"}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.issues?.length > 0 && (
                          <div className="assignment-alert-block issue">
                            <h6>Cảnh báo</h6>
                            <ul>
                              {item.issues.map((issue, idx) => (
                                <li key={`${getIssueMessage(issue)}-${idx}`}>
                                  <span>{getIssueMessage(issue)}</span>
                                  {getSuggestedAction(issue) && (
                                    <small>{getSuggestedAction(issue)}</small>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {requiresOverride && (
          <div className="auto-override-panel">
            <h5>Cần xác nhận ghi đè cảnh báo</h5>
            <p>
              Một số ca được chọn vẫn có cảnh báo thiếu người hoặc ứng viên rủi ro. Nhập lý do để tiếp tục áp dụng.
            </p>
            <label className="override-reason-field">
              <span>Lý do ghi đè</span>
              <textarea
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange?.(event.target.value)}
                placeholder="VD: Ca đã được quản lý xác nhận bổ sung nhân sự trực tiếp..."
                disabled={applying}
              />
            </label>
            <label className="override-confirm-row">
              <input
                type="checkbox"
                checked={overrideConfirmed}
                onChange={(event) => onOverrideConfirmedChange?.(event.target.checked)}
                disabled={applying}
              />
              <span>Tôi xác nhận vẫn áp dụng các ca đã chọn dù còn cảnh báo.</span>
            </label>
            {overrideError && <div className="override-error">{overrideError}</div>}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="auto-schedule-footer">
        {preview && (
          <div className="auto-apply-summary">
            <span>{selectedCount} ca đã chọn</span>
            <span>{selectedCleanAssignments} phân công sạch</span>
            {selectedWarningAssignments > 0 && <span>{selectedWarningAssignments} cảnh báo</span>}
            {selectedUnresolvedPositions > 0 && <span>{selectedUnresolvedPositions} vị trí còn thiếu</span>}
          </div>
        )}
        <button type="button" className="btn-secondary" onClick={onClose} disabled={generating || applying}>
          Đóng
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onApply}
          disabled={!selectedCount || applying || generating || !canApplyWithOverride}
        >
          {applying ? "Đang áp dụng..." : `Áp dụng ${selectedCount} ca đã chọn`}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AutoScheduleModal;
