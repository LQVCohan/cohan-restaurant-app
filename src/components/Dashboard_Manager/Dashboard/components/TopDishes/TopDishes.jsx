import React from "react";
import "./TopDishes.scss";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const TopDishes = ({ data = [], lowStockItems = [], loading, variant = "card" }) => {
  const safeDishes = Array.isArray(data) ? data : [];
  const safeLowStock = Array.isArray(lowStockItems) ? lowStockItems : [];
  const maxQty = Math.max(...safeDishes.map((item) => Number(item?.quantity || 0)), 1);
  const shellClass = variant === "bare" ? "top-dishes-widget top-dishes-widget--bare" : "top-dishes-widget";

  return (
    <div className={shellClass}>
      {variant !== "bare" ? (
        <div className="widget-header">
          <h3 className="widget-title">Món bán chạy</h3>
        </div>
      ) : null}

      <div className="dishes-list custom-scrollbar">
        {loading ? <div className="empty-state">Đang tải dữ liệu...</div> : null}
        {!loading && safeDishes.length === 0 ? (
          <div className="empty-state">Chưa có dữ liệu món bán chạy.</div>
        ) : null}

        {!loading && safeDishes.map((dish, index) => {
          const progress = Math.max(0, Math.min(100, (Number(dish?.quantity || 0) / maxQty) * 100));
          return (
            <div key={`${dish.dishName}-${index}`} className="dish-row">
              <div className={`rank-badge ${index === 0 ? "rank-top" : ""}`}>#{index + 1}</div>
              <div className="dish-content">
                <div className="info-top">
                  <h4 className="dish-name">{dish?.dishName || "—"}</h4>
                  <span className="dish-meta">{Number(dish?.quantity || 0)} suất</span>
                </div>
                <p className="revenue-meta">{formatCurrency(dish?.revenue || 0)}</p>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {safeLowStock.length > 0 ? (
        <div className="low-stock-box">
          <p className="low-stock-title">Cảnh báo tồn kho thấp</p>
          {safeLowStock.slice(0, 3).map((item) => (
            <div className="low-stock-row" key={item.id}>
              <span>{item.name}</span>
              <strong>{item.onHand}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TopDishes;
