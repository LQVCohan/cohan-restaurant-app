import React from "react";
import "./MenuEngineeringMatrix.scss";

const MenuEngineeringMatrix = () => {
  // Dữ liệu giả lập (Sau này lấy từ API)
  // x: Độ phổ biến (Sales Volume %)
  // y: Lợi nhuận (Profit Margin %)
  const dishes = [
    {
      id: 1,
      name: "Bò Wagyu",
      type: "star",
      x: 75,
      y: 80,
      profit: "500k",
      sold: 120,
    },
    {
      id: 2,
      name: "Cơm Chiên",
      type: "plowhorse",
      x: 85,
      y: 30,
      profit: "20k",
      sold: 450,
    },
    {
      id: 3,
      name: "Rượu Vang",
      type: "puzzle",
      x: 25,
      y: 85,
      profit: "800k",
      sold: 15,
    },
    {
      id: 4,
      name: "Salad Nga",
      type: "dog",
      x: 15,
      y: 20,
      profit: "15k",
      sold: 30,
    },
    {
      id: 5,
      name: "Súp Cua",
      type: "star",
      x: 65,
      y: 70,
      profit: "120k",
      sold: 90,
    },
    {
      id: 6,
      name: "Nước Suối",
      type: "dog",
      x: 40,
      y: 15,
      profit: "5k",
      sold: 50,
    },
  ];

  return (
    <div className="widget-card menu-matrix-widget">
      <div className="widget-header">
        <div className="header-content">
          <h4>Ma Trận Menu (BCG)</h4>
          <span className="subtitle">Phân tích Lợi nhuận vs. Độ phổ biến</span>
        </div>
        <div className="legend">
          <span className="legend-item star">★ Ngôi sao</span>
          <span className="legend-item plowhorse">● Bò sữa</span>
          <span className="legend-item puzzle">? Dấu hỏi</span>
          <span className="legend-item dog">✖ Chó mực</span>
        </div>
      </div>

      <div className="matrix-body">
        {/* Label Trục Y */}
        <div className="axis-y-label">
          <span>Tỷ suất lợi nhuận (Cao)</span>
          <span className="arrow">▲</span>
        </div>

        <div className="chart-area">
          {/* 4 Vùng (Quadrants) */}
          <div className="quadrant q-puzzle">
            <span className="q-label">
              DẤU HỎI
              <br />
              <small>Lời cao - Ít người mua</small>
            </span>
          </div>
          <div className="quadrant q-star">
            <span className="q-label">
              NGÔI SAO
              <br />
              <small>Lời cao - Bán chạy</small>
            </span>
          </div>
          <div className="quadrant q-dog">
            <span className="q-label">
              CHÓ MỰC
              <br />
              <small>Lời thấp - Ít người mua</small>
            </span>
          </div>
          <div className="quadrant q-plowhorse">
            <span className="q-label">
              BÒ SỮA
              <br />
              <small>Lời thấp - Bán chạy</small>
            </span>
          </div>

          {/* Các điểm món ăn */}
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className={`dish-dot ${dish.type}`}
              style={{ left: `${dish.x}%`, bottom: `${dish.y}%` }}
            >
              <div className="tooltip">
                <strong>{dish.name}</strong>
                <div className="tooltip-stats">
                  <span>Lãi: {dish.profit}</span>
                  <span>Bán: {dish.sold}</span>
                </div>
                <div className={`tag ${dish.type}`}>
                  {dish.type.toUpperCase()}
                </div>
              </div>
            </div>
          ))}

          {/* Đường trung bình cắt ngang/dọc */}
          <div className="mid-line-x"></div>
          <div className="mid-line-y"></div>
        </div>

        {/* Label Trục X */}
        <div className="axis-x-label">
          <span>Độ phổ biến / Số lượng bán (Cao)</span>
          <span className="arrow">▶</span>
        </div>
      </div>
    </div>
  );
};

export default MenuEngineeringMatrix;
