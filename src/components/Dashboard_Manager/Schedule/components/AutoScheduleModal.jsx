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

const SHIFT_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  full_day: "Cả ngày",
  rotating: "Luân phiên",
};

const compactNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value || 0));

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

const AutoScheduleModal = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
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
  const selectedCount = previewItems.filter((item) => selectedShiftKeys[item.shiftKey]).length;
  const applicableCount = previewItems.filter((item) => item.canApply).length;

  return (
    <Modal isOpen={isOpen} onClose={!generating && !applying ? onClose : undefined} size="xl">
      <Modal.Header>Chia ca tự động</Modal.Header>

      <Modal.Body className="auto-schedule-body">
        <div className="auto-banner">
          <div className="banner-icon">
            <Sparkles size={20} />
          </div>
          <div className="banner-copy">
            <strong>Scheduling assistant dùng dữ liệu thật từ backend</strong>
            <p>
              Hệ thống phân tích forecast, staff, lịch hiện có rồi tạo preview trước khi áp dụng.
              Luồng này chỉ bổ sung ca còn thiếu, không tự xóa lịch đang có.
            </p>
          </div>
        </div>

        <div className="auto-config-grid">
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
              Backend assistant hiện hỗ trợ phân tích từ hôm nay tới tối đa 7 ngày tiếp theo.
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

          <div className="config-card">
            <div className="config-head">
              <Settings2 size={16} />
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
        </div>

        <div className="auto-actions-strip">
          <button
            type="button"
            className="btn-primary"
            onClick={onGenerate}
            disabled={generating || applying}
          >
            <Sparkles size={16} />
            {generating ? "Đang phân tích..." : "Phân tích & tạo preview"}
          </button>
          {assistantMeta ? (
            <div className="assistant-meta">
              <span className={`meta-pill ${assistantMeta.fallbackUsed ? "fallback" : "forecast"}`}>
                {assistantMeta.fallbackUsed ? "Fallback demand" : "Forecast demand"}
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
            <span>Đang gọi scheduling assistant và kiểm tra xung đột lịch thật...</span>
          </div>
        ) : null}

        {!generating && assistantSummary ? (
          <div className="summary-grid">
            <div className="summary-card">
              <span className="label">Nhóm ca phân tích</span>
              <strong>{compactNumber(assistantSummary.totalShiftGroups)}</strong>
            </div>
            <div className="summary-card warning">
              <span className="label">Ca thiếu người</span>
              <strong>{compactNumber(assistantSummary.underStaffedShifts)}</strong>
            </div>
            <div className="summary-card success">
              <span className="label">Phân công tạo được</span>
              <strong>{compactNumber(preview?.summary?.recommendedAssignments)}</strong>
            </div>
            <div className="summary-card muted">
              <span className="label">Bị chặn bởi guard</span>
              <strong>{compactNumber(preview?.summary?.blockedAssignments)}</strong>
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
                  Chọn các ca muốn áp dụng. Chỉ những ca có nhân sự hợp lệ sau khi qua guard mới được
                  bật chọn.
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
              <div key={item.shiftKey} className={`preview-item ${item.canApply ? "" : "blocked"}`}>
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
                        <strong>{SHIFT_LABELS[item.shiftType] || item.shiftType}</strong>
                        <span>
                          {item.date} • {statusLabel(item.status)} • độ tin cậy {compactNumber(item.confidence * 100)}
                          %
                        </span>
                      </div>
                      <div className={`severity-pill ${item.severity || "low"}`}>
                        {severityLabel(item.severity)}
                      </div>
                    </div>

                    <div className="preview-meta-row">
                      <span>Thiếu {compactNumber(item.missingHeadcount)} người</span>
                      <span>Hiện có {compactNumber(item.currentAssignedStaff)}</span>
                      <span>Đề xuất tổng {compactNumber(item.recommendedTotalStaff)}</span>
                    </div>

                    <div className="preview-role-list">
                      {(item.recommendedRoles || [])
                        .filter((role) => Number(role.delta || 0) < 0)
                        .map((role) => (
                          <span key={`${item.shiftKey}-${role.role}`} className="role-pill">
                            {role.role} x{Math.abs(Number(role.delta || 0))}
                          </span>
                        ))}
                    </div>

                    <div className="assignment-block">
                      <h5>Nhân sự dự kiến áp dụng</h5>
                      {(item.plannedAssignments || []).length ? (
                        <ul>
                          {item.plannedAssignments.map((assignment) => (
                            <li key={`${item.shiftKey}-${assignment.staffId}`}>
                              <CheckCircle2 size={14} />
                              <div>
                                <strong>
                                  {assignment.fullName} • {assignment.role}
                                </strong>
                                <span>
                                  {assignment.reason}. Giờ tuần sau áp dụng:{" "}
                                  {compactNumber(assignment.projectedWeekHours)}h
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="note-line">Không còn ứng viên hợp lệ sau bước kiểm tra xung đột.</div>
                      )}
                    </div>

                    {(item.blockedCandidates || []).length ? (
                      <div className="assignment-block warning">
                        <h5>Ứng viên bị chặn</h5>
                        <ul>
                          {item.blockedCandidates.slice(0, 4).map((candidate) => (
                            <li key={`${item.shiftKey}-${candidate.staffId}`}>
                              <AlertTriangle size={14} />
                              <div>
                                <strong>
                                  {candidate.fullName} • {candidate.role}
                                </strong>
                                <span>{candidate.reason}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.unresolvedCount > 0 ? (
                      <div className="note-line danger">
                        Vẫn còn thiếu {item.unresolvedCount} người sau khi áp dụng các gợi ý hợp lệ.
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
        <button type="button" className="btn-secondary" onClick={onClose} disabled={generating || applying}>
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
