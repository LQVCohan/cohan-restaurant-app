import React from "react";
import "./StaffPerformance.scss";

const resolveScoreStatus = (score = 0) => {
  if (score >= 90) return "Tốt";
  if (score >= 70) return "Ổn định";
  if (score >= 50) return "Cần cải thiện";
  return "Rủi ro cao";
};

const StaffPerformanceSummaryCards = ({ summary }) => {
  const score = Number(summary?.finalPerformanceScore || 0);
  const cards = [
    { label: "Điểm hiện tại", value: score, hint: resolveScoreStatus(score) },
    { label: "Tổng điểm thay đổi", value: Number(summary?.totalScoreDelta || 0) },
    { label: "Incident chờ xử lý", value: Number(summary?.pendingReviewIncidentCount || 0) },
    { label: "Incident đã áp điểm", value: Number(summary?.appliedIncidentCount || 0) },
    { label: "Incident miễn trừ", value: Number(summary?.waivedIncidentCount || 0) },
  ];

  return (
    <div className="staff-performance-summary-cards">
      {cards.map((card) => (
        <div key={card.label} className="staff-performance-card">
          <div className="staff-performance-card__label">{card.label}</div>
          <div className="staff-performance-card__value">{card.value}</div>
          {card.hint ? <div className="staff-performance-card__hint">{card.hint}</div> : null}
        </div>
      ))}
    </div>
  );
};

export default StaffPerformanceSummaryCards;
