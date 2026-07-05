import React from "react";

const formatTimelineDate = (value) => {
  if (!value) return "Không rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
  return date.toLocaleString("vi-VN");
};

const StaffPerformanceTimeline = ({ timeline = [] }) => {
  if (!timeline.length) {
    return (
      <div className="staff-performance-empty">
        <h3>Chưa có thay đổi điểm trong kỳ này</h3>
        <p>Nếu có sự kiện mới, timeline sẽ hiển thị ngày, mức thay đổi và ghi chú.</p>
      </div>
    );
  }

  return (
    <div className="staff-performance-section staff-performance-timeline">
      {timeline.map((point, idx) => {
        const occurredAt = point.at || point.date || null;
        return (
          <article
            key={`${point.incidentId || point.adjustmentId || idx}-${occurredAt || idx}`}
            className="staff-timeline-item"
          >
            <time dateTime={occurredAt || undefined}>{formatTimelineDate(occurredAt)}</time>
            <strong>
              Điểm: {point.score} ({point.scoreDelta >= 0 ? "+" : ""}{point.scoreDelta || 0})
            </strong>
            <span>Sự kiện: {point.eventType || "Không có nhãn"}</span>
            {point.note ? <p>{point.note}</p> : null}
          </article>
        );
      })}
    </div>
  );
};

export default StaffPerformanceTimeline;
