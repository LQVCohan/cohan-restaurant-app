import React from "react";
import { TrendingUp, TrendingDown, Minus, Medal } from "lucide-react";
import "./ProductPerformanceItem.scss";

const ProductPerformanceItem = ({
  rank,
  name,
  image,
  category,
  soldCount,
  revenue,
  trend,
  contribution, // Tỷ lệ % đóng góp doanh thu (tùy chọn)
}) => {
  const isPositive = parseFloat(trend) > 0;

  // Hàm xử lý hiển thị Badge xếp hạng
  const renderRankBadge = (rank) => {
    if (rank === 1)
      return (
        <div className="rank-badge gold">
          <Medal size={16} />
        </div>
      );
    if (rank === 2)
      return (
        <div className="rank-badge silver">
          <Medal size={16} />
        </div>
      );
    if (rank === 3)
      return (
        <div className="rank-badge bronze">
          <Medal size={16} />
        </div>
      );
    return <div className="rank-badge normal">{rank}</div>;
  };

  // Format tiền tệ
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);
  };

  return (
    <div className="product-performance-item">
      <div className="left-section">
        {/* Cột 1: Xếp hạng */}
        <div className="rank-column">{renderRankBadge(rank)}</div>

        {/* Cột 2: Ảnh & Thông tin */}
        <div className="product-info">
          <div className="product-thumb">
            <img src={image || "https://via.placeholder.com/50"} alt={name} />
          </div>
          <div className="product-details">
            <h4 className="product-name">{name}</h4>
            <span className="product-category">{category}</span>
          </div>
        </div>
      </div>

      <div className="right-section">
        {/* Cột 3: Doanh số & Số lượng */}
        <div className="sales-metrics">
          <span className="revenue-text">{formatCurrency(revenue)}</span>
          <span className="sold-text">{soldCount} đã bán</span>
        </div>

        {/* Cột 4: Trend & Contribution Bar */}
        <div className="trend-column">
          <div className={`trend-badge ${isPositive ? "up" : "down"}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
          {/* Thanh hiển thị mức độ đóng góp doanh thu */}
          <div className="contribution-track" title="Tỷ trọng doanh thu">
            <div
              className="contribution-fill"
              style={{ width: `${contribution}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPerformanceItem;
