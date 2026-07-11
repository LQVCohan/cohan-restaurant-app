import React, { useMemo } from "react";
import { ArrowRight, Grid3X3 } from "lucide-react";
import "./SmartOccupancyHeatmap.scss";

const DAY_ORDER = { T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6, CN: 7 };

const goOrders = () =>
  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: { page: "orders", source: "manager-analytics" },
    }),
  );

const SmartOccupancyHeatmap = ({ points = [], loading }) => {
  const safePoints = Array.isArray(points) ? points : [];
  const hours = useMemo(
    () =>
      [...new Set(safePoints.map((point) => point?.hourLabel).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right, "vi"),
      ),
    [safePoints],
  );
  const days = useMemo(
    () =>
      [...new Set(safePoints.map((point) => point?.dayLabel).filter(Boolean))].sort(
        (left, right) =>
          (DAY_ORDER[left] ?? 99) - (DAY_ORDER[right] ?? 99) ||
          left.localeCompare(right, "vi"),
      ),
    [safePoints],
  );
  const byKey = useMemo(
    () =>
      new Map(
        safePoints.map((point) => [
          `${point?.dayLabel}-${point?.hourLabel}`,
          point,
        ]),
      ),
    [safePoints],
  );
  const peakPoint = useMemo(
    () =>
      safePoints.reduce(
        (current, point) =>
          Number(point?.occupancyRate || 0) > Number(current?.occupancyRate || 0)
            ? point
            : current,
        null,
      ),
    [safePoints],
  );
  const hasHeatmapData =
    hours.length > 0 &&
    days.length > 0 &&
    safePoints.some((point) => Number(point?.occupancyRate || 0) > 0);

  return (
    <div className="widget-card smart-heatmap-widget">
      <div className="widget-header">
        <div className="header-info">
          <h4>Mật độ theo khung giờ</h4>
          <span className="subtitle">Tỷ lệ lấp đầy và nhân sự gợi ý theo ngày</span>
        </div>
        {hasHeatmapData ? (
          <div className="heatmap-peak" aria-label="Mức mật độ cao nhất">
            <span>Cao nhất</span>
            <strong>{Math.round(Number(peakPoint?.occupancyRate || 0) * 100)}%</strong>
          </div>
        ) : null}
      </div>

      <div className="heatmap-scroll-wrapper">
        {loading ? (
          <div className="empty-state compact heatmap-loading" role="status">
            Đang tải mật độ vận hành...
          </div>
        ) : hasHeatmapData ? (
          <div
            className="heatmap-grid"
            style={{ "--heatmap-columns": Math.max(hours.length, 1) }}
            data-testid="occupancy-heatmap-grid"
          >
            <div className="grid-cell header-corner">Ngày</div>
            {hours.map((hour) => (
              <div key={hour} className="grid-cell header-hour">
                {hour}
              </div>
            ))}

            {days.map((day) => (
              <React.Fragment key={day}>
                <div className="grid-cell row-label">
                  <span className="lbl-day">{day}</span>
                </div>
                {hours.map((hour) => {
                  const data = byKey.get(`${day}-${hour}`);
                  const occupancyRate = Number(data?.occupancyRate || 0);
                  const percentage = Math.round(occupancyRate * 100);
                  const staffRequired = Math.max(0, Number(data?.staffRequired || 0));
                  const hasValue = Boolean(data) && occupancyRate > 0;

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`grid-cell data-cell ${hasValue ? "has-value" : "is-empty"}`}
                      style={{ "--heat-level": Math.max(0.08, Math.min(1, occupancyRate)) }}
                      role="img"
                      tabIndex={0}
                      aria-label={
                        hasValue
                          ? `${day}, ${hour}: mật độ ${percentage} phần trăm, cần ${staffRequired} nhân viên`
                          : `${day}, ${hour}: chưa có dữ liệu mật độ`
                      }
                    >
                      <span className="cell-rate">{hasValue ? `${percentage}%` : "—"}</span>
                      <span className="cell-staff">
                        {hasValue ? `${staffRequired} NV` : "Chưa ghi nhận"}
                      </span>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="empty-state compact analytics-action-empty">
            <Grid3X3 size={18} />
            <strong>Chưa đủ dữ liệu mật độ</strong>
            <p>Cần thêm đơn ở nhiều khung giờ để so sánh công suất theo ngày.</p>
            <button type="button" className="widget-cta" onClick={goOrders}>
              Xem đơn hàng <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartOccupancyHeatmap;
