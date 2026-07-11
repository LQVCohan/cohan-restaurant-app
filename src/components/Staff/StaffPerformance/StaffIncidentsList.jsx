import React from "react";

const RESPONSIBILITY_LABELS = {
  pending_review: "Chờ xem lại",
  no_fault: "Không lỗi",
  staff_responsible: "Nhân viên chịu trách nhiệm",
  manager_responsible: "Quản lý chịu trách nhiệm",
  system_responsible: "Lỗi hệ thống",
  shared: "Chia sẻ trách nhiệm",
};
const SCORE_IMPACT_LABELS = {
  not_applicable: "Không áp dụng",
  pending: "Chờ xử lý",
  eligible: "Có thể áp điểm",
  applied: "Đã áp điểm",
  waived: "Đã miễn trừ",
};
const SEVERITY_LABELS = {
  info: "Thông tin",
  warning: "Cảnh báo",
  violation: "Vi phạm",
  critical: "Nghiêm trọng",
};
const APPEAL_STATUS_LABELS = {
  submitted: "Đã gửi",
  under_review: "Đang xem xét",
  needs_more_info: "Cần bổ sung",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const OPEN_STATUSES = ["submitted", "under_review", "needs_more_info"];

const getSeverityTone = (severity) => {
  if (["critical", "violation"].includes(severity)) return "danger";
  if (severity === "warning") return "warning";
  return "muted";
};

const StaffIncidentsList = ({ incidents = [], appeals = [], onAppeal }) => {
  if (!incidents.length) {
    return (
      <div className="staff-performance-empty">
        <h3>Chưa có dữ liệu hiệu suất trong kỳ này.</h3>
        <p>Bạn không có sự kiện cần xem lại ở kỳ hiện tại.</p>
      </div>
    );
  }

  return (
    <div className="staff-performance-section">
      {incidents.map((item) => {
        const incidentAppeals = appeals.filter((appeal) => appeal.incidentId === item.id);
        const hasOpenAppeal = incidentAppeals.some((appeal) => OPEN_STATUSES.includes(appeal.status));
        const latestAppeal = incidentAppeals[0];
        const isAttendanceIncident = String(item.eventType || "").startsWith("ATTENDANCE_");
        return (
          <article key={item.id} className={`staff-incident-item staff-incident-item--${getSeverityTone(item.severity)}`}>
            <div className="staff-incident-item__header">
              <h3>{item.eventType || "Sự kiện"}</h3>
              <span>Mức độ: {SEVERITY_LABELS[item.severity] || item.severity || "Thông tin"}</span>
            </div>
            <p className="staff-incident-item__context">Trách nhiệm: {RESPONSIBILITY_LABELS[item.responsibilityStatus] || item.responsibilityStatus || "-"}</p>
            <dl>
              <div><dt>Trách nhiệm</dt><dd>{RESPONSIBILITY_LABELS[item.responsibilityStatus] || item.responsibilityStatus || "-"}</dd></div>
              <div><dt>Trạng thái điểm</dt><dd>{isAttendanceIncident ? "Đã tính trong Đúng giờ" : SCORE_IMPACT_LABELS[item.scoreImpactStatus] || item.scoreImpactStatus || "-"}</dd></div>
              <div><dt>Điểm đề xuất</dt><dd>{isAttendanceIncident ? 0 : item.proposedScoreDelta ?? "-"}</dd></div>
              <div><dt>Điểm áp dụng</dt><dd>{item.scoreDelta ?? "-"}</dd></div>
              <div><dt>Thời điểm</dt><dd>{item.occurredAt ? new Date(item.occurredAt).toLocaleString("vi-VN") : "-"}</dd></div>
            </dl>
            {isAttendanceIncident ? (
              <p>Chấm công này đã được dùng trong thành phần Đúng giờ; incident không trừ điểm thêm.</p>
            ) : null}
            <p>{item.reviewNote || item.waiveReason || item.applyNote || item.note || "Chưa có ghi chú."}</p>
            {latestAppeal ? <p className="staff-incident-item__appeal">Trạng thái phản hồi: {APPEAL_STATUS_LABELS[latestAppeal.status] || latestAppeal.status}</p> : null}
            {latestAppeal?.scoreReversalStatus === "reversed" ? <p className="staff-incident-item__appeal"><strong>Đã hoàn điểm</strong>: +{latestAppeal?.scoreReversalDelta || 0}</p> : null}
            {!hasOpenAppeal && item.scoreImpactStatus !== "not_applicable" ? <button type="button" onClick={() => onAppeal?.(item.id)}>Phản hồi sự kiện này</button> : null}
          </article>
        );
      })}
    </div>
  );
};

export default StaffIncidentsList;
