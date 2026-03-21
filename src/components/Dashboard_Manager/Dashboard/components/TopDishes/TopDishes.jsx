import React from "react";
import { Coffee, Utensils } from "lucide-react";
import "./TopDishes.scss";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const TopDishes = ({ data = [], lowStockItems = [], loading }) => {
  return (
    <div className="top-dishes-widget">
      <div className="widget-header">
        <h3 className="widget-title">Top Món Bán Chạy</h3>
      </div>
      <div className="dishes-list custom-scrollbar">
        {loading ? <div className="empty-state">Đang tải...</div> : null}
        {!loading && data.length === 0 ? (
          <div className="empty-state">Chưa có dữ liệu top món</div>
        ) : null}
        {!loading &&
          data.map((dish, index) => (
            <div key={`${dish.dishName}-${index}`} className="dish-row fade-in">
              <div className="col-visual">
                <div className={`rank-badge rank-${index + 1}`}>#{index + 1}</div>
                <div className="img-wrapper">
                  <div className="placeholder-img">
                    <Utensils size={14} />
                  </div>
                </div>
              </div>
              <div className="col-info">
                <div className="info-top">
                  <h4 className="dish-name">{dish.dishName}</h4>
                  <div className="value-display">
                    <span className="primary-val">{dish.quantity}</span>
                    <span className="unit">suất</span>
                  </div>
                </div>
                <div className="info-bottom">{formatCurrency(dish.revenue)}</div>
              </div>
            </div>
          ))}
      </div>
      <div className="widget-header" style={{ marginTop: 8 }}>
        <h3 className="widget-title">Cảnh báo tồn kho thấp</h3>
      </div>
      <div className="dishes-list custom-scrollbar">
        {lowStockItems.length === 0 ? (
          <div className="empty-state">Không có cảnh báo</div>
        ) : (
          lowStockItems.map((item) => (
            <div className="dish-row fade-in" key={item.id}>
              <div className="col-visual">
                <div className="img-wrapper">
                  <div className="placeholder-img">
                    <Coffee size={14} />
                  </div>
                </div>
              </div>
              <div className="col-info">
                <div className="info-top">
                  <h4 className="dish-name">{item.name}</h4>
                  <div className="value-display">
                    <span className="primary-val">{item.onHand}</span>
                    <span className="unit">còn lại</span>
                  </div>
                </div>
                <div className="info-bottom">Đã giữ: {item.reserved}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TopDishes;
