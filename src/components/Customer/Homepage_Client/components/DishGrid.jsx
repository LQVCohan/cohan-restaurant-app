import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import "../../../../styles/Homepage/DishGrid.scss";

// --- GRAPHQL QUERY ---
const GET_TOP_MENU_ITEMS = gql`
  query GetTopMenuItems($limit: Int = 8) {
    topMenuItems(limit: $limit) {
      id
      name
      description
      basePrice
      thumbImage
      point
      menuId
      categoryId
      restaurantId
      servingVariants {
        key
        name
        price
      }
    }
  }
`;

const DishGrid = ({ onAddToCart, selectedCategoryId = null }) => {
  const { data, loading, error } = useQuery(GET_TOP_MENU_ITEMS, {
    variables: { limit: selectedCategoryId ? 60 : 8 },
    fetchPolicy: "network-only",
  });

  // State lưu method đang chọn của từng món
  const [selectedMethodByDish, setSelectedMethodByDish] = useState({});

  const dishes = useMemo(() => data?.topMenuItems ?? [], [data]);

  const filteredDishes = useMemo(() => {
    if (!selectedCategoryId) return dishes;
    return dishes.filter((dish) => String(dish.categoryId) === String(selectedCategoryId));
  }, [dishes, selectedCategoryId]);

  // Ảnh fallback nếu món chưa có ảnh
  const defaultImg =
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80";

  // --- LOGIC HELPER ---
  const getSelectedMethod = (dish) => {
    const chosenName = selectedMethodByDish[dish.id];
    if (!chosenName && dish.servingVariants?.length > 0) {
      return dish.servingVariants[0];
    }
    return dish.servingVariants?.find((m) => m.name === chosenName) || null;
  };

  const getEffectivePrice = (basePrice, method) => {
    const b = Number(basePrice) || 0;
    const delta = Number(method?.price || 0);
    return b + delta;
  };

  const handleMethodChange = (dishId, methodName) => {
    setSelectedMethodByDish((prev) => ({ ...prev, [dishId]: methodName }));
  };

  const handleAdd = (dish) => {
    const method = getSelectedMethod(dish);
    const price = getEffectivePrice(dish.basePrice, method);

    const payload = {
      id: dish.id,
      dishId: dish.id,
      restaurantId: dish.restaurantId,
      name: dish.name,
      price,
      image: dish.thumbImage || defaultImg,
      method: method?.name || null,
      quantity: 1,
      menuId: dish.menuId,
      categoryId: dish.categoryId,
    };
    onAddToCart?.(payload);
  };

  return (
    <section id="menu" className="dish-grid">
      <div className="dish-grid__container">
        {/* Header */}
        <div className="dish-grid__header">
          <span className="dish-grid__badge">🔥 Hot Trend</span>
          <h3 className="dish-grid__title">Thực Đơn Nổi Bật</h3>
          <p className="dish-grid__subtitle">
            Những món ăn được yêu thích nhất tuần qua, hương vị tuyệt hảo.
          </p>
        </div>

        {/* Content */}
        {error ? (
          <div className="dish-grid__error">⚠️ Có lỗi khi tải món ăn.</div>
        ) : (
          <div className="dish-grid__list">
            {loading
              ? Array.from({ length: 8 }).map((_, idx) => (
                  <SkeletonCard key={idx} />
                ))
              : filteredDishes.map((dish) => {
                  const method = getSelectedMethod(dish);
                  const price = getEffectivePrice(dish.basePrice, method);
                  const img = dish.thumbImage || defaultImg;
                  const hasVariants = dish.servingVariants?.length > 0;

                  return (
                    <div key={dish.id} className="dish-card">
                      {/* Image Area */}
                      <div className="dish-card__image-wrapper">
                        <img
                          src={img}
                          alt={dish.name}
                          className="dish-card__img"
                        />
                        {dish.point && (
                          <div className="dish-card__rating">
                            ⭐ {dish.point}
                          </div>
                        )}
                      </div>

                      {/* Content Area */}
                      <div className="dish-card__body">
                        <h4 className="dish-card__name" title={dish.name}>
                          {dish.name}
                        </h4>
                        <p className="dish-card__desc">
                          {dish.description ||
                            "Hương vị tuyệt hảo, nguyên liệu tươi ngon."}
                        </p>

                        {/* Dropdown chọn biến thể */}
                        <div className="dish-card__variant-area">
                          {hasVariants ? (
                            <div className="dish-card__select-wrapper">
                              <label className="dish-card__label">
                                Tùy chọn:
                              </label>
                              <select
                                className="dish-card__select"
                                value={method?.name || ""}
                                onChange={(e) =>
                                  handleMethodChange(dish.id, e.target.value)
                                }
                              >
                                {dish.servingVariants.map((m, idx) => (
                                  <option
                                    key={`${dish.id}-${idx}`}
                                    value={m.name}
                                  >
                                    {m.name}
                                    {Number(m.price) > 0
                                      ? ` (+${Number(
                                          m.price
                                        ).toLocaleString()}đ)`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            // Spacer giữ chiều cao thẻ
                            <div className="dish-card__variant-spacer">
                              <span className="dish-card__label-static">
                                Món tiêu chuẩn
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer: Price + Button */}
                        <div className="dish-card__footer">
                          <div className="dish-card__price-box">
                            <span className="label">Giá:</span>
                            <span className="price">
                              {price.toLocaleString("vi-VN")} <small>đ</small>
                            </span>
                          </div>

                          <button
                            className="dish-card__btn-add"
                            onClick={() => handleAdd(dish)}
                          >
                            + Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

            {!loading && filteredDishes.length === 0 && selectedCategoryId && (
              <div className="dish-grid__empty">
                Không có món ăn thuộc danh mục này.
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- SÓNG ĐÁY (Kết nối với RestaurantGrid) --- */}
      <div className="dish-grid__wave-bottom">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="wave-svg"
        >
          {/* Màu Trắng trùng với RestaurantGrid */}
          <path
            fill="#ffffff"
            fillOpacity="1"
            d="M0,96L48,122.7C96,149,192,203,288,208C384,213,480,171,576,138.7C672,107,768,85,864,101.3C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

// Skeleton Loader
const SkeletonCard = () => (
  <div className="dish-card dish-card--skeleton">
    <div className="skeleton-img" />
    <div className="dish-card__body">
      <div className="skeleton-text w-3-4" />
      <div className="skeleton-text w-1-2" />
      <div className="skeleton-input" />
      <div className="dish-card__footer">
        <div className="skeleton-text w-1-3" />
        <div className="skeleton-btn" />
      </div>
    </div>
  </div>
);

export default DishGrid;
