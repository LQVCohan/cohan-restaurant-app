import React from "react";

export default function RestaurantMenu({ menuItems = [] }) {
  // demo rải sẵn nếu backend chưa có
  const demo = [
    {
      emoji: "🍜",
      name: "Phở Bò Tái",
      desc: "Phở bò truyền thống",
      price: "85,000đ",
    },
    {
      emoji: "🍲",
      name: "Bún Chả Hà Nội",
      desc: "Thịt nướng đặc trưng",
      price: "75,000đ",
    },
    {
      emoji: "🍚",
      name: "Cơm Tấm Sườn Nướng",
      desc: "Sườn nướng, đồ chua",
      price: "65,000đ",
    },
    {
      emoji: "🥖",
      name: "Bánh Mì Thịt Nướng",
      desc: "Giòn thơm",
      price: "35,000đ",
    },
  ];

  const items =
    Array.isArray(menuItems) && menuItems.length
      ? menuItems.map((name) => ({ emoji: "🍽️", name, desc: "", price: "" }))
      : demo;

  return (
    <div className="card">
      <h2>🍜 Menu Nổi Bật</h2>
      <div className="menu-grid">
        {items.map((item, i) => (
          <div key={i} className="menu-item">
            <div className="menu-item-image">{item.emoji}</div>
            <div className="menu-item-info">
              <div className="menu-item-name">{item.name}</div>
              {item.desc && (
                <div className="menu-item-description">{item.desc}</div>
              )}
              {item.price && (
                <div className="menu-item-price">{item.price}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
