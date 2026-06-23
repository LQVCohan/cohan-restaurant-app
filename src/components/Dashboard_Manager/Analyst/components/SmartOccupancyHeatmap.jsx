import React from "react";
import { ArrowRight, Grid3X3 } from "lucide-react";
import "./SmartOccupancyHeatmap.scss";

const SmartOccupancyHeatmap = ({ points = [], loading }) => {
  const hours = [...new Set(points.map((p) => p.hourLabel))];
  const days = [...new Set(points.map((p) => p.dayLabel))];
  const byKey = new Map(points.map((p) => [`${p.dayLabel}-${p.hourLabel}`, p]));
  const hasHeatmapData = points.some((p) => Number(p.occupancyRate || 0) > 0);
  const goOrders = () => window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: "orders", source: "manager-analytics" } }));

  return (
    <div className="widget-card smart-heatmap-widget">
      <div className="widget-header">
        <div className="header-info">
          <h4>Mật độ và dự báo</h4>
        </div>
      </div>
      <div className="heatmap-scroll-wrapper">
        {loading ? (
          <div className="empty-state">Đang tải...</div>
        ) : hasHeatmapData ? (
          <div className="heatmap-grid">
            <div className="grid-cell header-corner"></div>
            {hours.map((h) => (
              <div key={h} className="grid-cell header-hour">
                {h}
              </div>
            ))}
            {days.map((day) => (
              <React.Fragment key={day}>
                <div className="grid-cell row-label">
                  <span className="lbl-day">{day}</span>
                </div>
                {hours.map((hour) => {
                  const data = byKey.get(`${day}-${hour}`) || {
                    occupancyRate: 0,
                    staffRequired: 2,
                  };
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="grid-cell data-cell"
                      style={{ "--bg-opacity": Math.max(0.1, data.occupancyRate) }}
                    >
                      <div className="cell-bg"></div>
                      <div className="cell-tooltip">
                        <div className="tt-stat">Khách: {Math.round((data.occupancyRate || 0) * 100)}%</div>
                        <div className="tt-stat">Cần: {data.staffRequired} NV</div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="empty-state compact analytics-action-empty">
            <Grid3X3 size={16} />
            <strong>Chưa đủ dữ liệu mật độ</strong>
            <p>Cần thêm đơn theo nhiều khung giờ để phân tích chính xác.</p>
            <button type="button" className="widget-cta" onClick={goOrders}>Xem đơn hàng <ArrowRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartOccupancyHeatmap;
