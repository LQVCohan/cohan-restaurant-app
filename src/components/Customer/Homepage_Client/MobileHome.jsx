import React, { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
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
        <h1 id="mobile-home-title">Món ngon quanh bạn</h1>
        <p>Tìm món ăn hoặc nhà hàng bạn muốn thử.</p>

        <form className="mobile-home__search" role="search" onSubmit={handleSearch}>
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm món, nhà hàng..."
            aria-label="Tìm món hoặc nhà hàng"
          />
          <button type="submit">Tìm</button>
        </form>

        <div className="mobile-home__discover">
          <Link to="/restaurants">
            Khám phá nhà hàng <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/search?q=m%C3%B3n+Vi%E1%BB%87t">Món Việt</Link>
        </div>
      </section>

      <section className="mobile-home__quick" aria-labelledby="mobile-quick-title">
        <div className="mobile-home__section-heading">
          <h2 id="mobile-quick-title">Truy cập nhanh</h2>
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
