import React from "react";
import { Wallet, Activity, Ticket, Flame } from "lucide-react";
import "./StatsCard.scss";

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCompactCurrency = (value) => {
  const amount = toSafeNumber(value);
  if (Math.abs(amount) >= 1000000) return `₫${(amount / 1000000).toFixed(1)}M`;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value) => {
  const percent = toSafeNumber(value);
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

const StatsCard = ({ stats = {}, labels = {} }) => {
  const totalSavings = toSafeNumber(stats.totalSavings);
  const usageRate = toSafeNumber(stats.usageRate);
  const totalUsage = toSafeNumber(stats.totalUsage);
  const hotPromotions = toSafeNumber(stats.hotPromotions);

  const statItems = [
    {
      key: "savings",
      label: labels.savings || "Chi phí giảm giá",
      helper: labels.savingsHelper || "Tổng tiền ưu đãi đã ghi nhận",
      value: formatCompactCurrency(totalSavings),
      icon: <Wallet size={22} />,
      colorClass: "green",
    },
    {
      key: "usage",
      label: labels.usage || "Tỷ lệ sử dụng",
      helper: labels.usageHelper || "Tỷ lệ redeem trên lượng phát hành",
      value: formatPercent(usageRate),
      icon: <Activity size={22} />,
      colorClass: "blue",
    },
    {
      key: "total",
      label: labels.total || "Tổng lượt dùng",
      helper: labels.totalHelper || "Lượt dùng hợp lệ trong hệ thống",
      value: totalUsage.toLocaleString("vi-VN"),
      icon: <Ticket size={22} />,
      colorClass: "purple",
    },
    {
      key: "hot",
      label: labels.hot || "Đang thịnh hành",
      helper: labels.hotHelper || "Ưu đãi có dữ liệu cần theo dõi",
      value: hotPromotions.toLocaleString("vi-VN"),
      icon: <Flame size={22} />,
      colorClass: "orange",
    },
  ];

  return (
    <div className="stats-overview-grid" aria-label="Chỉ số khuyến mãi">
      {statItems.map((item) => (
        <article key={item.key} className={`stat-card-premium ${item.colorClass}`}>
          <div className="stat-content">
            <span className="stat-label">{item.label}</span>
            <h3 className="stat-value">{item.value}</h3>
            <p className="stat-helper">{item.helper}</p>
          </div>
          <div className="stat-icon-wrapper" aria-hidden="true">{item.icon}</div>
        </article>
      ))}
    </div>
  );
};

export default StatsCard;
