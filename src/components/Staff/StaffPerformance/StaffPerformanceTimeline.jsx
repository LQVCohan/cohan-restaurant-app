import React from "react";

const StaffPerformanceTimeline = ({ timeline = [] }) => {
  if (!timeline.length) return <p>Chưa có thay đổi điểm trong kỳ này.</p>;

  return (
    <div className="staff-performance-section">
      {timeline.map((point, idx) => (
        <div key={`${point.adjustmentId || idx}-${point.date}`} className="staff-timeline-item">
          <div>{new Date(point.date).toLocaleString("vi-VN")}</div>
          <div>Điểm: {point.score} ({point.scoreDelta >= 0 ? "+" : ""}{point.scoreDelta || 0})</div>
          <div>Sự kiện: {point.eventType || "N/A"}</div>
          {point.note ? <div>Ghi chú: {point.note}</div> : null}
        </div>
      ))}
    </div>
  );
};

export default StaffPerformanceTimeline;
