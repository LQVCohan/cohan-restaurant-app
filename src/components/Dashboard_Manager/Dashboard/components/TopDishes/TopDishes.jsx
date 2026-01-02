import React from "react";
import { ChevronRight, TrendingUp } from "lucide-react";
import "./TopDishes.scss";

const TopDishes = () => {
  const dishes = [
    {
      id: 1,
      name: "Sashimi Bào Ngư",
      price: 1250000,
      sales: 85,
      img: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=100&q=80",
    },
    {
      id: 2,
      name: "Bò Wagyu A5",
      price: 2800000,
      sales: 62,
      img: "https://images.unsplash.com/photo-1558030006-4506719b7402?auto=format&fit=crop&w=100&q=80",
    },
    { id: 3, name: "Tôm Hùm Bỏ Lò", price: 1850000, sales: 45, img: null }, // Trường hợp không có ảnh
    { id: 4, name: "Set Sushi Cao Cấp", price: 950000, sales: 38, img: null },
    { id: 5, name: "Rượu Sake Gold", price: 3200000, sales: 20, img: null },
  ];

  return (
    <div className="top-dishes-wrapper">
      <div className="dishes-header">
        <div className="title-group">
          <h3 className="dishes-title">Món Bán Chạy</h3>
          <span className="subtitle">Top trending tháng này</span>
        </div>
        <button className="view-all-btn">
          Xem thêm <ChevronRight size={16} />
        </button>
      </div>

      <div className="dishes-list">
        {dishes.map((dish, index) => (
          <div key={dish.id} className="dish-item">
            {/* Rank Number */}
            <div className={`dish-rank rank-${index + 1}`}>
              <span>{index + 1}</span>
            </div>

            {/* Thumbnail (Optional) */}
            <div className="dish-thumb">
              {dish.img ? (
                <img src={dish.img} alt={dish.name} />
              ) : (
                // Placeholder nếu không có ảnh
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  <TrendingUp size={20} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="dish-info">
              <h4>{dish.name}</h4>
              <p className="dish-meta">
                <span className="price">
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(dish.price)}
                </span>
              </p>
            </div>

            {/* Sales Stats */}
            <div className="dish-stats">
              <div className="sales-badge">
                <span className="count">{dish.sales}</span>
                <span className="label">Đã bán</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopDishes;
