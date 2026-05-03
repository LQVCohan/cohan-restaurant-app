import React, { useMemo } from "react";
import { ClipboardList } from "lucide-react";

const WINDOW_STATUS_LABELS = {
  draft: "Bản nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  locked: "Đã khóa",
  expired: "Hết hạn",
  unknown: "Không xác định",
};

const SUBMISSION_STATUS_LABELS = {
  pending: "Chờ review",
  submitted: "Đã gửi",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  locked: "Đã khóa",
};

const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  probation: "Thử việc",
  seasonal: "Thời vụ",
  contract: "Hợp đồng",
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
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
}) {
  const windowStatus = String(availabilityWindow?.status || "unknown").toLowerCase();
  const hasWindow = Boolean(availabilityWindow?.id);

  const submissionSummary = useMemo(() => {
    const totals = {
      total: submissions.length,
      pending: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      locked: 0,
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
    ["draft", "closed"].includes(windowStatus);
  const canClose = hasWindow && selectedRestaurantId && !loading && windowStatus === "open";

  return (
    <section className="schedule-availability-panel">
      <div className="schedule-availability-panel__header">
        <div>
          <h3>
            <ClipboardList size={18} /> Đăng ký lịch nhân viên
          </h3>
          <p>Quản lý thời gian nhân viên đăng ký khả dụng trước khi xếp lịch.</p>
          <p>
            Kỳ đăng ký cho tuần {formatDateTime(targetWeekStart)} -{" "}
            {formatDateTime(targetWeekEnd)} ({mode === "currentWeek" ? "tuần đang xem" : "tuần kế tiếp"})
          </p>
        </div>
        <span className={`schedule-availability-panel__status is-${windowStatus}`}>
          {statusLabel}
        </span>
      </div>

      {error ? (
        <div className="schedule-availability-panel__empty">
          <h4>Không thể tải kỳ đăng ký</h4>
          <p>{error.message || "Đã có lỗi xảy ra."}</p>
        </div>
      ) : null}

      {!hasWindow ? (
        <div className="schedule-availability-panel__empty">
          <h4>Chưa có kỳ đăng ký khả dụng</h4>
          <p>
            Tạo kỳ đăng ký để nhân viên part-time đăng ký thời gian có thể làm và nhân
            viên full-time đăng ký ngày không khả dụng.
          </p>
          <button type="button" onClick={onCreateWindow} disabled={!canCreate}>
            {loading ? "Đang xử lý..." : "Tạo kỳ đăng ký tuần kế tiếp"}
          </button>
        </div>
      ) : (
        <>
          <div className="schedule-availability-panel__summary">
            <div>
              <span>Tuần áp dụng</span>
              <strong>
                {formatDateTime(availabilityWindow.periodStart)} - {formatDateTime(availabilityWindow.periodEnd)}
              </strong>
            </div>
            <div>
              <span>Thời gian mở đăng ký</span>
              <strong>{formatDateTime(availabilityWindow.openAt)}</strong>
            </div>
            <div>
              <span>Hạn đóng đăng ký</span>
              <strong>{formatDateTime(availabilityWindow.closeAt)}</strong>
            </div>
            <div>
              <span>Đối tượng</span>
              <strong>
                {(availabilityWindow.targetEmploymentTypes || [])
                  .map((value) => EMPLOYMENT_TYPE_LABELS[String(value || "").toLowerCase()])
                  .filter(Boolean)
                  .join(", ") || "Chưa thiết lập"}
              </strong>
            </div>
            <div>
              <span>Full-time đăng ký unavailable</span>
              <strong>{availabilityWindow.allowFullTimeUnavailableException ? "Có" : "Không"}</strong>
            </div>
            <div>
              <span>Kỳ tạo sẵn</span>
              <strong>
                {formatDateTime(nextWeekStart)} - {formatDateTime(nextWeekEnd)}
              </strong>
            </div>
          </div>

          <div className="schedule-availability-panel__actions">
            <button type="button" onClick={onOpenWindow} disabled={!canOpen}>
              {loading ? "Đang xử lý..." : "Mở đăng ký"}
            </button>
            <button type="button" onClick={onCloseWindow} disabled={!canClose}>
              {loading ? "Đang xử lý..." : "Đóng đăng ký"}
            </button>
            <button type="button" disabled>
              Xem submissions
            </button>
          </div>

          <div className="schedule-availability-panel__submissions">
            <h4>Tổng quan submissions</h4>
            <div className="metrics-grid">
              <span>Tổng submission: {submissionSummary.total}</span>
              <span>{SUBMISSION_STATUS_LABELS.pending}: {submissionSummary.pending}</span>
              <span>{SUBMISSION_STATUS_LABELS.submitted}: {submissionSummary.submitted}</span>
              <span>{SUBMISSION_STATUS_LABELS.approved}: {submissionSummary.approved}</span>
              <span>{SUBMISSION_STATUS_LABELS.rejected}: {submissionSummary.rejected}</span>
              <span>{SUBMISSION_STATUS_LABELS.locked}: {submissionSummary.locked}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
