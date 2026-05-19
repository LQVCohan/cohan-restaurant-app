import React from "react";
import Modal from "../../../common/Modal";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Info,
  Settings2,
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
  preview = null,
  selectedShiftKeys = {},
  onToggleShift,
  onApply,
  applying = false,
}) => {
  const previewItems = preview?.items || [];
  const selectedCount = previewItems.filter(
    (item) => selectedShiftKeys[item.shiftKey],
  ).length;
  const applicableCount = previewItems.filter((item) => item.canApply).length;
  const selectedRequiredRoles = Array.isArray(config.requiredRoles)
    ? config.requiredRoles
    : [];

  const toggleRequiredRole = (role) => {
    const nextRoles = selectedRequiredRoles.includes(role)
      ? selectedRequiredRoles.filter((item) => item !== role)
      : [...selectedRequiredRoles, role];

    onConfigChange({
      ...config,
      requiredRoles: nextRoles,
    });
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={!generating && !applying ? onClose : undefined}
      size="xl"
    >
      <Modal.Header>Chia ca tự động</Modal.Header>

      <Modal.Body className="auto-schedule-body">
        <div className="auto-banner">
          <div className="banner-icon">
            <Sparkles size={20} />
          </div>
          <div className="banner-copy">
            <strong>Trợ lý chia ca tự động</strong>
            <p>
              Hệ thống phân tích nhu cầu vận hành, nhân sự, lịch hiện có và
              policy để tạo preview trước khi áp dụng.
            </p>
            <p>
              Chỉ các phân công hợp lệ mới được lưu. Ca còn thiếu người sẽ được
              đánh dấu để quản lý bổ sung thủ công.
            </p>
          </div>
        </div>

        <div className="auto-config-grid auto-config-grid--workflow">
          <div className="auto-config-left">
            <div className="config-card">
              <div className="config-head">
                <CalendarRange size={16} />
                <span>Phạm vi assistant</span>
              </div>
              <label>
                <span>Số ngày tới</span>
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
                Backend assistant hiện hỗ trợ phân tích từ hôm nay tới tối đa 7
                ngày tiếp theo.
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

          <div className="config-card auto-config-constraints">
            <div className="config-head">
              <Settings2 size={16} />
              <span>Ràng buộc áp dụng</span>
            </div>
            <div className="config-card role-required-card">
              <div className="config-head">
                <Users size={16} />
                <span>Role bắt buộc áp dụng cho lần chia ca này</span>
              </div>

              <div className="required-role-grid">
                {requiredRoleOptions.map((option) => (
                  <label key={option.role} className="role-check-row">
                    <input
                      type="checkbox"
                      checked={selectedRequiredRoles.includes(option.role)}
                      onChange={() => toggleRequiredRole(option.role)}
                      disabled={generating || applying}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

              {!selectedRequiredRoles.length ? (
                <p className="required-role-warning">
                  Cần có ít nhất một role bắt buộc. Hãy chọn role hoặc cập nhật
                  cài đặt chung.
                </p>
              ) : (
                <p className="config-hint">
                  Mặc định lấy từ cài đặt chung của nhà hàng. Bạn có thể điều
                  chỉnh tạm cho lần preview này.
                </p>
              )}
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
        </div>

        <div className="auto-actions-strip">
          <button
            type="button"
            className="btn-primary"
            onClick={onGenerate}
            disabled={generating || applying || !selectedRequiredRoles.length}
          >
            <Sparkles size={16} />
            {generating ? "Đang phân tích..." : "Phân tích & tạo preview"}
          </button>
          {assistantMeta ? (
            <div className="assistant-meta">
              <span
                className={`meta-pill ${assistantMeta.fallbackUsed ? "fallback" : "forecast"}`}
              >
                {assistantMeta.fallbackUsed
                  ? "Fallback demand"
                  : "Forecast demand"}
              </span>
              <span>TZ: {assistantMeta.timezone}</span>
            </div>
          ) : null}
        </div>

        {generateError ? (
          <div className="auto-state error">
            <AlertTriangle size={18} />
            <span>{generateError}</span>
          </div>
        ) : null}

        {!generateError && generating ? (
          <div className="auto-state loading">
            <Sparkles size={18} />
            <span>
              Đang gọi scheduling assistant và kiểm tra xung đột lịch thật...
            </span>
          </div>
        ) : null}

        {!generating && assistantSummary ? (
          <div className="summary-grid">
            <div className="summary-card">
              <span className="label">Nhóm ca phân tích</span>
              <strong>
                {compactNumber(assistantSummary.totalShiftGroups)}
              </strong>
            </div>
            <div className="summary-card warning">
              <span className="label">Ca thiếu người</span>
              <strong>
                {compactNumber(assistantSummary.underStaffedShifts)}
              </strong>
            </div>
            <div className="summary-card success">
              <span className="label">Phân công tạo được</span>
              <strong>
                {compactNumber(preview?.summary?.recommendedAssignments)}
              </strong>
            </div>
            <div className="summary-card muted">
              <span className="label">Bị chặn bởi guard</span>
              <strong>
                {compactNumber(preview?.summary?.blockedAssignments)}
              </strong>
            </div>
          </div>
        ) : null}

        {!generating && preview && !previewItems.length ? (
          <div className="auto-state empty">
            <Info size={18} />
            <span>Assistant chưa có gợi ý nào trong phạm vi hiện tại.</span>
          </div>
        ) : null}

        {!generating && previewItems.length ? (
          <div className="preview-list">
            <div className="preview-head">
              <div>
                <h4>Preview phân ca</h4>
                <p>
                  Chọn các ca muốn áp dụng. Hệ thống sẽ lưu các phân công hợp lệ
                  và cảnh báo riêng những vai trò còn thiếu người phù hợp.
                </p>
                <p>
                  Ca còn thiếu người vẫn có thể áp dụng nếu hệ thống đã tìm được
                  ít nhất một phân công hợp lệ. Các vai trò còn thiếu sẽ được
                  ghi chú để manager bổ sung sau.
                </p>
              </div>
              <div className="preview-stats">
                <span>
                  <Users size={14} />
                  {selectedCount}/{applicableCount} ca sẵn sàng áp dụng
                </span>
              </div>
            </div>

            {previewItems.map((item) => (
              <div
                key={item.shiftKey}
                className={`preview-item ${item.canApply ? "" : "blocked"}`}
              >
                <label className="preview-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedShiftKeys[item.shiftKey])}
                    onChange={() => onToggleShift(item.shiftKey)}
                    disabled={!item.canApply || applying}
                  />
                  <div className="preview-main">
                    <div className="preview-title-row">
                      <div>
                        <strong>
                          {SHIFT_LABELS[item.shiftType] || item.shiftType}
                        </strong>
                        <span>
                          {item.date} • {statusLabel(item.status)} • độ tin cậy{" "}
                          {compactNumber(item.confidence * 100)}%
                        </span>
                      </div>
                      <div
                        className={`severity-pill ${item.severity || "low"}`}
                      >
                        {severityLabel(item.severity)}
                      </div>
                    </div>

                    <div className="preview-meta-row">
                      <span>
                        Thiếu {compactNumber(item.missingHeadcount)} người
                      </span>
                      <span>
                        Hiện có {compactNumber(item.currentAssignedStaff)}
                      </span>
                      <span>
                        Đề xuất tổng {compactNumber(item.recommendedTotalStaff)}
                      </span>
                    </div>

                    <div className="preview-role-list">
                      {(item.recommendedRoles || [])
                        .filter((role) => Number(role.delta || 0) < 0)
                        .map((role) => (
                          <span
                            key={`${item.shiftKey}-${role.role}`}
                            className="role-pill"
                          >
                            {getRoleLabel(role.role)} x
                            {Math.abs(Number(role.delta || 0))}
                          </span>
                        ))}
                    </div>
                    {(item.unfilledRoles || []).length ? (
                      <div className="unfilled-role-panel">
                        <h5>Ca này đang thiếu gì?</h5>

                        {(item.unfilledRoles || []).map((roleRow) => {
                          const roleNeed = formatRoleNeed(roleRow);

                          return (
                            <div
                              key={`${item.shiftKey}-${roleRow.role}-unfilled`}
                              className="unfilled-role-card"
                            >
                              <div className="unfilled-role-head">
                                <strong>{roleNeed.role}</strong>
                                <span>
                                  Cần {roleNeed.required}, hiện có{" "}
                                  {roleNeed.assigned}, hệ thống tìm được{" "}
                                  {roleNeed.planned}, còn thiếu{" "}
                                  {roleNeed.unresolved}
                                </span>
                              </div>

                              <p>{roleRow.reason}</p>

                              {roleRow.suggestedAction ? (
                                <small>
                                  Gợi ý xử lý: {roleRow.suggestedAction}
                                </small>
                              ) : null}

                              {(roleRow.blockedCandidates || []).length ? (
                                <div className="unfilled-blocked-list">
                                  <strong>Ứng viên đã xét nhưng bị loại</strong>
                                  <ul>
                                    {(roleRow.blockedCandidates || [])
                                      .slice(0, 5)
                                      .map((candidate) => (
                                        <li
                                          key={`${item.shiftKey}-${roleRow.role}-${candidate.staffId}`}
                                        >
                                          <span>
                                            {candidate.fullName} •{" "}
                                            {getRoleLabel(candidate.role)}
                                          </span>
                                          <small>{candidate.reason}</small>
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              ) : (
                                <div className="unfilled-empty-candidates">
                                  Chưa có ứng viên cụ thể nào được assistant đưa
                                  vào danh sách xét cho vai trò này.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="assignment-block">
                      <h5>Nhân sự dự kiến áp dụng</h5>
                      {(item.plannedAssignments || []).length ? (
                        <ul>
                          {item.plannedAssignments.map((assignment) => {
                            const hasValidationIssues =
                              (assignment.validationIssues || []).length > 0;

                            return (
                              <li key={`${item.shiftKey}-${assignment.staffId}`}>
                                <CheckCircle2 size={14} />
                                <div>
                                  <strong>
                                    {assignment.fullName} •{" "}
                                    {getRoleLabel(assignment.role)}
                                  </strong>

                                <div className="assignment-explain-chips">
                                  {assignment.role ? (
                                    <span className="explain-chip info">
                                      Vai trò cần: {getRoleLabel(assignment.role)}
                                    </span>
                                  ) : null}
                                  {assignment.score !== null &&
                                  assignment.score !== undefined ? (
                                    <span className="explain-chip info">
                                      Điểm phù hợp: {compactNumber(assignment.score)}
                                    </span>
                                  ) : null}
                                  {hasValidationIssues ? (
                                    <span className="explain-chip danger">
                                      Cần xử lý
                                    </span>
                                  ) : item.canApply === false ? (
                                    <span className="explain-chip danger">
                                      Không thể áp dụng
                                    </span>
                                  ) : (
                                    <span className="explain-chip success">
                                      Có thể xếp
                                    </span>
                                  )}
                                  {(assignment.warnings || []).length ? (
                                    <span className="explain-chip warning">
                                      Có cảnh báo
                                    </span>
                                  ) : null}
                                  {hasValidationIssues ? (
                                    <span className="explain-chip danger">
                                      Cần kiểm tra availability
                                    </span>
                                  ) : null}
                                </div>

                                {(assignment.warnings || []).length ? (
                                  <div className="assignment-alert-block warning">
                                    <h6>Cảnh báo</h6>
                                    <ul>
                                      {assignment.warnings.map((warning, idx) => (
                                        <li key={`${item.shiftKey}-${assignment.staffId}-warn-${idx}`}>
                                          <span>{getIssueMessage(warning)}</span>
                                          {getSuggestedAction(warning) ? (
                                            <small>
                                              Gợi ý: {getSuggestedAction(warning)}
                                            </small>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {(assignment.validationIssues || []).length ? (
                                  <div className="assignment-alert-block issue">
                                    <h6>Vấn đề cần xử lý</h6>
                                    <ul>
                                      {assignment.validationIssues.map((issue, idx) => (
                                        <li key={`${item.shiftKey}-${assignment.staffId}-issue-${idx}`}>
                                          <span>{getIssueMessage(issue)}</span>
                                          {getSuggestedAction(issue) ? (
                                            <small>
                                              Gợi ý: {getSuggestedAction(issue)}
                                            </small>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                  <CandidateScoreBreakdown
                                    assignment={assignment}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="note-line">
                          Không còn ứng viên hợp lệ sau bước kiểm tra xung đột.
                        </div>
                      )}
                    </div>

                    {(item.blockedCandidates || []).length ? (
                      <details className="assignment-block warning blocked-candidates-section">
                        <summary>Ứng viên bị loại ({item.blockedCandidates.length})</summary>
                        <ul>
                          {item.blockedCandidates.slice(0, 6).map((candidate, idx) => (
                            <li key={`${item.shiftKey}-${candidate.staffId || candidate.employeeId || idx}`}>
                              <AlertTriangle size={14} />
                              <div>
                                <strong>
                                  {getCandidateDisplayName(candidate)}
                                  {candidate.role ? ` • ${getRoleLabel(candidate.role)}` : ""}
                                </strong>
                                <span>{candidate.reason || "Không đạt điều kiện xếp ca"}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}

                    {!item.canApply ? (
                      <div className="note-line danger">
                        Không thể áp dụng vì chưa có nhân sự hợp lệ nào.
                      </div>
                    ) : null}
                    {item.unresolvedCount > 0 && item.canApply ? (
                      <div className="note-line warning">
                        Còn thiếu {item.unresolvedCount} vị trí - có thể bổ sung
                        sau.
                      </div>
                    ) : null}
                    {item.unresolvedCount > 0 ? (
                      <div className="note-line danger">
                        Vẫn còn thiếu {item.unresolvedCount} người sau khi áp
                        dụng các gợi ý hợp lệ. Hệ thống vẫn có thể lưu phần nhân
                        sự đã tìm được và sẽ cảnh báo các vai trò còn thiếu.
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>
            ))}
          </div>
        ) : null}
      </Modal.Body>

      <Modal.Footer className="auto-schedule-footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          disabled={generating || applying}
        >
          Đóng
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onApply}
          disabled={generating || applying || selectedCount === 0}
        >
          {applying ? "Đang áp dụng..." : `Áp dụng ${selectedCount} ca đã chọn`}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AutoScheduleModal;
