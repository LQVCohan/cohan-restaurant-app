import React from "react";

const RESPONSIBILITY_LABELS = {
  pending_review: "Chờ review",
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

const OPEN_STATUSES = ["submitted", "under_review", "needs_more_info"];

const StaffIncidentsList = ({ incidents = [], appeals = [], onAppeal }) => {
  if (!incidents.length) return <p>Chưa có dữ liệu hiệu suất trong kỳ này.</p>;

  return (
    <div className="staff-performance-section">
      {incidents.map((item) => {
        const incidentAppeals = appeals.filter((a) => a.incidentId === item.id);
        const hasOpenAppeal = incidentAppeals.some((a) => OPEN_STATUSES.includes(a.status));
        return (
        <article key={item.id} className="staff-incident-item">
          <h4>{item.eventType || "Sự kiện"}</h4>
          <p>Mức độ: {SEVERITY_LABELS[item.severity] || item.severity || "-"}</p>
          <p>Trách nhiệm: {RESPONSIBILITY_LABELS[item.responsibilityStatus] || item.responsibilityStatus || "-"}</p>
          <p>Trạng thái áp điểm: {SCORE_IMPACT_LABELS[item.scoreImpactStatus] || item.scoreImpactStatus || "-"}</p>
          <p>Điểm đề xuất: {item.proposedScoreDelta ?? "-"} | Điểm áp dụng: {item.scoreDelta ?? "-"}</p>
          <p>Thời điểm: {item.occurredAt ? new Date(item.occurredAt).toLocaleString("vi-VN") : "-"}</p>
          <p>Ghi chú: {item.reviewNote || item.waiveReason || item.applyNote || item.note || "-"}</p>
        {incidentAppeals[0] ? <p>Trạng thái phản hồi: {incidentAppeals[0].status}</p> : null}
        {incidentAppeals[0]?.scoreReversalStatus === "reversed" ? <p><strong>Đã hoàn điểm</strong>: +{incidentAppeals[0]?.scoreReversalDelta || 0}</p> : null}
          {!hasOpenAppeal && item.scoreImpactStatus !== "not_applicable" ? <button type="button" onClick={() => onAppeal?.(item.id)}>Khiếu nại</button> : null}
        </article>
      );})}
    </div>
  );
};

export default StaffIncidentsList;
