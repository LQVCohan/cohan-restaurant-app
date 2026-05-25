import React, { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import "./MenuEngineeringMatrix.scss";

const classify = (pop, profit) => {
  if (pop >= 50 && profit >= 50) return "star";
  if (pop >= 50 && profit < 50) return "plowhorse";
  if (pop < 50 && profit >= 50) return "puzzle";
  return "dog";
};

const MenuEngineeringMatrix = ({ dishes = [] }) => {
  const mapped = useMemo(() => {
    const maxQty = Math.max(...dishes.map((d) => Number(d.quantity || 0)), 1);
    const maxRev = Math.max(...dishes.map((d) => Number(d.revenue || 0)), 1);
    return dishes.map((dish, idx) => {
      const x = Math.round((Number(dish.quantity || 0) / maxQty) * 100);
      const y = Math.round((Number(dish.revenue || 0) / maxRev) * 100);
      const type = classify(x, y);
      return {
        id: idx + 1,
        name: dish.dishName,
        type,
        x,
        y,
        profit: Math.round(Number(dish.revenue || 0) / Math.max(1, Number(dish.quantity || 1))),
        sold: Number(dish.quantity || 0),
      };
    });
  }, [dishes]);

  return (
    <div className="widget-card menu-matrix-widget">
      <div className="widget-header">
        <div className="header-content">
          <h4>Ma Trận Menu (BCG)</h4>
          <span className="subtitle">Phân tích từ top món bán chạy</span>
        </div>
      </div>
      {mapped.length === 0 ? (
        <div className="matrix-empty-state">
          <LayoutGrid size={18} />
          <p>Chưa có đủ dữ liệu để vẽ ma trận menu.</p>
          <span>Cần thêm món đã bán để phân loại STAR / PLOWHORSE / PUZZLE / DOG.</span>
        </div>
      ) : (
      <div className="matrix-body">
        <div className="axis-y-label">
          <span>Tỷ suất lợi nhuận (Cao)</span>
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
          <span>Độ phổ biến / Số lượng bán (Cao)</span>
          <span className="arrow">▶</span>
        </div>
      </div>
      )}
    </div>
  );
};

export default MenuEngineeringMatrix;
