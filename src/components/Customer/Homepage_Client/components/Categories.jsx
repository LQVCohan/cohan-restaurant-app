import React from "react";
import "../../../../styles/Homepage/Categories.scss";
import { useCategoryManagement } from "../../../../hooks/useCategoryManagement";

// Helper chọn icon dựa trên tên danh mục
const getIconForCategory = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.includes("khai") || lower.includes("starter")) return "🥗";
  if (
    lower.includes("việt") ||
    lower.includes("vietnam") ||
    lower.includes("phở")
  )
    return "🍜";
  if (
    lower.includes("fast") ||
    lower.includes("burger") ||
    lower.includes("gà")
  )
    return "🍔";
  if (lower.includes("pizza") || lower.includes("ý")) return "🍕";
  if (lower.includes("á") || lower.includes("asian") || lower.includes("cơm"))
    return "🍱";
  if (
    lower.includes("tráng miệng") ||
    lower.includes("dessert") ||
    lower.includes("bánh")
  )
    return "🧁";
  if (
    lower.includes("uống") ||
    lower.includes("drink") ||
    lower.includes("trà")
  )
    return "🥤";
  if (lower.includes("lẩu") || lower.includes("hotpot")) return "🍲";
  return "🍽️";
};

const Categories = ({ onCategorySelect, restaurantId, timeSlot }) => {
  const {
    categories,
    categoriesLoading,
    categoriesError,
    topCategories,
    topCategoriesLoading,
    topCategoriesError,
    isGlobal,
  } = useCategoryManagement({
    restaurantId,
    timeSlot,
    limit: 8,
  });

  const dataFromBackend = isGlobal ? topCategories : categories;
  const loading = isGlobal ? topCategoriesLoading : categoriesLoading;
  const error = isGlobal ? topCategoriesError : categoriesError;

  const hasData = Array.isArray(dataFromBackend) && dataFromBackend.length > 0;

  // Dữ liệu mẫu khi chưa có API hoặc lỗi
  const fallbackCategories = [
    { id: "fb-1", name: "Món Việt", menuItemCount: 120 },
    { id: "fb-2", name: "Fast Food", menuItemCount: 85 },
    { id: "fb-3", name: "Pizza & Pasta", menuItemCount: 45 },
    { id: "fb-4", name: "Cơm & Bún", menuItemCount: 90 },
    { id: "fb-5", name: "Đồ uống", menuItemCount: 60 },
    { id: "fb-6", name: "Tráng miệng", menuItemCount: 30 },
    { id: "fb-7", name: "Lẩu & Nướng", menuItemCount: 25 },
    { id: "fb-8", name: "Món Chay", menuItemCount: 15 },
  ];

  const displayCategories = hasData ? dataFromBackend : fallbackCategories;

  return (
    <section className="categories">
      <div className="categories__container">
        {/* Header */}
        <div className="categories__header">
          <h3 className="categories__title">
            {isGlobal ? "Danh mục phổ biến" : "Thực đơn nhà hàng"}
          </h3>
          <p className="categories__subtitle">
            Khám phá các món ăn ngon theo sở thích của bạn
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="categories__error">
            ⚠️ Không tải được dữ liệu, hiển thị danh mục mẫu.
          </div>
        )}

        {/* Grid List */}
        <div className="categories__grid">
          {loading && !hasData
            ? Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="categories__card categories__card--skeleton"
                >
                  <div className="skeleton-icon" />
                  <div className="skeleton-text-lg" />
                  <div className="skeleton-text-sm" />
                </div>
              ))
            : displayCategories.map((category) => (
                <div
                  key={category.id}
                  className="categories__card"
                  onClick={() => onCategorySelect?.(category.id)}
                >
                  <div className="categories__icon-wrapper">
                    <span className="categories__icon">
                      {getIconForCategory(category.name)}
                    </span>
                  </div>
                  <div className="categories__info">
                    <h4 className="categories__name">{category.name}</h4>
                    {category.menuItemCount !== undefined && (
                      <span className="categories__count">
                        {category.menuItemCount} món ăn
                      </span>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* --- SÓNG LIÊN KẾT VỚI PHẦN DƯỚI (DISH GRID) --- */}
      <div className="categories__wave-bottom">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="wave-svg"
        >
          {/* Màu fill này sẽ được override trong SCSS để đồng bộ */}
          <path
            fill="#fff7ed"
            fillOpacity="1"
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,202.7C1248,181,1344,171,1392,165.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

export default Categories;
