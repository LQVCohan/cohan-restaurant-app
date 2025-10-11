import React from "react";
import "../../../../styles/Homepage/Categories.scss";

const Categories = ({ onCategorySelect }) => {
  const categories = [
    { id: "vietnamese", name: "Món Việt", icon: "🍜" },
    { id: "fastfood", name: "Fast Food", icon: "🍔" },
    { id: "pizza", name: "Pizza", icon: "🍕" },
    { id: "asian", name: "Món Á", icon: "🍱" },
    { id: "dessert", name: "Tráng miệng", icon: "🧁" },
    { id: "drink", name: "Đồ uống", icon: "🥤" },
  ];

  return (
    <section className="categories">
      <div className="categories__container">
        <h3 className="categories__title">Danh mục phổ biến</h3>
        <div className="categories__grid">
          {categories.map((category) => (
            <div
              key={category.id}
              className="categories__item"
              onClick={() => onCategorySelect(category.id)}
            >
              <div className="categories__icon">
                <span>{category.icon}</span>
              </div>
              <p className="categories__name">{category.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
