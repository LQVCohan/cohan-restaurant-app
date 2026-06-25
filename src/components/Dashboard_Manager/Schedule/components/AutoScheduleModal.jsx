import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  Info,
  Settings,
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

const ROLE_LABELS = {
  server: "Phục vụ",
  cook: "Bếp",
  cashier: "Thu ngân",
  host: "Đón khách",
  cleaner: "Vệ sinh",
  bartender: "Pha chế",
  shipper: "Giao hàng",
  storekeeper: "Kho",
};

const compactNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    Number(value || 0),
  );

const getRoleLabel = (role) => ROLE_LABELS[String(role || "").toLowerCase()] || role || "Vai trò";

const getCurrentWeekWindow = () => {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const day = end.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  end.setDate(end.getDate() + daysToSunday);
  end.setHours(23, 59, 59, 999);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  return { start, end, days };
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

const severityLabel = (severity) => {
  if (severity === "high") return "Cao";
  if (severity === "medium") return "Trung bình";
  return "Thấp";
};

const statusLabel = (status) => {
  if (status === "understaffed" || status === "blocked") return "Thiếu người";
  if (status === "overstaffed") return "Dư người";
  return "Cân bằng";
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

const buildRoleRows = (item) => {
  const roleNeeds = Array.isArray(item?.roleNeeds) ? item.roleNeeds : [];
  const unfilledRoles = Array.isArray(item?.unfilledRoles) ? item.unfilledRoles : [];
  const roleMap = new Map();

  roleNeeds.forEach((roleRow) => {
    const role = String(roleRow.role || "");
    if (!role) return;
    roleMap.set(role, {
      role,
      required: Number(roleRow.required || 0),
      assigned: Number(roleRow.assigned || 0),
      planned: Number(roleRow.planned || 0),
      missing: Number(roleRow.missing || 0),
      unresolved: Number(roleRow.unresolved || 0),
      reason: roleRow.reason || "",
    });
  });

  unfilledRoles.forEach((roleRow) => {
    const role = String(roleRow.role || roleRow.requiredRole || "");
    if (!role) return;
    const current = roleMap.get(role) || { role, required: 0, assigned: 0, planned: 0, missing: 0, unresolved: 0 };
    roleMap.set(role, {
      ...current,
      required: Math.max(Number(current.required || 0), Number(roleRow.required || 1)),
      assigned: Number(current.assigned || roleRow.assigned || 0),
      planned: Number(roleRow.planned || current.planned || 0),
      missing: Number(roleRow.missing || current.missing || 0),
      unresolved: Number(roleRow.unresolved || current.unresolved || 0),
      reason: roleRow.reason || current.reason || "",
    });
  });

  return Array.from(roleMap.values());
};

const readinessTone = (item) => {
  if (item.tone) return item.tone;
  if (Number(item.value || 0) > 0) return "ready";
  return "warning";
};

function AutoSchedulePreviewModal({
  isOpen,
  onClose,
  preview,
  aiPlannerPayload,
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
}) {
  const previewItems = preview?.items || [];
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [preview]);

  useEffect(() => {
    if (!previewItems.length) return;
    setPageIndex((current) => Math.min(current, previewItems.length - 1));
  }, [previewItems.length]);

  const currentItem = previewItems[pageIndex] || null;
  const selectedCount = previewItems.filter((item) => selectedShiftKeys[item.shiftKey]).length;
  const applicableCount = previewItems.filter((item) => item.canApply).length;
  const requiresOverride = Boolean(overrideSummary?.requiresOverride);
  const canApplyWithOverride =
    !requiresOverride ||
    (String(overrideReason || "").trim().length >= 5 && overrideConfirmed);
  const assignedRows = currentItem?.plannedAssignments || currentItem?.assignments || [];
  const blockedRows = currentItem?.blockedCandidates || [];
  const roleRows = buildRoleRows(currentItem);
  const issueRows = [
    ...(currentItem?.issues || []),
    ...(currentItem?.validationIssues || []),
    ...(currentItem?.warnings || []),
  ];
  const shiftLabel = SHIFT_LABELS[currentItem?.shiftType] || currentItem?.shiftType || "Ca làm";
  const isCurrentSelected = Boolean(currentItem && selectedShiftKeys[currentItem.shiftKey]);
  const explanation = currentItem
    ? aiPlannerPayload?.explanations?.[currentItem.shiftKey] || null
    : null;

  const goPrev = () => setPageIndex((current) => Math.max(0, current - 1));
  const goNext = () => setPageIndex((current) => Math.min(previewItems.length - 1, current + 1));

  return (
    <Modal
      isOpen={isOpen}
      onClose={!applying ? onClose : undefined}
      size="xl"
      zIndex={1120}
      className="auto-schedule-preview-modal"
    >
      <Modal.Header className="auto-preview-header">
        <div>
          <span className="auto-preview-eyebrow">Preview chia ca tự động</span>
          <strong>
            {previewItems.length ? `Ca ${pageIndex + 1}/${previewItems.length}` : "Chưa có preview"}
          </strong>
        </div>
      </Modal.Header>

      <Modal.Body className="auto-preview-body">
        {!currentItem ? (
          <div className="auto-state empty">
            <Info size={16} /> Chưa có gợi ý nào trong phạm vi hiện tại.
          </div>
        ) : (
          <article className={`auto-preview-page ${currentItem.canApply ? "" : "blocked"}`}>
            <div className="auto-preview-page__top">
              <label className="auto-preview-select-row">
                <input
                  type="checkbox"
                  checked={isCurrentSelected}
                  onChange={() => onToggleShift?.(currentItem.shiftKey)}
                  disabled={!currentItem.canApply || applying}
                />
                <span>{currentItem.canApply ? "Chọn preview này để áp dụng" : "Preview này đang bị chặn"}</span>
              </label>
              <span className={`severity-pill ${currentItem.severity || "low"}`}>
                {statusLabel(currentItem.status)} · {severityLabel(currentItem.severity)}
              </span>
            </div>

            <div className="auto-preview-title-block">
              <h3>{currentItem.shiftName || "Ca làm"} · {shiftLabel}</h3>
              <p>
                {formatDate(currentItem.date || currentItem.startTime)}
                {currentItem.startTime || currentItem.endTime ? ` · ${formatDateTime(currentItem.startTime)} - ${formatDateTime(currentItem.endTime)}` : ""}
              </p>
            </div>

            <div className="auto-preview-metrics">
              <div><span>Cần</span><strong>{compactNumber(currentItem.requiredStaff || currentItem.recommendedTotalStaff || 0)}</strong></div>
              <div><span>Đề xuất</span><strong>{compactNumber(assignedRows.length || currentItem.assignedStaff || 0)}</strong></div>
              <div><span>Thiếu</span><strong>{compactNumber(currentItem.missingStaff || currentItem.missingHeadcount || currentItem.unresolvedCount || 0)}</strong></div>
              <div><span>Nhu cầu</span><strong>{compactNumber(currentItem.forecastedDemand || currentItem.expectedGuests || 0)}</strong></div>
            </div>

            {roleRows.length > 0 && (
              <section className="auto-preview-section">
                <h4>Vai trò cần phủ</h4>
                <div className="preview-role-list">
                  {roleRows.map((role) => (
                    <span key={role.role} className="role-pill">
                      {getRoleLabel(role.role)}: {role.assigned + role.planned}/{role.required}
                      {role.unresolved > 0 ? ` · thiếu ${role.unresolved}` : ""}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {assignedRows.length > 0 && (
              <section className="auto-preview-section assignment-block">
                <h4>Nhân sự đề xuất</h4>
                <ul>
                  {assignedRows.map((assignment, idx) => (
                    <li key={`${assignment.staffId || assignment.employeeId || idx}-assignment`}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>{getCandidateDisplayName(assignment)}</strong>
                        <span>
                          {getRoleLabel(assignment.role || assignment.requiredRole || currentItem.shiftType)}
                          {assignment.score || assignment.validationScore ? ` · Điểm ${compactNumber(assignment.score || assignment.validationScore)}` : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {blockedRows.length > 0 && (
              <section className="auto-preview-section assignment-block warning">
                <h4>Ứng viên bị chặn</h4>
                <ul>
                  {blockedRows.slice(0, 6).map((candidate, idx) => (
                    <li key={`${candidate.staffId || candidate.employeeId || idx}-blocked`}>
                      <AlertTriangle size={16} />
                      <div>
                        <strong>{getCandidateDisplayName(candidate)}</strong>
                        <span>{candidate.reason || "Không đạt ràng buộc xếp ca"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {issueRows.length > 0 && (
              <section className="auto-preview-section assignment-alert-block issue">
                <h4>Cảnh báo cần kiểm tra</h4>
                <ul>
                  {issueRows.map((issue, idx) => (
                    <li key={`${getIssueMessage(issue)}-${idx}`}>
                      <span>{getIssueMessage(issue)}</span>
                      {getSuggestedAction(issue) && <small>{getSuggestedAction(issue)}</small>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {explanation && (
              <section className="auto-preview-section ai-explanation-box">
                <p>{explanation.summary || explanation.reason}</p>
                {explanation.factors?.length > 0 && (
                  <div className="ai-factor-list">
                    {explanation.factors.map((factor, idx) => (
                      <span key={`${factor}-${idx}`} className="ai-factor-chip">{factor}</span>
                    ))}
                  </div>
                )}
              </section>
            )}
          </article>
        )}

        {requiresOverride && (
          <div className="auto-override-panel">
            <h5>Cần xác nhận ghi đè cảnh báo</h5>
            <p>Một số ca được chọn vẫn có cảnh báo. Nhập lý do để tiếp tục áp dụng.</p>
            <label className="override-reason-field">
              <span>Lý do ghi đè</span>
              <textarea
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange?.(event.target.value)}
                placeholder="VD: Quản lý đã xác nhận bổ sung nhân sự trực tiếp..."
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

      <Modal.Footer className="auto-preview-footer">
        <div className="auto-preview-pager">
          <button type="button" className="btn-secondary" onClick={goPrev} disabled={pageIndex <= 0 || applying}>
            <ChevronLeft size={16} /> Trước
          </button>
          <span>{selectedCount}/{applicableCount} ca đã chọn</span>
          <button type="button" className="btn-secondary" onClick={goNext} disabled={pageIndex >= previewItems.length - 1 || applying}>
            Sau <ChevronRight size={16} />
          </button>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={applying}>Đóng preview</button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onApply?.({ overrideReason, overrideConfirmed })}
          disabled={!selectedCount || applying || !canApplyWithOverride}
        >
          {applying ? "Đang áp dụng..." : `Xác nhận áp dụng ${selectedCount} ca`}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const previewItems = preview?.items || [];
  const applicableCount = previewItems.filter((item) => item.canApply).length;
  const selectedCount = previewItems.filter((item) => selectedShiftKeys[item.shiftKey]).length;
  const weekWindow = useMemo(getCurrentWeekWindow, [isOpen]);
  const readinessItems = useMemo(
    () => [
      {
        icon: <Users size={16} />,
        label: "Ứng viên khả dụng",
        value: assistantMeta?.totalCandidates ?? "Sẽ lấy từ dữ liệu nhân sự",
        tone: assistantMeta ? "ready" : "neutral",
        help: "Nhân viên đang hoạt động, vai trò, lịch rảnh và ràng buộc giờ làm.",
      },
      {
        icon: <ClipboardList size={16} />,
        label: "Nhu cầu ca cần phủ",
        value: assistantMeta?.totalDemandSlots ?? "Tự đọc từ ca/forecast hiện có",
        tone: assistantMeta ? "ready" : "neutral",
        help: "Hệ thống dùng cấu hình ca, forecast nhu cầu và lịch đang có trong tuần.",
      },
      {
        icon: <CalendarRange size={16} />,
        label: "Khoảng áp dụng",
        value: `${formatDate(weekWindow.start)} - ${formatDate(weekWindow.end)}`,
        tone: "ready",
        help: "Không chọn 1-7 ngày nữa; assistant tự dùng từ hôm nay đến hết tuần.",
      },
      {
        icon: <Settings size={16} />,
        label: "Ràng buộc vận hành",
        value: `${config.respectAvailability ? "Có" : "Không"} nghỉ phép · ${config.avoidOvertime ? "Chặn" : "Cho phép"} vượt giờ`,
        tone: config.respectAvailability && config.avoidOvertime ? "ready" : "warning",
        help: "Manager nên kiểm tra đăng ký lịch rảnh, đơn nghỉ phép và giới hạn giờ trước khi tạo preview.",
      },
    ],
    [assistantMeta, config.avoidOvertime, config.respectAvailability, weekWindow],
  );

  useEffect(() => {
    if (!isOpen) setIsPreviewOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (previewItems.length > 0 && !generating) {
      setIsPreviewOpen(true);
    }
  }, [generating, previewItems.length]);

  const handleGenerateClick = () => {
    const horizonDays = weekWindow.days;
    if (Number(config?.horizonDays || 0) !== horizonDays) {
      onConfigChange?.({ ...config, horizonDays });
      window.setTimeout(() => onGenerate?.(), 0);
      return;
    }
    onGenerate?.();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={!generating && !applying ? onClose : undefined}
        size="xl"
        className="auto-schedule-modal"
      >
        <Modal.Header>Chia ca tự động</Modal.Header>

        <Modal.Body className="auto-schedule-body auto-schedule-body--setup">
          <div className="auto-banner">
            <div className="banner-icon">
              <Sparkles size={20} />
            </div>
            <div className="banner-copy">
              <strong>Chia ca bằng dữ liệu hiện có</strong>
              <p>
                Hệ thống tự lấy thông tin ca, nhân sự, nghỉ phép, lịch rảnh, forecast và ràng buộc vận hành trong tuần đang thao tác để tạo preview.
              </p>
              <p>
                Bản preview sẽ mở ở modal riêng, mỗi trang xem một gợi ý ca để manager duyệt trước khi áp dụng.
              </p>
            </div>
          </div>

          <div className="auto-current-window-card">
            <div className="config-head">
              <CalendarRange size={17} />
              <span>Thời gian áp dụng tự động</span>
            </div>
            <div className="auto-window-range">
              <strong>{formatDate(weekWindow.start)} → {formatDate(weekWindow.end)}</strong>
              <span>{weekWindow.days} ngày còn lại trong tuần</span>
            </div>
            <p>
              Đã bỏ lựa chọn 1-7 ngày. Khi manager mở modal, hệ thống dùng phạm vi từ ngày hiện tại đến hết tuần đang làm việc.
            </p>
          </div>

          <div className="auto-readiness-grid">
            {readinessItems.map((item) => (
              <article key={item.label} className={`auto-readiness-card ${readinessTone(item)}`}>
                <div className="auto-readiness-icon">{item.icon}</div>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.help}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="auto-manager-checklist">
            <div className="config-head">
              <Info size={17} />
              <span>Manager cần chuẩn bị trước khi tạo preview</span>
            </div>
            <ul>
              <li>Kiểm tra đã có cấu hình ca và vai trò cần phủ trong tuần.</li>
              <li>Đảm bảo nhân viên đã cập nhật lịch rảnh hoặc đơn nghỉ phép liên quan.</li>
              <li>Rà soát giới hạn giờ/tuần và các ca đang bị thiếu người.</li>
              <li>Sau khi tạo preview, mở modal preview để xem từng gợi ý rồi xác nhận áp dụng.</li>
            </ul>
          </div>

          <div className="auto-constraint-row">
            <div className="config-card compact-control-card">
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
                    onConfigChange?.({
                      ...config,
                      weeklyHoursCap: Number(event.target.value || 40),
                    })
                  }
                  disabled={generating || applying}
                />
              </label>
            </div>

            <div className="config-card compact-control-card">
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
                    onConfigChange?.({
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
                    onConfigChange?.({
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
              onClick={handleGenerateClick}
              disabled={generating || applying}
            >
              <Sparkles size={16} />
              {generating ? "Đang tạo preview..." : "Tạo preview chia ca"}
            </button>

            {previewItems.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsPreviewOpen(true)}
                disabled={applying}
              >
                Mở preview ({selectedCount}/{applicableCount})
              </button>
            )}

            <div className="assistant-meta">
              <span className={`meta-pill ${autoScheduleSource === "ai" ? "forecast" : "fallback"}`}>
                {autoScheduleSource === "ai" ? "AI forecast" : "Fallback nội bộ"}
              </span>
              <span>{requiredRoleOptions.length} nhóm vai trò khả dụng</span>
            </div>
          </div>

          {generating && (
            <div className="auto-state loading">
              <Info size={16} /> Đang phân tích dữ liệu hiện có và dựng preview chia ca...
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
        </Modal.Body>

        <Modal.Footer className="auto-schedule-footer auto-schedule-footer--setup">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={generating || applying}>
            Đóng
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerateClick}
            disabled={generating || applying}
          >
            {generating ? "Đang tạo..." : "Tạo preview"}
          </button>
        </Modal.Footer>
      </Modal>

      <AutoSchedulePreviewModal
        isOpen={isOpen && isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        preview={preview}
        aiPlannerPayload={aiPlannerPayload}
        selectedShiftKeys={selectedShiftKeys}
        onToggleShift={onToggleShift}
        onApply={onApply}
        applying={applying}
        overrideReason={overrideReason}
        onOverrideReasonChange={onOverrideReasonChange}
        overrideConfirmed={overrideConfirmed}
        onOverrideConfirmedChange={onOverrideConfirmedChange}
        overrideError={overrideError}
        overrideSummary={overrideSummary}
      />
    </>
  );
};

export default AutoScheduleModal;
