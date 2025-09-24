import React from "react";
import "./TopDishes.scss";

const DishItem = ({ rank, name, category, price, salesCount }) => (
  <div className="dish-item">
    <div className="dish-rank">{rank}</div>
    <div className="dish-info">
      <h4>{name}</h4>
      <p>
        {category} • {price}
      </p>
    </div>
    <div className="dish-sales">
      <div className="sales-number">{salesCount}</div>
      <div className="sales-label">đã bán</div>
    </div>
  </div>
);

const TopDishes = () => {
  const dishes = [
    {
      rank: 1,
      name: "Phở Bò Đặc Biệt",
      category: "Món chính",
      price: "₫85.000",
      salesCount: 234,
    },
    {
      rank: 2,
      name: "Bún Bò Huế",
      category: "Món chính",
      price: "₫75.000",
      salesCount: 189,
    },
    {
      rank: 3,
      name: "Cơm Tấm Sườn Nướng",
      category: "Món chính",
      price: "₫65.000",
      salesCount: 156,
    },
    {
      rank: 4,
      name: "Bánh Mì Thịt Nướng",
      category: "Món nhẹ",
      price: "₫35.000",
      salesCount: 142,
    },
  ];

  return (
    <div className="dishes-card fade-in">
      <div className="dishes-header">
        <h3 className="dishes-title">🍽️ Món Ăn Bán Chạy</h3>
        <a href="#" className="view-all-btn">
          Xem tất cả
        </a>
      </div>
      <div className="dishes-list">
        {dishes.map((dish, index) => (
          <DishItem
            key={index}
            rank={dish.rank}
            name={dish.name}
            category={dish.category}
            price={dish.price}
            salesCount={dish.salesCount}
          />
        ))}
      </div>
    </div>
  );
};

export default TopDishes;
