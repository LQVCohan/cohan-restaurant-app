import React from "react";
import "../../../../styles/Homepage/Categories.scss";
import { useCategoryManagement } from "../../../../hooks/useCategoryManagement";
const CATEGORY_IMAGE_MAP = [
  { keys: ["hải", "seafood"], src: "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=360&q=80" },
  { keys: ["cơm", "bún", "việt"], src: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=360&q=80" },
  { keys: ["gà", "fast", "fried"], src: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80" },
  { keys: ["pizza", "pasta"], src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=360&q=80" },
  { keys: ["trà", "đồ uống", "drink"], src: "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=360&q=80" },
  { keys: ["mì", "ramen"], src: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=360&q=80" },
  { keys: ["lẩu", "nướng"], src: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=360&q=80" },
  { keys: ["chay", "salad"], src: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=360&q=80" },
];

const DEFAULT_CATEGORY_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=360&q=80";

const getCategoryImage = (category) => {
  const explicitImage = category?.coverImage || category?.image || category?.thumbImage || category?.iconUrl;
  if (explicitImage && !String(explicitImage).includes("emoji")) return explicitImage;

  const name = String(category?.name || "").toLowerCase();
  return CATEGORY_IMAGE_MAP.find((item) => item.keys.some((key) => name.includes(key)))?.src || DEFAULT_CATEGORY_IMAGE;
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
          <button type="button" className="categories__view-all">
            Xem tất cả <span>›</span>
          </button>
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
                <button
                  key={category.id}
                  type="button"
                  className="categories__card"
                  onClick={() =>
                    onCategorySelect?.({ id: category.id, name: category.name })
                  }
                >
                  <div className="categories__image-wrapper">
                    <img
                      src={getCategoryImage(category)}
                      alt={`Danh mục ${category.name}`}
                      className="categories__image"
                      loading="lazy"
                    />
                  </div>
                  <div className="categories__info">
                    <h4 className="categories__name">{category.name}</h4>
                    {category.menuItemCount !== undefined && (
                      <span className="categories__count">
                        {category.menuItemCount} món ăn
                      </span>
                    )}
                  </div>
                </button>
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
