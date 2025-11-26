// src/components/Customer/Homepage_Client/components/DishGrid.jsx
import React, { useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "../../../../styles/Homepage/DishGrid.scss";
import { getMethodIcon } from "@/utils/methodIcons"; // adjust path if needed

// ─────────────────────────────────────────────────────────────
// GraphQL: Top 8 menu items by point (desc)
// Chỉ lấy các field cần cho Grid và Cart
// ─────────────────────────────────────────────────────────────
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
        mode
        yieldQty
        yieldUnit
        name
        Ingredients {
          ingredientId
          name
          quantify
          wastePct
        }
      }
    }
  }
`;

const DishGrid = ({ onAddToCart }) => {
  const { data, loading, error } = useQuery(GET_TOP_MENU_ITEMS, {
    variables: { limit: 8 },
    fetchPolicy: "network-only",
  });

  // Lưu method chọn theo dishId -> methodName
  const [selectedMethodByDish, setSelectedMethodByDish] = useState({});

  const dishes = useMemo(() => data?.topMenuItems ?? [], [data]);

  // Nếu để public/… thì cứ dùng "/default-dishes.jpg" (CRA/Vite sẽ serve từ public root)
  const defaultImg = "/default-dishes.jpg";

  const getDefaultMethod = (preps = []) => {
    if (!Array.isArray(preps) || preps.length === 0) return null;
    return preps.find((m) => m.isDefault) || preps[0];
  };

  const getSelectedMethod = (dish) => {
    const chosen = selectedMethodByDish[dish.id];
    const found =
      dish.preparationMethods?.find((m) => m.name === chosen) ||
      getDefaultMethod(dish.preparationMethods);
    return found || null;
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

    // ✅ QUAN TRỌNG: thêm restaurantId vào payload
    // ✅ Không truyền modifiers; chỉ tên, số lượng, đơn giá
    const payload = {
      id: dish.id, // dishId gốc
      dishId: dish.id, // (để hook chuẩn hoá nếu cần)
      restaurantId: dish.restaurantId, // 🔵 để group theo nhà hàng trong Cart/Summary
      name: dish.name,
      price, // đơn giá đã tính theo method (nếu có)
      image: dish.thumbImage || defaultImg,
      method: method?.name || null, // chỉ để hiển thị, không ảnh hưởng tính tiền ở yêu cầu này
      quantity: 1,

      // (giữ lại nếu cần bối cảnh sau này)
      menuId: dish.menuId,
      categoryId: dish.categoryId,
    };

    onAddToCart?.(payload);
  };

  if (loading) {
    return (
      <section id="menu" className="dishes">
        <div className="dishes__container">
          <h3 className="dishes__title">Món ăn phổ biến</h3>
          <p style={{ textAlign: "center", color: "#64748b" }}>
            Đang tải món ăn…
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu" className="dishes">
        <div className="dishes__container">
          <h3 className="dishes__title">Món ăn phổ biến</h3>
          <p style={{ textAlign: "center", color: "#ef4444" }}>
            Lỗi tải dữ liệu: {error.message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="menu" className="dishes">
      <div className="dishes__container">
        <h3 className="dishes__title">Món ăn phổ biến</h3>

        <div className="dishes__grid">
          {dishes.map((dish) => {
            const method = getSelectedMethod(dish);
            const price = getEffectivePrice(dish.basePrice, method);
            const img = dish.thumbImage || defaultImg;

            return (
              <div key={dish.id} className="dish-card">
                <div className="dish-card__image">
                  <img
                    src={img}
                    alt={dish.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>

                <div className="dish-card__content">
                  <h5 className="dish-card__name">{dish.name}</h5>

                  {/* Chọn cách chế biến (nếu có) */}
                  {Array.isArray(dish.servingVariants) &&
                    dish.servingVariants.length > 0 && (
                      <div className="dish-card__method">
                        <select
                          className="dish-card__method-select"
                          value={method?.name || ""}
                          onChange={(e) =>
                            handleMethodChange(dish.id, e.target.value)
                          }
                        >
                          {dish.servingVariants.map((m, idx) => (
                            <option key={`${dish.id}-m-${idx}`} value={m.name}>
                              {getMethodIcon(m.name)} {m.name}
                              {Number(m.price) > 0
                                ? ` (${Number(m.price).toLocaleString(
                                    "vi-VN"
                                  )} đ)`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  <div className="dish-card__footer">
                    <span className="dish-card__price">
                      {price.toLocaleString("vi-VN")}đ
                    </span>
                    <button
                      onClick={() => handleAdd(dish)}
                      className="dish-card__add-btn"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DishGrid;
