import React from "react";
import { localizeDemoLabel } from "@/utils/vietnameseDemoLabels";
import "./TopDishes.scss";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const TopDishes = ({
  data = [],
  loading,
  variant = "card",
  compactWhenEmpty = false,
  hasCompletedOrders = false,
}) => {
  const safeDishes = Array.isArray(data) ? data.slice(0, 5) : [];
  const maxQty = Math.max(
    ...safeDishes.map((item) => Number(item?.quantity || 0)),
    1,
  );
  const shellClass =
    variant === "bare"
      ? "top-dishes-widget top-dishes-widget--bare"
      : "top-dishes-widget";
  const isEmpty = !loading && safeDishes.length === 0;

  if (isEmpty && compactWhenEmpty) {
    const emptyText = hasCompletedOrders
      ? "Chưa có dữ liệu về món bán chạy."
      : "Khi có đơn hoàn thành, món bán chạy sẽ hiển thị tại đây.";

    return (
      <div className={`${shellClass} top-dishes-widget--empty-compact`}>
        <div className="top-dishes-empty-note">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="dishes-list custom-scrollbar">
        {loading ? <div className="empty-state">Đang tải dữ liệu...</div> : null}
        {!loading && safeDishes.length === 0 ? (
          <div className="empty-state empty-state--compact">
            Chưa có dữ liệu về món bán chạy.
          </div>
        ) : null}
        {!loading &&
          safeDishes.map((dish, index) => {
            const progress = Math.max(
              0,
              Math.min(100, (Number(dish?.quantity || 0) / maxQty) * 100),
            );
            const dishName = localizeDemoLabel(dish?.dishName, "—");

            return (
              <div key={`${dish.dishName}-${index}`} className="dish-row">
                <div className={`rank-badge ${index === 0 ? "rank-top" : ""}`}>
                  #{index + 1}
                </div>
                <div className="dish-content">
                  <div className="info-top">
                    <h4 className="dish-name">{dishName}</h4>
                    <span className="dish-meta">
                      {Number(dish?.quantity || 0)} suất
                    </span>
                  </div>
                  <p className="revenue-meta">
                    {formatCurrency(dish?.revenue || 0)}
                  </p>
                  <meter
                    className="progress-meter"
                    min="0"
                    max="100"
                    value={progress}
                    aria-label={`Tỷ lệ bán của ${dishName || "món"}`}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default TopDishes;
