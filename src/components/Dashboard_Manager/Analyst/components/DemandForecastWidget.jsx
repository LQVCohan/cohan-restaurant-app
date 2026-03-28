import React from "react";
import { Clock3, ChefHat, TrendingUp, AlertTriangle, Users } from "lucide-react";
import "./DemandForecastWidget.scss";

const toShortNumber = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const DemandForecastWidget = ({ forecast, loading }) => {
  const summary = forecast?.summary || {};
  const rising = forecast?.risingDishes || [];
  const prepPlan = forecast?.prepPlan || [];
  const busiest = summary?.busiestPeriods || [];

  const topSlot = forecast?.hourlyForecast?.length
    ? [...forecast.hourlyForecast].sort((a, b) => b.expectedOrders - a.expectedOrders)[0]
    : null;

  return (
    <div className="widget-card demand-forecast-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap">
            <Clock3 size={18} />
          </div>
          <div>
            <h3>Dự báo nhu cầu V1</h3>
            <p>Giờ đông, món tăng, kế hoạch prep</p>
          </div>
        </div>
        <span className={`meta-pill ${forecast?.meta?.fallbackUsed ? "fallback" : "data"}`}>
          {forecast?.meta?.fallbackUsed ? "Fallback" : "Data+AI"}
        </span>
      </div>

      {loading ? (
        <div className="state-message">Đang tính forecast từ dữ liệu đơn hàng...</div>
      ) : null}

      {!loading && !forecast?.hourlyForecast?.length ? (
        <div className="state-message warning">Chưa đủ dữ liệu lịch sử để dự báo chi tiết.</div>
      ) : null}

      {!loading && forecast?.hourlyForecast?.length ? (
        <>
          <div className="insight-grid">
            <div className="insight-card">
              <div className="icon-row">
                <TrendingUp size={16} />
                <span>Khung giờ đông nhất</span>
              </div>
              <strong>{busiest[0] || topSlot?.slot || "N/A"}</strong>
              <p>
                {topSlot
                  ? `~${toShortNumber(topSlot.expectedOrders)} đơn • ${toShortNumber(topSlot.expectedGuests)} khách • ${toShortNumber(topSlot.suggestedStaff)} NV`
                  : "Chưa đủ dữ liệu"}
              </p>
            </div>

            <div className="insight-card">
              <div className="icon-row">
                <Users size={16} />
                <span>Khung giờ dự phòng</span>
              </div>
              <strong>{busiest[1] || "Đang cập nhật"}</strong>
              <p>
                {forecast?.dailyForecast?.[0]
                  ? `Peak hôm nay: ${forecast.dailyForecast[0].peakWindow}`
                  : "Dựa trên đơn + reservation gần nhất"}
              </p>
            </div>
          </div>

          <div className="list-section">
            <h4>
              <TrendingUp size={16} /> Top món có xu hướng tăng
            </h4>
            <ul>
              {rising.slice(0, 4).map((dish) => (
                <li key={dish.dishId}>
                  <div className="dish-main">
                    <span className="dish-name">{dish.dishName}</span>
                    <span className="dish-uplift">+{toShortNumber(dish.upliftPct)}%</span>
                  </div>
                  <div className="dish-sub">
                    Forecast {toShortNumber(dish.forecastQty)} • Prep {toShortNumber(dish.suggestedPrepQty)}
                    {dish.stockRisk === "high" ? (
                      <span className="risk high">
                        <AlertTriangle size={14} /> tồn kho rủi ro cao
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="list-section">
            <h4>
              <ChefHat size={16} /> Kế hoạch prep đề xuất
            </h4>
            <ul>
              {prepPlan.slice(0, 4).map((item) => (
                <li key={`${item.dishId}-${item.dishName}`}>
                  <div className="dish-main">
                    <span className="dish-name">{item.dishName}</span>
                    <span className="dish-uplift">{toShortNumber(item.suggestedPrepQty)} suất</span>
                  </div>
                  <div className="dish-sub">{item.inventoryNote || item.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default DemandForecastWidget;
