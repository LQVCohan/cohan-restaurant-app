import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

const suggestedCategories = [
  { key: "suggestion-vietnamese", name: "Món Việt", helperText: "Cơm, bún, món gia đình", __isSuggestion: true },
  { key: "suggestion-rice-noodle", name: "Cơm & Bún", helperText: "No lâu, dễ chọn", __isSuggestion: true },
  { key: "suggestion-hotpot-grill", name: "Lẩu & Nướng", helperText: "Đi nhóm rất hợp", __isSuggestion: true },
  { key: "suggestion-drinks", name: "Đồ uống", helperText: "Trà, cà phê, nước ép", __isSuggestion: true },
  { key: "suggestion-healthy", name: "Healthy", helperText: "Nhẹ bụng, cân bằng", __isSuggestion: true },
  { key: "suggestion-dessert", name: "Tráng miệng", helperText: "Ngọt nhẹ sau bữa ăn", __isSuggestion: true },
];

const normalizeCategoryName = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getCategoryImage = (category) => {
  const explicitImage = category?.coverImage || category?.image || category?.thumbImage || category?.iconUrl;
  if (explicitImage && !String(explicitImage).includes("emoji")) return explicitImage;

  const name = String(category?.name || "").toLowerCase();
  return CATEGORY_IMAGE_MAP.find((item) => item.keys.some((key) => name.includes(key)))?.src || DEFAULT_CATEGORY_IMAGE;
};

const dedupeCategories = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeCategoryName(item?.name || item?.id || item?.key);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildDisplayCategories = (realItems = []) => {
  const real = dedupeCategories(realItems).slice(0, 6);
  const names = new Set(real.map((item) => normalizeCategoryName(item.name)));
  const fillers = suggestedCategories.filter((item) => !names.has(normalizeCategoryName(item.name)));
  return [...real, ...fillers].slice(0, real.length >= 4 ? real.length : 4);
};

const Categories = ({ onCategorySelect, restaurantId, timeSlot }) => {
  const navigate = useNavigate();
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
  const displayCategories = useMemo(
    () => buildDisplayCategories(hasData ? dataFromBackend : []),
    [dataFromBackend, hasData],
  );
  const showSuggestionHint = !loading && !hasData;

  const handleCategoryClick = (category) => {
    if (category.__isSuggestion) {
      navigate("/restaurants");
      return;
    }

    onCategorySelect?.({ id: category.id, name: category.name });
  };

  return (
    <section className="categories">
      <div className="categories__container">
        <div className="categories__header">
          <div>
            <span className="categories__badge">Khám phá nhanh</span>
            <h3 className="categories__title">
              {isGlobal ? "Danh mục phổ biến" : "Thực đơn nhà hàng"}
            </h3>
          </div>
          <button
            type="button"
            className="categories__view-all"
            onClick={() => navigate("/restaurants")}
          >
            Xem tất cả <span>›</span>
          </button>
        </div>

        {error && (
          <div className="categories__error">
            Không tải được danh mục. Bạn vẫn có thể khám phá nhà hàng bên dưới.
          </div>
        )}

        {showSuggestionHint && (
          <div className="categories__hint">
            Danh mục đang được cập nhật. Các gợi ý bên dưới giúp bạn bắt đầu nhanh hơn.
          </div>
        )}

        <div className="categories__grid">
          {loading && !hasData
            ? Array.from({ length: 6 }).map((_, idx) => (
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
                  key={category.id || category.key}
                  type="button"
                  className={`categories__card ${category.__isSuggestion ? "categories__card--suggestion" : ""}`}
                  onClick={() => handleCategoryClick(category)}
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
                    {category.__isSuggestion ? (
                      <span className="categories__count">{category.helperText}</span>
                    ) : (
                      <span className="categories__count">
                        {Number(category.menuItemCount || 0) > 0 ? `${category.menuItemCount} món ăn` : "Đang cập nhật món"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
        </div>
      </div>

      <div className="categories__wave-bottom">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="wave-svg"
        >
          <path
            fill="#fff7ed"
            fillOpacity="1"
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,202.7C1248,181,1344,171,1392,165.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,96,48,320L0,320Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

export default Categories;
