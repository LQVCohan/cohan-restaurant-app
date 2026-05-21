import React, { useMemo, useState } from "react";
import { buildAvailabilityRegistrationSchedule, resolveAvailabilityWindowEffectiveStatus } from "@/utils/availabilityRegistrationSchedule";
import { ChevronDown, ChevronUp, ClipboardList, Eye } from "lucide-react";
import "./AvailabilityRegistrationPanel.scss";

const WINDOW_STATUS_LABELS = {
  draft: "Bản nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  locked: "Đã khóa để xếp lịch",
  used_for_schedule: "Đã dùng để xếp lịch",
  expired: "Hết hạn",
  unknown: "Không xác định",
};

const SUBMISSION_STATUS_LABELS = {
  pending: "Chờ duyệt",
  submitted: "Đã gửi",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  late_change_requested: "Chờ duyệt thay đổi muộn",
  locked: "Đã khóa để xếp lịch",
};

const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  probation: "Thử việc",
  seasonal: "Thời vụ",
  contract: "Hợp đồng",
};
const SHIFT_TYPE_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  full_day: "Cả ngày",
  all_day: "Cả ngày",
};

const SLOT_STATUS_LABELS = {
  available: "Có thể làm",
  unavailable: "Không khả dụng",
  preferred: "Ưu tiên",
};

function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getSubmissionStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  return SUBMISSION_STATUS_LABELS[key] || status || "Không xác định";
}

function getShiftTypeLabel(shiftType) {
  const key = String(shiftType || "").toLowerCase();
  return SHIFT_TYPE_LABELS[key] || shiftType || "Ca";
}

function getSlotStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  return SLOT_STATUS_LABELS[key] || status || "Không rõ";
}
function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AvailabilityRegistrationPanel({
  selectedRestaurantId,
  nextWeekStart,
  nextWeekEnd,
  availabilityWindow,
  submissions,
  loading,
  error,
  mode = "nextWeek",
  targetWeekStart,
  targetWeekEnd,
  onCreateWindow,
  onOpenWindow,
  onCloseWindow,
  collapsed = false,
  onToggleCollapse,
  reopenBlockedReason = "",
  availabilityPolicy,
  onUpdateAvailabilityPolicy,
  policySaving = false,
  onReviewSubmission,
  reviewingSubmission = false,
  firstWeekGraceActive = false,
  nextWeekWindowMissing = false,
  isSunday = false,
  shouldRemindNextWeekRegistration = false,
}) {
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyDraft, setPolicyDraft] = useState({
    availabilityRegistrationMode: "manual",
    availabilityOpenDayOffset: -7,
    availabilityOpenTime: "09:00",
    availabilityCloseDayOffset: -1,
    availabilityCloseTime: "18:00",
    lateChangeRequiresApproval: true,
  });
  const registrationSchedule = useMemo(() => buildAvailabilityRegistrationSchedule({
    targetWeekStart,
    targetWeekEnd,
    policy: availabilityPolicy,
  }), [targetWeekStart, targetWeekEnd, availabilityPolicy]);

  const windowStatus = String(
    resolveAvailabilityWindowEffectiveStatus(availabilityWindow || {
      status: "draft",
      registrationMode: registrationSchedule.mode,
      openAt: registrationSchedule.openAt,
      closeAt: registrationSchedule.closeAt,
    }) || "unknown",
  ).toLowerCase();
  const registrationMode = String(availabilityWindow?.registrationMode || registrationSchedule.mode || "manual").toLowerCase();
  const hasWindow = Boolean(availabilityWindow?.id);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const submissionSummary = useMemo(() => {
    const totals = {
      total: submissions.length,
      pending: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      locked: 0,
      late_change_requested: 0,
    };

    submissions.forEach((item) => {
      const status = String(item.status || "").toLowerCase();
      if (Object.hasOwn(totals, status)) totals[status] += 1;
    });

    return totals;
  }, [submissions]);

  const statusLabel = hasWindow
    ? WINDOW_STATUS_LABELS[windowStatus] || WINDOW_STATUS_LABELS.unknown
    : "Chưa tạo window";

  const canCreate = !hasWindow && selectedRestaurantId && !loading;
  const canOpen =
    hasWindow &&
    selectedRestaurantId &&
    !loading &&
    (windowStatus === "draft" ||
      (windowStatus === "closed" && !reopenBlockedReason));
  const openActionLabel =
    windowStatus === "closed" ? "Mở lại đăng ký" : "Mở đăng ký";
  const canClose =
    hasWindow && selectedRestaurantId && !loading && windowStatus === "open";
  const canViewSubmissions = hasWindow && selectedRestaurantId && !loading;
  const manualActionsDisabled = registrationMode === "auto";

  const openPolicyModal = () => {
    setPolicyDraft({
      availabilityRegistrationMode: String(availabilityPolicy?.availabilityRegistrationMode || "manual").toLowerCase(),
      availabilityOpenDayOffset: Number(availabilityPolicy?.availabilityOpenDayOffset ?? -7),
      availabilityOpenTime: availabilityPolicy?.availabilityOpenTime || "09:00",
      availabilityCloseDayOffset: Number(availabilityPolicy?.availabilityCloseDayOffset ?? -1),
      availabilityCloseTime: availabilityPolicy?.availabilityCloseTime || "18:00",
      lateChangeRequiresApproval: availabilityPolicy?.lateChangeRequiresApproval !== false,
    });
    setIsPolicyModalOpen(true);
  };
  return (
    <section className="schedule-availability-panel">
      <div className="schedule-availability-panel__header">
        <div>
          <h3>
            <ClipboardList size={18} /> Đăng ký lịch nhân viên
          </h3>
          <p>
            Quản lý thời gian nhân viên đăng ký lịch rảnh trước khi xếp lịch.
          </p>
          <p>
            Kỳ đăng ký cho tuần {formatDateTime(targetWeekStart)} -{" "}
            {formatDateTime(targetWeekEnd)} (
            {mode === "currentWeek" ? "tuần đang xem" : "tuần kế tiếp"})
          </p>
        </div>
        <span
          className={`schedule-availability-panel__status is-${windowStatus}`}
        >
          {statusLabel}
        </span>
        {typeof onToggleCollapse === "function" ? (
          <button
            type="button"
            className="btn-collapse-panel icon-only"
            onClick={onToggleCollapse}
            aria-label={
              collapsed
                ? "Mở rộng đăng ký lịch nhân viên"
                : "Thu gọn đăng ký lịch nhân viên"
            }
            title={
              collapsed
                ? "Mở rộng đăng ký lịch nhân viên"
                : "Thu gọn đăng ký lịch nhân viên"
            }
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <div className="schedule-availability-panel__compact-summary">
          <div className="schedule-availability-panel__compact-main">
            <strong>Đăng ký lịch nhân viên</strong>
            <span className={`schedule-availability-panel__status is-${windowStatus}`}>
              {statusLabel}
            </span>
          </div>
          <div className="schedule-availability-panel__compact-meta">
            <span>
              Tuần áp dụng: {formatDateOnly(targetWeekStart)} -{" "}
              {formatDateOnly(targetWeekEnd)}
            </span>
            <span>
              Đã gửi: {submissionSummary.total} · Chờ duyệt:{" "}
              {submissionSummary.pending + submissionSummary.late_change_requested}
            </span>
          </div>
          <div className="schedule-availability-panel__compact-actions">
            {canOpen && !manualActionsDisabled ? (
              <button type="button" onClick={onOpenWindow} disabled={!canOpen}>
                {loading ? "Đang xử lý..." : openActionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowSubmissions((prev) => !prev)}
              disabled={!canViewSubmissions}
            >
              <Eye size={14} />{" "}
              {showSubmissions ? "Ẩn đăng ký" : "Xem đăng ký"}
            </button>
            <button type="button" onClick={openPolicyModal} disabled={policySaving}>
              Thiết lập
            </button>
            {typeof onToggleCollapse === "function" ? (
              <button type="button" className="btn-collapse-panel" onClick={onToggleCollapse}>
                Mở rộng
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!collapsed ? (
        <>
          {error ? (
            <div className="schedule-availability-panel__empty">
              <h4>Không thể tải kỳ đăng ký</h4>
              <p>{error.message || "Đã có lỗi xảy ra."}</p>
            </div>
          ) : null}


          {firstWeekGraceActive && nextWeekWindowMissing ? (
            <div className="schedule-availability-panel__empty">
              <p>Nên mở đăng ký cho tuần sau ngay để nhân viên gửi lịch rảnh đúng quy trình.</p>
            </div>
          ) : null}
          {isSunday ? (
            <div className="schedule-availability-panel__empty">
              <p>Hôm nay nên hoàn tất và công bố lịch tuần tới. Từ tuần sau, hãy vận hành theo chu kỳ đăng ký lịch rảnh chuẩn.</p>
            </div>
          ) : null}
          {!hasWindow ? (
            <div className="schedule-availability-panel__empty">
              <h4>Chưa có kỳ đăng ký khả dụng</h4>
              <p>
                Tạo kỳ đăng ký để nhân viên part-time đăng ký thời gian có thể
                làm và nhân viên full-time đăng ký ngày không khả dụng.
              </p>
              <button
                type="button"
                onClick={onCreateWindow}
                disabled={!canCreate}
              >
                {loading ? "Đang xử lý..." : "Tạo kỳ đăng ký cho tuần kế tiếp"}
              </button>
              {shouldRemindNextWeekRegistration ? (
                <p className="schedule-availability-panel__hint">
                  Nên tạo kỳ đăng ký cho tuần kế tiếp để nhân viên gửi lịch rảnh đúng quy trình.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="schedule-availability-panel__summary">
                <div>
                  <span>Tuần áp dụng</span>
                  <strong>
                    {formatDateTime(availabilityWindow.periodStart)} -{" "}
                    {formatDateTime(availabilityWindow.periodEnd)}
                  </strong>
                </div>
                <div>
                  <span>Chế độ đăng ký</span>
                  <strong>{registrationMode === "auto" ? "Tự động" : "Thủ công"}</strong>
                </div>
                <div>
                  <span>Thời gian mở đăng ký</span>
                  <strong>{formatDateTime(availabilityWindow.openAt || registrationSchedule.openAt)}</strong>
                </div>
                <div>
                  <span>Hạn đóng đăng ký</span>
                  <strong>{formatDateTime(availabilityWindow.closeAt || registrationSchedule.closeAt)}</strong>
                </div>
                <div>
                  <span>Đối tượng đăng ký ca khả dụng</span>
                  <strong>
                    {(availabilityWindow.targetEmploymentTypes || [])
                      .map(
                        (value) =>
                          EMPLOYMENT_TYPE_LABELS[
                            String(value || "").toLowerCase()
                          ],
                      )
                      .filter(Boolean)
                      .join(", ") || "Chưa thiết lập"}
                  </strong>
                </div>
                <div>
                  <span>Full-time đăng ký unavailable</span>
                  <strong>
                    {availabilityWindow.allowFullTimeUnavailableException
                      ? "Có"
                      : "Không"}
                  </strong>
                </div>
                <div>
                  <span>Kỳ tạo sẵn</span>
                  <strong>
                    {formatDateTime(nextWeekStart)} -{" "}
                    {formatDateTime(nextWeekEnd)}
                  </strong>
                </div>
              </div>

              <div className="schedule-availability-panel__actions">
                <button
                  type="button"
                  onClick={onOpenWindow}
                  disabled={!canOpen || manualActionsDisabled}
                  title={manualActionsDisabled ? "Chế độ tự động đang bật, hệ thống tự mở/đóng theo cấu hình" : ""}
                >
                  {loading ? "Đang xử lý..." : openActionLabel}
                </button>
                <button
                  type="button"
                  onClick={onCloseWindow}
                  disabled={!canClose || manualActionsDisabled}
                  title={manualActionsDisabled ? "Chế độ tự động đang bật, hệ thống tự mở/đóng theo cấu hình" : ""}
                >
                  {loading ? "Đang xử lý..." : "Đóng đăng ký"}
                </button>
                <button type="button" onClick={openPolicyModal} disabled={!selectedRestaurantId || policySaving}>
                  {policySaving ? "Đang lưu..." : "Thiết lập đăng ký"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmissions((value) => !value)}
                  disabled={!canViewSubmissions}
                >
                  <Eye size={14} />
                  {showSubmissions ? "Ẩn đăng ký" : "Xem đăng ký"}
                </button>
              </div>
              {registrationMode === "manual" ? (
                <div className="schedule-availability-panel__empty">
                  <p><strong>Thủ công:</strong> hệ thống chỉ hiển thị khuyến nghị, manager tự bấm mở/đóng.</p>
                  <p>Khuyến nghị mở đăng ký: <strong>{formatDateTime(registrationSchedule.recommendedOpenAt)}</strong></p>
                  <p>Khuyến nghị đóng đăng ký: <strong>{formatDateTime(registrationSchedule.recommendedCloseAt)}</strong></p>
                </div>
              ) : (
                <div className="schedule-availability-panel__empty">
                  <p><strong>Tự động:</strong> hệ thống tự tính effectiveStatus theo openAt/closeAt.</p>
                </div>
              )}
              {reopenBlockedReason ? (
                <div className="schedule-availability-panel__empty">
                  <p>{reopenBlockedReason}</p>
                </div>
              ) : null}

              <div className="schedule-availability-panel__submissions">
                <h4>Tổng quan đăng ký</h4>
                <div className="metrics-grid">
                  <span>Tổng submission: {submissionSummary.total}</span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.late_change_requested}:
                    {submissionSummary.late_change_requested}
                  </span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.pending}:{" "}
                    {submissionSummary.pending}
                  </span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.submitted}:{" "}
                    {submissionSummary.submitted}
                  </span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.approved}:{" "}
                    {submissionSummary.approved}
                  </span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.rejected}:{" "}
                    {submissionSummary.rejected}
                  </span>
                  <span>
                    {SUBMISSION_STATUS_LABELS.locked}:{" "}
                    {submissionSummary.locked}
                  </span>
                </div>
              </div>
              {showSubmissions ? (
                <div className="schedule-availability-panel__submission-detail">
                  <div className="schedule-availability-panel__submission-detail-header">
                    <h4>Chi tiết đăng ký</h4>
                    <span>{submissionSummary.total} bản ghi</span>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="schedule-availability-panel__empty compact">
                      <p>Chưa có nhân viên nào gửi đăng ký cho kỳ này.</p>
                    </div>
                  ) : (
                    <div className="availability-submission-list">
                      {submissions.map((item) => {
                        const availableSlots = (item.slots || []).filter(
                          (slot) =>
                            String(slot.status || "").toLowerCase() ===
                            "available",
                        );

                        const unavailableSlots = (item.slots || []).filter(
                          (slot) =>
                            String(slot.status || "").toLowerCase() ===
                            "unavailable",
                        );

                        return (
                          <article
                            key={item.id}
                            className="availability-submission-card"
                          >
                            <div className="availability-submission-card__top">
                              <div>
                                <strong>
                                  {item.employeeName ||
                                    item.employee?.fullName ||
                                    `Nhân viên ${String(item.employeeId || "").slice(-6)}`}
                                </strong>
                                <span>
                                  {EMPLOYMENT_TYPE_LABELS[
                                    String(
                                      item.employmentType || "",
                                    ).toLowerCase()
                                  ] ||
                                    item.employmentType ||
                                    "Nhân viên"}
                                  {" · "}
                                  {item.submissionType ===
                                  "unavailable_exception"
                                    ? "Báo không khả dụng"
                                    : "Đăng ký ca khả dụng"}
                                </span>
                              </div>

                              <span
                                className={`availability-submission-status is-${String(
                                  item.status || "",
                                ).toLowerCase()}`}
                              >
                                {getSubmissionStatusLabel(item.status)}
                              </span>
                            </div>

                            <div className="availability-submission-card__meta">
                              <span>
                                Gửi lúc: {formatDateTime(item.submittedAt)}
                              </span>
                              <span>
                                Ca khả dụng:{" "}
                                <strong>{availableSlots.length}</strong>
                              </span>
                              <span>
                                Không khả dụng:{" "}
                                <strong>{unavailableSlots.length}</strong>
                              </span>
                            </div>

                            <div className="availability-submission-card__slots">
                              {(item.slots || []).length === 0 ? (
                                <span className="availability-submission-slot is-empty">
                                  Không có slot chi tiết
                                </span>
                              ) : (
                                item.slots.map((slot, index) => (
                                  <span
                                    key={`${item.id}-${slot.date}-${slot.shiftType}-${index}`}
                                    className={`availability-submission-slot is-${String(
                                      slot.status || "",
                                    ).toLowerCase()}`}
                                    title={slot.note || ""}
                                  >
                                    {formatDateOnly(slot.date)} ·{" "}
                                    {getShiftTypeLabel(slot.shiftType)} ·{" "}
                                    {getSlotStatusLabel(slot.status)}
                                  </span>
                                ))
                              )}
                            </div>

                            {(item.pendingSlots || []).length > 0 ? (
                              <div className="availability-submission-card__slots">
                                <strong>Yêu cầu thay đổi muộn</strong>
                                {(item.pendingSlots || []).map((slot, index) => (
                                  <span
                                    key={`${item.id}-pending-${slot.date}-${slot.shiftType}-${index}`}
                                    className={`availability-submission-slot is-${String(
                                      slot.status || "",
                                    ).toLowerCase()}`}
                                    title={slot.note || ""}
                                  >
                                    {formatDateOnly(slot.date)} · {getShiftTypeLabel(slot.shiftType)} · {getSlotStatusLabel(slot.status)}
                                  </span>
                                ))}
                                <span className="availability-submission-slot is-empty">
                                  Gửi lúc: {formatDateTime(item.pendingSubmittedAt || item.submittedAt)}
                                </span>
                              </div>
                            ) : null}

                            {String(item.status || "").toLowerCase() === "late_change_requested" ? (
                              <div className="schedule-availability-panel__actions">
                                <button type="button" disabled={reviewingSubmission} onClick={() => onReviewSubmission?.(item.id, true)}>Duyệt thay đổi</button>
                                <button type="button" disabled={reviewingSubmission} onClick={() => onReviewSubmission?.(item.id, false)}>Từ chối</button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
              <p className="schedule-availability-panel__hint">Thay đổi sau khi đóng: {availabilityPolicy?.lateChangeRequiresApproval !== false ? "Cho phép gửi yêu cầu chờ duyệt" : "Không cho gửi"}</p>
              {hasWindow ? (<p className="schedule-availability-panel__hint">Thay đổi cài đặt này áp dụng cho các kỳ tạo sau. Kỳ hiện tại giữ cấu hình đã tạo.</p>) : null}
            </>
          )}
        </>
      ) : null}
      {isPolicyModalOpen ? (
        <div className="publish-confirm-backdrop">
          <div className="availability-policy-modal">
            <div className="availability-policy-modal__header">
              <h3>Thiết lập đăng ký lịch nhân viên</h3>
              <p>
                Cấu hình cách hệ thống mở/đóng kỳ đăng ký theo tuần mục tiêu.
              </p>
            </div>
            <div className="availability-policy-modal__explain">
              <div>
                <strong>Tự động</strong>
                <span>Hệ thống tự tính effectiveStatus theo openAt/closeAt.</span>
              </div>
              <div>
                <strong>Thủ công</strong>
                <span>Chỉ hiển thị khuyến nghị, manager tự bấm mở/đóng.</span>
              </div>
            </div>
            <div className="availability-policy-modal__grid">
              <label>
                Chế độ đăng ký
                <select
                  value={policyDraft.availabilityRegistrationMode}
                  onChange={(event) =>
                    setPolicyDraft((prev) => ({
                      ...prev,
                      availabilityRegistrationMode: event.target.value,
                    }))}
                >
                  <option value="manual">Thủ công</option>
                  <option value="auto">Tự động</option>
                </select>
              </label>
              <label>
                Ngày mở đăng ký (offset theo target week)
                <input type="number" value={policyDraft.availabilityOpenDayOffset} onChange={(event) => setPolicyDraft((prev) => ({ ...prev, availabilityOpenDayOffset: Number(event.target.value) }))} placeholder="-7" />
              </label>
              <label>
                Giờ mở đăng ký
                <input type="time" value={policyDraft.availabilityOpenTime} onChange={(event) => setPolicyDraft((prev) => ({ ...prev, availabilityOpenTime: event.target.value }))} />
              </label>
              <label>
                Ngày đóng đăng ký (offset theo target week)
                <input type="number" value={policyDraft.availabilityCloseDayOffset} onChange={(event) => setPolicyDraft((prev) => ({ ...prev, availabilityCloseDayOffset: Number(event.target.value) }))} placeholder="-1" />
              </label>
              <label>
                Giờ đóng đăng ký
                <input type="time" value={policyDraft.availabilityCloseTime} onChange={(event) => setPolicyDraft((prev) => ({ ...prev, availabilityCloseTime: event.target.value }))} />
              </label>
              <label>
                Thay đổi sau khi đóng đăng ký
                <select
                  value={policyDraft.lateChangeRequiresApproval ? "yes" : "no"}
                  onChange={(event) => setPolicyDraft((prev) => ({ ...prev, lateChangeRequiresApproval: event.target.value === "yes" }))}
                >
                  <option value="yes">Cho phép gửi yêu cầu chờ duyệt</option>
                  <option value="no">Không cho gửi sau khi đóng</option>
                </select>
                <small>
                  {policyDraft.lateChangeRequiresApproval
                    ? "Nhân viên gửi sau khi đóng sẽ vào trạng thái chờ review, quản lý duyệt/từ chối."
                    : "Sau khi đóng kỳ đăng ký, nhân viên không thể gửi hoặc cập nhật đăng ký."}
                </small>
              </label>
            </div>
            <div className="availability-policy-modal__actions">
              <button type="button" className="btn-secondary" onClick={() => setIsPolicyModalOpen(false)} disabled={policySaving}>Hủy</button>
              <button type="button" className="btn-primary" disabled={policySaving} onClick={async () => {
                await onUpdateAvailabilityPolicy?.(policyDraft);
                setIsPolicyModalOpen(false);
              }}>
                {policySaving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
