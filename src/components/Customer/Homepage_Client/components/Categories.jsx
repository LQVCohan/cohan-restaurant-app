// src/pages/Home/components/Categories.jsx
import React from "react";
import "../../../../styles/Homepage/Categories.scss";
import { useCategoryManagement } from "../../../../hooks/useCategoryManagement";

const getIconForCategory = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.includes("khai") || lower.includes("starter")) return "🥗";
  if (lower.includes("việt") || lower.includes("vietnam")) return "🍜";
  if (lower.includes("fast") || lower.includes("burger")) return "🍔";
  if (lower.includes("pizza")) return "🍕";
  if (lower.includes("á") || lower.includes("asian")) return "🍱";
  if (lower.includes("tráng miệng") || lower.includes("dessert")) return "🧁";
  if (lower.includes("uống") || lower.includes("drink")) return "🥤";
  return "🍽️";
};

const Categories = ({ onCategorySelect, restaurantId, timeSlot }) => {
  const { categories, loading, error, isGlobal } = useCategoryManagement({
    restaurantId, // có thì lọc theo nhà hàng, không có thì global
    timeSlot,
    limit: 6,
  });

  const hasData = categories && categories.length > 0;

  const fallbackCategories = [
    { id: "fallback-1", name: "Món Việt", menuItemCount: 0 },
    { id: "fallback-2", name: "Fast Food", menuItemCount: 0 },
    { id: "fallback-3", name: "Pizza", menuItemCount: 0 },
    { id: "fallback-4", name: "Món Á", menuItemCount: 0 },
    { id: "fallback-5", name: "Tráng miệng", menuItemCount: 0 },
    { id: "fallback-6", name: "Đồ uống", menuItemCount: 0 },
  ];

  const displayCategories = hasData ? categories : fallbackCategories;

  return (
    <section className="categories">
      <div className="categories__container">
        <h3 className="categories__title">
          {isGlobal ? "Danh mục phổ biến" : "Danh mục nổi bật của nhà hàng"}
        </h3>

        {error && (
          <p className="categories__error">
            Không tải được danh mục từ hệ thống, đang hiển thị tạm dữ liệu mẫu.
          </p>
        )}

        <div className="categories__grid">
          {loading && !hasData
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="categories__item categories__item--skeleton"
                >
                  <div className="categories__icon skeleton-box" />
                  <p className="categories__name skeleton-box" />
                  <p className="categories__count skeleton-box" />
                </div>
              ))
            : displayCategories.map((category) => (
                <div
                  key={category.id}
                  className="categories__item"
                  onClick={() => onCategorySelect?.(category.id)}
                >
                  <div className="categories__icon">
                    <span>{getIconForCategory(category.name)}</span>
                  </div>
                  <p className="categories__name">{category.name}</p>
                  {typeof category.menuItemCount === "number" && (
                    <p className="categories__count">
                      {category.menuItemCount} món
                    </p>
                  )}
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
