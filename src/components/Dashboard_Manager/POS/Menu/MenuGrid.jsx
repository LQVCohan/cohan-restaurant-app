import React, { useMemo, useState } from "react";
import "./MenuGrid.scss";
import CategoryTabs from "./CategoryTabs";
import MenuItem from "./MenuItem";
import Input from "../../../common/Input";

export default function MenuGrid({ categories = [], items = [], onAddItem }) {
  const [activeCat, setActiveCat] = useState(categories[0]?.id);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = items.filter((i) =>
      activeCat ? i.categoryId === activeCat : true
    );
    if (!q.trim()) return list;
    const k = q.trim().toLowerCase();
    return list.filter((i) => {
      const blob = `${i.name} ${i.code || ""}`.toLowerCase();
      return blob.includes(k);
    });
  }, [items, activeCat, q]);

  return (
    <div className="menu-grid-container">
      <div className="menu-header">
        <h3 className="menu-title">Menu</h3>
        <div className="search-box">
          <div className="search-input-container">
            <span className="search-icon">🔎</span>
            <div className="search-input">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm món theo tên / mã…"
              />
            </div>
          </div>
        </div>
      </div>

      <CategoryTabs
        categories={categories}
        activeId={activeCat}
        onChange={setActiveCat}
      />

      <div className="menu-grid">
        {filtered.length === 0 ? (
          <div className="menu-empty">
            <p>Không có món phù hợp.</p>
          </div>
        ) : (
          filtered.map((i) => (
            <MenuItem key={i.id} item={i} onAdd={onAddItem} />
          ))
        )}
      </div>
    </div>
  );
}
