import React from "react";
import { Sparkles, Target, CircleDollarSign, TrendingUp, LayoutGrid } from "lucide-react";
import "./MenuEngineeringAssistantWidget.scss";

const nf = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const quadrantLabel = {
  star: "Chủ lực",
  plowhorse: "Bán tốt, lời thấp",
  puzzle: "Lời cao, bán chậm",
  dog: "Cần xem lại",
};
const methodLabel = (method = "") => ({
  menu_engineering_v1: "Dựa trên doanh thu và biên lợi nhuận",
}[method] || "Dựa trên dữ liệu bán món");

const MetaStrip = ({ meta }) => meta ? (
  <div className="ai-meta-strip">
    {meta.fallbackUsed ? <span className="verify-badge">Cần quản lý kiểm tra lại</span> : null}
    <span>{methodLabel(meta.method)}</span>
    <span>{meta.sampleOrders ?? "-"} đơn trong {meta.sampleDays ?? "-"} ngày</span>
    {meta.fallbackUsed ? <span>Dữ liệu tham khảo</span> : null}
    {meta.generatedAt ? <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span> : null}
  </div>
) : null;

const MenuEngineeringAssistantWidget = ({ assistant, loading, onNavigate }) => {
  const summary = assistant?.summary || {};
  const dishes = assistant?.dishes || [];
  const recommendations = assistant?.recommendations || [];
  const hasDishData = Number(summary.totalDishes || 0) > 0;

  return (
    <div className="widget-card menu-engineering-assistant-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>Trợ lý tối ưu menu</h3>
            <p>Phân loại món theo doanh thu, biên lợi nhuận và tốc độ bán</p>
          </div>
        </div>
        <button type="button" className={`meta-pill ${assistant?.meta?.fallbackUsed ? "fallback" : "data"}`} onClick={() => onNavigate?.("menu")}>
          {assistant?.meta?.fallbackUsed ? "Ước tính chi phí" : "Mở menu"}
        </button>
      </div>
      <MetaStrip meta={assistant?.meta} />

      {loading ? <div className="state-message">Đang tổng hợp hiệu suất từng món...</div> : null}

      {!loading ? (
        <>
          <div className="summary-grid">
            <div className="summary-item">
              <span>Chủ lực</span>
              <strong>{nf(summary.starCount)}</strong>
            </div>
            <div className="summary-item">
              <span>Bán tốt</span>
              <strong>{nf(summary.plowhorseCount)}</strong>
            </div>
            <div className="summary-item">
              <span>Lời cao</span>
              <strong>{nf(summary.puzzleCount)}</strong>
            </div>
            <div className="summary-item">
              <span>Cần xem lại</span>
              <strong>{nf(summary.dogCount)}</strong>
            </div>
          </div>

          <div className="insight-row">
            <span>
              <CircleDollarSign size={14} /> Margin trung bình: <strong>{nf(summary.avgMarginPct)}%</strong>
            </span>
            <span>
              <Target size={14} /> Tổng món phân tích: <strong>{nf(summary.totalDishes)}</strong>
            </span>
          </div>

          {hasDishData ? (
          <div className="list-section">
            <h4>
              <TrendingUp size={16} /> Top món theo doanh thu
            </h4>
            <ul>
              {dishes.slice(0, 5).map((dish) => (
                <li key={dish.dishId}>
                  <div className="dish-main">
                    <span className="dish-name">{dish.dishName}</span>
                    <span className={`quadrant ${dish.quadrant}`}>{quadrantLabel[dish.quadrant] || dish.quadrant}</span>
                  </div>
                  <div className="dish-sub">
                    DT {nf(dish.revenue)}đ • LN {nf(dish.profit)}đ • Margin {nf(dish.marginPct)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>) : (
            <div className="state-message compact">
              <LayoutGrid size={16} />
              <p>Chưa có món đủ dữ liệu để phân tích.</p>
            </div>
          )}

          <div className="list-section">
            <h4>
              <Sparkles size={16} /> Gợi ý hành động
            </h4>
            <ul>
              {(recommendations.length ? recommendations : summary.notes || []).slice(0, 4).map((note, idx) => (
                <li key={`${idx}-${note}`} className="note-item">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default MenuEngineeringAssistantWidget;
