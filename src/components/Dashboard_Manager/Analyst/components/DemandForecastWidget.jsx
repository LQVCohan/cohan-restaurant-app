import React from "react";
import { Clock3, ChefHat, TrendingUp, AlertTriangle, Users } from "lucide-react";
import "./DemandForecastWidget.scss";

const toShortNumber = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const methodLabel = (method = "") => ({
  time_series_v1: "Dựa trên lịch sử đơn hàng",
  demand_forecast_v1: "Dựa trên nhu cầu theo giờ",
}[method] || "Dựa trên dữ liệu vận hành");

const MetaStrip = ({ meta }) => {
  if (!meta) return null;
  const lowData = meta.lowDataFallbackUsed || meta.fallbackUsed || Number(meta.sampleOrders || 0) < 20;
  return (
    <div className="ai-meta-strip">
      {lowData ? <span className="verify-badge">Cần kiểm tra lại</span> : null}
      <span>{methodLabel(meta.method)}</span>
      <span>{meta.sampleOrders ?? "-"} đơn trong {meta.sampleDays ?? "-"} ngày</span>
      {meta.generatedAt ? <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span> : null}
    </div>
  );
};

const DemandForecastWidget = ({ forecast, loading, onNavigate }) => {
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
            <h3>Dự báo nhu cầu</h3>
            <p>Giờ đông, món tăng, kế hoạch chuẩn bị món</p>
          </div>
        </div>
        <span className={`meta-pill ${forecast?.meta?.fallbackUsed ? "fallback" : "data"}`}>
          {forecast?.meta?.fallbackUsed ? "Tham khảo" : "Dự báo theo đơn"}
        </span>
      </div>
      <MetaStrip meta={forecast?.meta} />

      {loading ? (
        <div className="state-message">Đang tính dự báo từ dữ liệu đơn hàng...</div>
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
                  ? `~${toShortNumber(topSlot.expectedOrders)} đơn • ${toShortNumber(topSlot.expectedGuests)} khách • ${toShortNumber(topSlot.suggestedStaff)} nhân sự`
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
                  ? `Cao điểm hôm nay: ${forecast.dailyForecast[0].peakWindow}`
                  : "Dựa trên đơn và đặt bàn gần nhất"}
              </p>
            </div>
          </div>

          <div className="list-section">
            <h4>
              <TrendingUp size={16} /> Món có xu hướng tăng
            </h4>
            <ul>
              {rising.slice(0, 4).map((dish) => (
                <li key={dish.dishId}>
                  <div className="dish-main">
                    <span className="dish-name">{dish.dishName}</span>
                    <span className="dish-uplift">+{toShortNumber(dish.upliftPct)}%</span>
                  </div>
                  <div className="dish-sub">
                    Dự báo {toShortNumber(dish.forecastQty)} suất • Chuẩn bị {toShortNumber(dish.suggestedPrepQty)} suất
                    {dish.stockRisk === "high" ? (
                      <button type="button" className="risk high" onClick={() => onNavigate?.("inventory", { dishId: dish.dishId })}>
                        <AlertTriangle size={14} /> tồn kho rủi ro cao
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="list-section">
            <h4>
              <ChefHat size={16} /> Kế hoạch chuẩn bị
            </h4>
            <ul>
              {prepPlan.slice(0, 4).map((item) => (
                <li key={`${item.dishId}-${item.dishName}`}>
                  <div className="dish-main">
                    <span className="dish-name">{item.dishName}</span>
                    <span className="dish-uplift">{toShortNumber(item.suggestedPrepQty)} suất</span>
                  </div>
                  <div className="dish-sub">{(item.inventoryNote || item.reason || "").replace(/fallback theo orderCounter/gi, "ước tính từ dữ liệu đơn gần đây").replace(/orderCounter/gi, "dữ liệu đơn gần đây")}</div>
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
