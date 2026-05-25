import React from "react";
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import "./KPIInsightCard.scss";

/**
 * KPIInsightCard - Thẻ hiển thị chỉ số quan trọng
 * @param {string} label - Tên chỉ số (VD: Tổng Doanh Thu)
 * @param {string|number} value - Giá trị chính (VD: 1.2 Tỷ)
 * @param {number} trendValue - % Thay đổi (VD: 12.5)
 * @param {string} period - Kỳ so sánh (VD: "so với tháng trước")
 * @param {number} progress - % Hoàn thành mục tiêu (0-100)
 * @param {Object} icon - Lucide Icon
 * @param {string} color - Màu chủ đạo (Gold, Blue, Green...)
 */
const KPIInsightCard = ({
  label,
  value,
  trendValue,
  showTrend = true,
  period,
  progress,
  progressLabel = "Tiến độ mục tiêu",
  icon: Icon,
  color = "#c5a47e", // Default Gold
}) => {
  const hasTrendValue = typeof trendValue === "number" && Number.isFinite(trendValue);
  const normalizedTrend = hasTrendValue ? trendValue : 0;
  const isPositive = normalizedTrend > 0;
  const isNeutral = normalizedTrend === 0;
  const hasProgress = progress !== null && progress !== undefined;
  const hasComparableBaseline = !period?.toLowerCase().includes("chưa có kỳ so sánh");
  const shouldShowTrend = showTrend !== false && hasComparableBaseline && hasTrendValue;

  // Render icon xu hướng
  const renderTrendIcon = () => {
    if (isPositive) return <TrendingUp size={16} />;
    if (isNeutral) return <Minus size={16} />;
    return <TrendingDown size={16} />;
  };

  return (
    <div className="kpi-insight-card">
      {/* Background Decor (Vòng tròn mờ trang trí) */}
      <div
        className="card-decor"
        style={{
          background: `radial-gradient(circle at top right, ${color}20, transparent 70%)`,
        }}
      ></div>

      <div className="card-header">
        <div
          className="icon-wrapper"
          style={{ color: color, backgroundColor: `${color}15` }}
        >
          <Icon size={24} />
        </div>

        {/* Badge xu hướng */}
        {shouldShowTrend ? (
          <div
            className={`trend-badge ${
              isPositive ? "up" : isNeutral ? "flat" : "down"
            }`}
          >
            {renderTrendIcon()}
            <span>{Math.abs(normalizedTrend)}%</span>
          </div>
        ) : null}
      </div>

      <div className="card-body">
        <h3 className="kpi-value">{value}</h3>
        <p className="kpi-label">{label}</p>
      </div>

      <div className="card-footer">
        {hasProgress ? <div className="target-section">
          <div className="target-info">
            <div className="target-label">
              <Target size={12} />
              <span>{progressLabel}</span>
            </div>
            <span className="target-percent">{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%`, backgroundColor: color }}
            ></div>
          </div>
        </div> : null}

        <p className="comparison-text">{period}</p>
      </div>
    </div>
  );
};

export default KPIInsightCard;
