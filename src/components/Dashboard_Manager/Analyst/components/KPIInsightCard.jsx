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
  period,
  progress,
  icon: Icon,
  color = "#c5a47e", // Default Gold
}) => {
  const isPositive = parseFloat(trendValue) > 0;
  const isNeutral = parseFloat(trendValue) === 0;

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
        <div
          className={`trend-badge ${
            isPositive ? "up" : isNeutral ? "flat" : "down"
          }`}
        >
          {renderTrendIcon()}
          <span>{Math.abs(trendValue)}%</span>
        </div>
      </div>

      <div className="card-body">
        <h3 className="kpi-value">{value}</h3>
        <p className="kpi-label">{label}</p>
      </div>

      <div className="card-footer">
        {/* Progress Bar: Theo dõi mục tiêu */}
        <div className="target-section">
          <div className="target-info">
            <div className="target-label">
              <Target size={12} />
              <span>Tiến độ mục tiêu</span>
            </div>
            <span className="target-percent">{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%`, backgroundColor: color }}
            ></div>
          </div>
        </div>

        <p className="comparison-text">{period}</p>
      </div>
    </div>
  );
};

export default KPIInsightCard;
