import React, { useMemo } from "react";
import { ArrowRight, LayoutGrid } from "lucide-react";
import "./MenuEngineeringMatrix.scss";

const classify = (pop, profit) => {
  if (pop >= 50 && profit >= 50) return "star";
  if (pop >= 50 && profit < 50) return "plowhorse";
  if (pop < 50 && profit >= 50) return "puzzle";
  return "dog";
};

const quadrantLabel = {
  star: "Chủ lực",
  plowhorse: "Bán tốt",
  puzzle: "Lời cao",
  dog: "Cần xem lại",
};

const clampDot = (value) => Math.max(8, Math.min(92, Number(value || 0)));
const goMenu = () => window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: "menu", source: "manager-analytics" } }));

const MenuEngineeringMatrix = ({ dishes = [] }) => {
  const mapped = useMemo(() => {
    const maxQty = Math.max(...dishes.map((d) => Number(d.quantity || 0)), 1);
    const maxRev = Math.max(...dishes.map((d) => Number(d.revenue || 0)), 1);
    return dishes.map((dish, idx) => {
      const x = Math.round((Number(dish.quantity || 0) / maxQty) * 100);
      const y = Math.round((Number(dish.revenue || 0) / maxRev) * 100);
      const type = classify(x, y);
      return {
        id: dish.dishId || idx + 1,
        name: dish.dishName,
        type,
        x: clampDot(x),
        y: clampDot(y),
        profit: Math.round(Number(dish.revenue || 0) / Math.max(1, Number(dish.quantity || 1))),
        sold: Number(dish.quantity || 0),
      };
    });
  }, [dishes]);

  const counts = mapped.reduce((acc, dish) => ({ ...acc, [dish.type]: (acc[dish.type] || 0) + 1 }), {});
  const hasCompactData = mapped.length > 0 && mapped.length < 4;
  const leadDish = mapped[0];

  return (
    <div className={`widget-card menu-matrix-widget ${hasCompactData ? "is-compact" : ""}`}>
      <div className="widget-header">
        <div className="header-content">
          <h4>Ma trận menu BCG</h4>
          <span className="subtitle">Phân tích từ top món bán chạy</span>
        </div>
      </div>
      {mapped.length === 0 ? (
        <div className="matrix-empty-state analytics-action-empty">
          <LayoutGrid size={18} />
          <strong>Chưa đủ dữ liệu menu</strong>
          <p>Cần thêm món đã bán để phân loại nhóm chủ lực, bán tốt, lời cao hoặc cần xem lại.</p>
          <button type="button" className="widget-cta" onClick={goMenu}>Mở quản lý menu <ArrowRight size={14} /></button>
        </div>
      ) : hasCompactData ? (
        <div className="mini-bcg-insight" data-testid="mini-bcg-insight">
          <div className={`mini-bcg-insight__badge ${leadDish.type}`}>{quadrantLabel[leadDish.type]}</div>
          <div>
            <h5>{leadDish.name || "Món nổi bật"}</h5>
            <p>
              Đang thuộc nhóm {quadrantLabel[leadDish.type]}; theo dõi thêm dữ liệu bán và giá vốn trước khi kết luận bằng ma trận đầy đủ.
            </p>
          </div>
          <div className="mini-bcg-counts">
            {Object.entries(quadrantLabel).map(([key, label]) => (
              <span key={key}>{label}: <strong>{counts[key] || 0}</strong></span>
            ))}
          </div>
          <button type="button" onClick={goMenu}>
            Xem menu <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="matrix-body">
          <div className="axis-y-label">
            <span>Lợi nhuận cao</span>
            <span className="arrow">▲</span>
          </div>
          <div className="chart-area">
            <div className="quadrant q-puzzle"></div>
            <div className="quadrant q-star"></div>
            <div className="quadrant q-dog"></div>
            <div className="quadrant q-plowhorse"></div>
            {mapped.map((dish) => (
              <div
                key={dish.id}
                className={`dish-dot ${dish.type}`}
                style={{ left: `${dish.x}%`, bottom: `${dish.y}%` }}
              >
                <div className="tooltip">
                  <strong>{dish.name}</strong>
                  <div className="tooltip-stats">
                    <span>Lãi TB: {dish.profit.toLocaleString("vi-VN")}đ</span>
                    <span>Bán: {dish.sold}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="mid-line-x"></div>
            <div className="mid-line-y"></div>
          </div>
          <div className="axis-x-label">
            <span>Độ phổ biến cao</span>
            <span className="arrow">▶</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuEngineeringMatrix;
