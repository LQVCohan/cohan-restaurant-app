// src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx
import React, { useState, useMemo, useEffect } from "react";
import MenuItemCard from "./MenuItemCard";
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from "../menuData"; // Import mock data
import "../styles/MenuDetailView.scss";
const ITEMS_PER_PAGE = 8;

const MenuDetailView = ({
  restaurant,
  onBack,
  onOpenFoodDetail,
}) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = useMemo(() => {
    return MOCK_MENU_ITEMS.filter((item) => {
      const matchRes = item.restaurantId === restaurant.id;
      const matchSlot = item.timeSlot ? item.timeSlot === timeSlot : true;
      const matchCat =
        activeCat === "all" ? true : item.categoryId === activeCat;
      const matchSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchRes && matchSlot && matchCat && matchSearch;
    });
  }, [restaurant.id, timeSlot, activeCat, search]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const currentItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [timeSlot, activeCat, search]);

  return (
    <div className="fade-in">
      <header className="menu-header">
        <div className="header-content">
          <div className="top-row">
            <button onClick={onBack} className="back-btn">
              ⬅ Quay lại
            </button>
            <h2>{restaurant.name}</h2>
            <div className="search-box">
              <input
                placeholder="Tìm món..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>🔍</span>
            </div>
            <div className="view-toggle">
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
              >
                ⊞
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                ☰
              </button>
            </div>
          </div>
          <div className="tabs-row">
            {[
              { id: "breakfast", label: "🍳 Bữa Sáng" },
              { id: "lunch", label: "☀️ Bữa Trưa" },
              { id: "dinner", label: "🌙 Bữa Tối" },
              { id: "late_night", label: "🦉 Ăn Đêm" },
            ].map((s) => (
              <div
                key={s.id}
                className={`tab ${timeSlot === s.id ? "active" : ""}`}
                onClick={() => setTimeSlot(s.id)}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid-container">
        <div className="category-filter">
          <div className="pills">
            <button
              className={activeCat === "all" ? "active" : ""}
              onClick={() => setActiveCat("all")}
            >
              Tất cả
            </button>
            {MOCK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={activeCat === cat.id ? "active" : ""}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
            Không tìm thấy món nào.
          </div>
        ) : (
          <>
            <div
              className={`grid-container menu-grid ${
                viewMode === "list" ? "list-view" : ""
              }`}
              style={{ padding: 0 }}
            >
              {currentItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onClick={(clickedItem) => {
                    onOpenFoodDetail?.(clickedItem?.id);
                  }}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    className={currentPage === idx + 1 ? "active" : ""}
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default MenuDetailView;
