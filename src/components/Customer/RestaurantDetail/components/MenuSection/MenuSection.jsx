import React, { useState, useEffect } from "react";

import "./MenuSection.scss";

const MenuSection = ({ restaurantId }) => {
  const [menu, setMenu] = useState(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      try {
        // const menuData = await getMenuByRestaurantId(restaurantId);
        // setMenu(menuData);
        // if (menuData?.categories?.length > 0) {
        //   setActiveCategory(menuData.categories[0].id);
        // }
      } catch (error) {
        console.error("Error fetching menu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="menu-section">
        <div className="menu-loading">
          <div className="spinner"></div>
          <p>Đang tải thực đơn...</p>
        </div>
      </div>
    );
  }

  if (!menu || !menu.categories?.length) {
    return (
      <div className="menu-section">
        <div className="menu-empty">
          <span className="menu-empty__icon">🍽️</span>
          <h3>Chưa có thực đơn</h3>
          <p>
            Nhà hàng chưa cập nhật thực đơn. Vui lòng liên hệ trực tiếp để biết
            thêm chi tiết.
          </p>
        </div>
      </div>
    );
  }

  const activeMenuCategory = menu.categories.find(
    (cat) => cat.id === activeCategory
  );

  return (
    <div className="menu-section">
      <div className="menu-header">
        <h2 className="menu-title">🍽️ Thực đơn</h2>
        <p className="menu-subtitle">
          Khám phá các món ăn đặc sắc tại nhà hàng
        </p>
      </div>

      <div className="menu-layout">
        {/* Category Navigation */}
        <nav className="menu-nav">
          <div className="menu-categories">
            {menu.categories.map((category) => (
              <button
                key={category.id}
                className={`menu-category ${
                  activeCategory === category.id ? "menu-category--active" : ""
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                <span className="menu-category__icon">{category.icon}</span>
                <span className="menu-category__name">{category.name}</span>
                <span className="menu-category__count">
                  ({category.items.length})
                </span>
              </button>
            ))}
          </div>
        </nav>

        {/* Menu Items */}
        <div className="menu-content">
          {activeMenuCategory && (
            <div className="menu-category-content">
              <div className="menu-category-header">
                <h3 className="menu-category-title">
                  {activeMenuCategory.icon} {activeMenuCategory.name}
                </h3>
                <p className="menu-category-description">
                  {activeMenuCategory.description}
                </p>
              </div>

              <div className="menu-items">
                {activeMenuCategory.items.map((item) => (
                  <div key={item.id} className="menu-item">
                    <div className="menu-item__image">
                      <img src={item.image} alt={item.name} />
                      {item.isPopular && (
                        <span className="menu-item__badge">🔥 Phổ biến</span>
                      )}
                      {item.isNew && (
                        <span className="menu-item__badge menu-item__badge--new">
                          🆕 Mới
                        </span>
                      )}
                    </div>

                    <div className="menu-item__content">
                      <div className="menu-item__header">
                        <h4 className="menu-item__name">{item.name}</h4>
                        <span className="menu-item__price">{item.price}k</span>
                      </div>

                      <p className="menu-item__description">
                        {item.description}
                      </p>

                      {item.ingredients && (
                        <div className="menu-item__ingredients">
                          <span className="ingredients-label">
                            Nguyên liệu:
                          </span>
                          <span className="ingredients-list">
                            {item.ingredients.join(", ")}
                          </span>
                        </div>
                      )}

                      <div className="menu-item__meta">
                        <div className="menu-item__rating">
                          <span className="rating-stars">⭐</span>
                          <span className="rating-score">{item.rating}</span>
                          <span className="rating-count">
                            ({item.reviewCount})
                          </span>
                        </div>

                        {item.spicyLevel && (
                          <div className="menu-item__spicy">
                            <span className="spicy-icon">🌶️</span>
                            <span className="spicy-level">
                              {"🌶️".repeat(item.spicyLevel)}
                            </span>
                          </div>
                        )}

                        <div className="menu-item__tags">
                          {item.tags?.map((tag) => (
                            <span key={tag} className="menu-item__tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="menu-item__actions">
                        <button className="btn btn--secondary btn--small">
                          👁️ Xem chi tiết
                        </button>
                        <button className="btn btn--primary btn--small">
                          🛒 Thêm vào giỏ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuSection;
