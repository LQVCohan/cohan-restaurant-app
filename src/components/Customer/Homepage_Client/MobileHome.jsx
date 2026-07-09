import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  ReceiptText,
  Search,
  Store,
  Tags,
  UtensilsCrossed,
} from "lucide-react";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import "./MobileHome.scss";

const QUICK_ACTIONS = [
  { label: "Nhà hàng", caption: "Gần bạn", path: "/restaurants", icon: Store },
  { label: "Thực đơn", caption: "Chọn món", path: "/cus-menu", icon: UtensilsCrossed },
  { label: "Đơn hàng", caption: "Theo dõi", path: "/orders", icon: ReceiptText },
  { label: "Ưu đãi", caption: "Coupon", path: "/coupons", icon: Tags },
];

const SEARCH_CHIPS = [
  { label: "Gần bạn", path: "/restaurants" },
  { label: "Món Việt", query: "món Việt" },
  { label: "Ưu đãi", path: "/coupons" },
  { label: "Đặt bàn", path: "/restaurants" },
];

const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

export default function MobileHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const timeSlot = getCurrentTimeSlot();

  const handleSearch = (event) => {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;
    navigate(`/search?q=${encodeURIComponent(search)}`);
  };

  const handleSearchChip = (chip) => {
    if (chip.path) {
      navigate(chip.path);
      return;
    }

    navigate(`/search?q=${encodeURIComponent(chip.query)}`);
  };

  const handleCategorySelect = useCallback(
    (category) => {
      const categoryName = typeof category === "object" ? category?.name : category;
      const suffix = categoryName ? `?category=${encodeURIComponent(categoryName)}` : "";
      navigate(`/cus-menu${suffix}`);
    },
    [navigate],
  );

  return (
    <div className="mobile-home">
      <section className="mobile-home__intro" aria-labelledby="mobile-home-title">
        <span className="mobile-home__eyebrow">Ăn ngon quanh bạn</span>
        <h1 id="mobile-home-title">Hôm nay bạn muốn ăn gì?</h1>
        <p>Tìm món ăn, nhà hàng và ưu đãi gần bạn.</p>

        <form className="mobile-home__search" onSubmit={handleSearch}>
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm món, nhà hàng..."
            aria-label="Tìm món hoặc nhà hàng"
          />
          <button type="submit" aria-label="Tìm kiếm">Tìm</button>
        </form>

        <div className="mobile-home__chips" aria-label="Gợi ý tìm nhanh">
          {SEARCH_CHIPS.map((chip) => (
            <button key={chip.label} type="button" onClick={() => handleSearchChip(chip)}>
              {chip.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mobile-home__nearby"
          onClick={() => navigate("/restaurants")}
        >
          <MapPin aria-hidden="true" />
          Xem nhà hàng gần bạn
        </button>
      </section>

      <section className="mobile-home__quick" aria-labelledby="mobile-quick-title">
        <div className="mobile-home__section-heading">
          <div>
            <span>Truy cập nhanh</span>
            <h2 id="mobile-quick-title">Bạn cần gì?</h2>
          </div>
        </div>
        <div className="mobile-home__quick-grid">
          {QUICK_ACTIONS.map(({ label, caption, path, icon: Icon }) => (
            <button key={path} type="button" onClick={() => navigate(path)}>
              <Icon aria-hidden="true" />
              <strong>{label}</strong>
              <small>{caption}</small>
            </button>
          ))}
        </div>
      </section>

      <RestaurantGrid />

      <Categories onCategorySelect={handleCategorySelect} timeSlot={timeSlot} />
    </div>
  );
}
