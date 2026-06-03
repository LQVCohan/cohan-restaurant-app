import React from "react";
import "./StaffPerformance.scss";

const resolveScoreStatus = (score = 0) => {
  if (score >= 90) return "Tốt";
  if (score >= 70) return "Ổn định";
  if (score >= 50) return "Cần chú ý";
  return "Cần hỗ trợ";
};

const getScoreTone = (score = 0) => {
  if (score >= 70) return "success";
  if (score >= 50) return "warning";
  return "danger";
};

const StaffPerformanceSummaryCards = ({ summary }) => {
  const score = Number(summary?.finalPerformanceScore || 0);
  const cards = [
    { label: "Điểm hiện tại", value: score, hint: resolveScoreStatus(score), tone: getScoreTone(score) },
    { label: "Tổng điểm thay đổi", value: Number(summary?.totalScoreDelta || 0), hint: "Trong kỳ này", tone: "neutral" },
    { label: "Cần xem lại", value: Number(summary?.pendingReviewIncidentCount || 0), hint: "Sự kiện chờ xử lý", tone: "warning" },
    { label: "Đã áp điểm", value: Number(summary?.appliedIncidentCount || 0), hint: "Có ghi nhận chính thức", tone: "neutral" },
    { label: "Đã miễn trừ", value: Number(summary?.waivedIncidentCount || 0), hint: "Không tính lỗi", tone: "success" },
  ];

  return (
    <section className="staff-performance-summary-cards" aria-label="Tóm tắt hiệu suất cá nhân">
      {cards.map((card) => (
        <article key={card.label} className={`staff-performance-card staff-performance-card--${card.tone}`}>
          <div className="staff-performance-card__label">{card.label}</div>
          <div className="staff-performance-card__value">{card.value}</div>
          {card.hint ? <div className="staff-performance-card__hint">{card.hint}</div> : null}
        </article>
      ))}
    </section>
  );
};

export default StaffPerformanceSummaryCards;
