import React from "react";

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
      {timeline.map((point, idx) => (
        <article key={`${point.adjustmentId || idx}-${point.date}`} className="staff-timeline-item">
          <time dateTime={point.date}>{new Date(point.date).toLocaleString("vi-VN")}</time>
          <strong>Điểm: {point.score} ({point.scoreDelta >= 0 ? "+" : ""}{point.scoreDelta || 0})</strong>
          <span>Sự kiện: {point.eventType || "Không có nhãn"}</span>
          {point.note ? <p>{point.note}</p> : null}
        </article>
      ))}
    </div>
  );
};

export default StaffPerformanceTimeline;
