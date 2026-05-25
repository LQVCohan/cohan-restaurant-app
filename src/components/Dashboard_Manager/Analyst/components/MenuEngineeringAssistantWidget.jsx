import React from "react";
import { Sparkles, Target, CircleDollarSign, TrendingUp, LayoutGrid } from "lucide-react";
import "./MenuEngineeringAssistantWidget.scss";

const nf = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const quadrantLabel = {
  star: "STAR",
  plowhorse: "PLOWHORSE",
  puzzle: "PUZZLE",
  dog: "DOG",
};

const MenuEngineeringAssistantWidget = ({ assistant, loading }) => {
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
            <h3>Menu Engineering Assistant V1</h3>
            <p>Phân loại STAR / PLOWHORSE / PUZZLE / DOG theo dữ liệu thực tế</p>
          </div>
        </div>
        <span className={`meta-pill ${assistant?.meta?.fallbackUsed ? "fallback" : "data"}`}>
          {assistant?.meta?.fallbackUsed ? "Cost fallback" : "Snapshot/Recipe"}
        </span>
      </div>

      {loading ? <div className="state-message">Đang tổng hợp hiệu suất từng món...</div> : null}

      {!loading ? (
        <>
          <div className="summary-grid">
            <div className="summary-item">
              <span>STAR</span>
              <strong>{nf(summary.starCount)}</strong>
            </div>
            <div className="summary-item">
              <span>PLOWHORSE</span>
              <strong>{nf(summary.plowhorseCount)}</strong>
            </div>
            <div className="summary-item">
              <span>PUZZLE</span>
              <strong>{nf(summary.puzzleCount)}</strong>
            </div>
            <div className="summary-item">
              <span>DOG</span>
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
