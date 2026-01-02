import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import "./ServiceAnalyticItem.scss";

/**
 * ServiceAnalyticItem - Component hiển thị hiệu suất từng loại hình dịch vụ
 * * @param {Object} props
 * @param {string} props.label - Tên dịch vụ (VD: Ăn tại chỗ)
 * @param {string} props.value - Giá trị chính (VD: Doanh thu)
 * @param {string} props.subValue - Giá trị phụ (VD: Số đơn)
 * @param {number} props.percentage - Tỷ trọng (0-100)
 * @param {number} props.trend - % Tăng trưởng (số dương hoặc âm)
 * @param {Object} props.icon - Lucide Icon Component
 * @param {string} props.color - Mã màu chủ đạo (hex hoặc biến scss)
 */
const ServiceAnalyticItem = ({
  label,
  value,
  subValue,
  percentage,
  trend,
  icon: Icon,
  color = "#c5a47e", // Default Gold
}) => {
  // Xác định trạng thái trend
  const isPositive = parseFloat(trend) > 0;
  const isNeutral = parseFloat(trend) === 0;

  return (
    <div className="service-analytic-item">
      {/* Phần trên: Icon & Info */}
      <div className="item-header">
        <div className="left-section">
          <div
            className="icon-box"
            style={{ backgroundColor: `${color}15`, color: color }} // 15 là độ mờ opacity hex
          >
            <Icon size={20} />
          </div>
          <div className="info-box">
            <h4 className="service-label">{label}</h4>
            <div className="service-metrics">
              <span className="primary-value">{value}</span>
              <span className="separator">•</span>
              <span className="sub-value">{subValue}</span>
            </div>
          </div>
        </div>

        <div className="right-section">
          <div className="percentage-display">
            <span className="percent-text">{percentage}%</span>
          </div>
          <div
            className={`trend-badge ${
              isPositive ? "up" : isNeutral ? "flat" : "down"
            }`}
          >
            {isPositive ? (
              <TrendingUp size={14} />
            ) : isNeutral ? (
              <Minus size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        </div>
      </div>

      {/* Phần dưới: Progress Bar trực quan */}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        ></div>
      </div>
    </div>
  );
};

export default ServiceAnalyticItem;
