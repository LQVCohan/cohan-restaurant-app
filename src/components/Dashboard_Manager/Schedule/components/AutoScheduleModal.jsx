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
}) => {
  const selectedShiftCount = Object.values(selectedShiftKeys || {}).filter(Boolean).length;
  const hasPreview = Boolean(preview);
  const overrideRequired = Boolean(preview?.requiresOverride);
  const reasonLength = overrideReason.trim().length;
  const canApply = Boolean(
    hasPreview &&
      selectedShiftCount > 0 &&
      !applying &&
      (!overrideRequired || (overrideConfirmed && reasonLength >= 10)),
  );

  const renderAssistantSummary = () => {
    if (!assistantMeta && !assistantSummary && !aiPlannerPayload) return null;
    return (
      <section className="auto-schedule-modal__assistant" aria-label="Nguồn gợi ý AI">
        <div className="auto-schedule-modal__assistant-title">
          <Sparkles size={16} />
          <span>Gợi ý xếp lịch</span>
        </div>
        {assistantSummary ? <p>{assistantSummary}</p> : null}
        {assistantMeta ? (
          <dl>
            <div>
              <dt>Nguồn</dt>
              <dd>{assistantMeta.provider || autoScheduleSource}</dd>
            </div>
            <div>
              <dt>Mô hình</dt>
              <dd>{assistantMeta.model || "planner nội bộ"}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    );
  };

  const renderRoleNeeds = () => {
    const roleNeeds = preview?.roleNeeds || [];
    if (!roleNeeds.length) return null;

    return (
      <section className="auto-schedule-modal__role-needs" aria-label="Nhu cầu vai trò">
        <h3><Users size={16} /> Nhu cầu vai trò</h3>
        <div className="auto-schedule-modal__role-grid">
          {roleNeeds.map((item) => {
            const formatted = formatRoleNeed(item);
            return (
              <article key={item.role}>
                <strong>{formatted.role}</strong>
                <span>{formatted.assigned}/{formatted.required} đã gán</span>
                <small>{formatted.missing > 0 ? `Thiếu ${formatted.missing}` : "Đủ nhân sự"}</small>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  const renderIssues = () => {
    const issues = preview?.issues || [];
    if (!issues.length) return null;
    return (
      <section className="auto-schedule-modal__issues" aria-label="Cảnh báo xếp lịch">
        <h3><AlertTriangle size={16} /> Cảnh báo</h3>
        {issues.map((issue, index) => (
          <article key={`${getIssueMessage(issue)}-${index}`}>
            <strong>{severityLabel(issue?.severity)}</strong>
            <span>{getIssueMessage(issue)}</span>
            {getSuggestedAction(issue) ? <small>{getSuggestedAction(issue)}</small> : null}
          </article>
        ))}
      </section>
    );
  };

  const renderAssignments = () => {
    const assignments = preview?.assignments || [];
    if (!assignments.length) return null;
    return (
      <section className="auto-schedule-modal__assignments" aria-label="Danh sách phân ca đề xuất">
        <h3><CalendarRange size={16} /> Phân ca đề xuất</h3>
        <div className="auto-schedule-modal__assignment-list">
          {assignments.map((assignment) => {
            const key = assignment.shiftKey || assignment.id;
            const selected = selectedShiftKeys?.[key] !== false;
            return (
              <label key={key} className="auto-schedule-modal__assignment">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleShift?.(key)}
                />
                <div>
                  <strong>{assignment.shiftName || SHIFT_LABELS[assignment.shiftType] || "Ca làm"}</strong>
                  <span>{getCandidateDisplayName(assignment)}</span>
                  <small>
                    {assignment.role ? getRoleLabel(assignment.role) : "Vai trò chưa rõ"}
                    {assignment.score != null ? ` · ${compactNumber(assignment.score)} điểm` : ""}
                  </small>
                </div>
                <CandidateScoreBreakdown candidate={assignment.candidate || assignment} compact />
              </label>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gợi ý xếp lịch tự động"
      size="lg"
    >
      <div className="auto-schedule-modal">
        <header className="auto-schedule-modal__header">
          <div>
            <p>AI hỗ trợ phân ca</p>
            <h2>Tạo lịch dựa trên nhu cầu, khả dụng và ràng buộc ca</h2>
          </div>
          <Settings size={22} aria-hidden="true" />
        </header>

        <section className="auto-schedule-modal__config" aria-label="Cấu hình tạo lịch">
          <label>
            <span>Khoảng ngày</span>
            <input
              type="date"
              value={config?.date || ""}
              onChange={(event) => onConfigChange?.({ ...config, date: event.target.value })}
            />
          </label>
          <label>
            <span>Ca ưu tiên</span>
            <select
              value={config?.shiftType || "morning"}
              onChange={(event) => onConfigChange?.({ ...config, shiftType: event.target.value })}
            >
              {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Vai trò cần phủ</span>
            <select
              value={config?.role || ""}
              onChange={(event) => onConfigChange?.({ ...config, role: event.target.value })}
            >
              <option value="">Tất cả vai trò</option>
              {requiredRoleOptions.map((role) => (
                <option key={role.value || role} value={role.value || role}>
                  {role.label || getRoleLabel(role.value || role)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onGenerate} disabled={generating}>
            {generating ? "Đang tạo..." : "Tạo gợi ý"}
          </button>
        </section>

        {generateError ? (
          <div className="auto-schedule-modal__error" role="alert">
            <AlertTriangle size={16} /> {generateError}
          </div>
        ) : null}

        {renderAssistantSummary()}

        {preview ? (
          <section className="auto-schedule-modal__preview" aria-label="Kết quả gợi ý">
            <div className="auto-schedule-modal__summary">
              <article>
                <CheckCircle2 size={18} />
                <span>{statusLabel(preview.coverageStatus)}</span>
                <strong>{compactNumber(preview.coveragePercent || 0)}%</strong>
              </article>
              <article>
                <Clock3 size={18} />
                <span>Ca được chọn</span>
                <strong>{selectedShiftCount}</strong>
              </article>
            </div>
            {renderRoleNeeds()}
            {renderIssues()}
            {renderAssignments()}
          </section>
        ) : (
          <div className="auto-schedule-modal__empty">
            <Info size={18} />
            <span>Chưa có gợi ý. Hãy tạo lịch để xem đề xuất.</span>
          </div>
        )}

        {overrideRequired ? (
          <section className="auto-schedule-modal__override" aria-label="Lý do ghi đè">
            <label>
              <span>Lý do ghi đè cảnh báo</span>
              <textarea
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange?.(event.target.value)}
                placeholder="Nhập lý do tối thiểu 10 ký tự"
              />
            </label>
            <label className="auto-schedule-modal__confirm">
              <input
                type="checkbox"
                checked={overrideConfirmed}
                onChange={(event) => onOverrideConfirmedChange?.(event.target.checked)}
              />
              <span>Tôi xác nhận vẫn áp dụng lịch này</span>
            </label>
            {overrideError ? <p role="alert">{overrideError}</p> : null}
          </section>
        ) : null}

        <footer className="auto-schedule-modal__footer">
          <button type="button" onClick={onClose}>Đóng</button>
          <button type="button" onClick={onApply} disabled={!canApply}>
            {applying ? "Đang áp dụng..." : "Áp dụng lịch"}
          </button>
        </footer>
      </div>
    </Modal>
  );
};

export default AutoScheduleModal;
