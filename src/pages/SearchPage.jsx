// src/pages/SearchPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSearch } from "../hooks/useSearch";
import {
  Search,
  MapPin,
  Star,
  ArrowRight,
  Store,
  Utensils,
  User,
  Phone,
  Mail,
} from "lucide-react";
import "./SearchPage.scss";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("ALL");
  const [localSearch, setLocalSearch] = useState(q);

  useEffect(() => {
    setLocalSearch(q);
  }, [q]);

  const { results, loading } = useSearch(q, {}, 30, 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (localSearch.trim()) {
      setSearchParams({ q: localSearch.trim() });
    }
  };

  const filteredItems = useMemo(() => {
    if (!results?.items) return [];
    if (activeTab === "ALL") return results.items;
    return results.items.filter((item) => item.type === activeTab);
  }, [results, activeTab]);

  const handleClickItem = (item) => {
    if (!item) return;

    if (item.type === "RESTAURANT" && item.restaurant?.id) {
      navigate(`/restaurant/${item.restaurant.id}`);
      return;
    }

    if (item.type === "MENU_ITEM" && item.menuItem?.id) {
      const restaurantId = item.menuItem.restaurant?.id;
      const menuItemId = item.menuItem.id;
      if (restaurantId && menuItemId) {
        navigate(
          `/cus-menu?restaurantId=${encodeURIComponent(
            restaurantId
          )}&menuItemId=${encodeURIComponent(menuItemId)}`
        );
        return;
      }
    }

    if (item.type === "OWNER" && item.owner?.id) {
      navigate(`/owner/${item.owner.id}`);
      return;
    }

    if (item.type === "LOCATION" && item.locationLabel) {
      setSearchParams({ q: item.locationLabel });
      return;
    }
  };

  const renderSkeletons = () => (
    <div className="sp-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="sp-card skeleton">
          <div className="skeleton-img" />
          <div className="skeleton-content">
            <div className="skeleton-line w-3/4" />
            <div className="skeleton-line w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="sp-container">
      <div className="sp-header">
        <h1 className="sp-title">Kết quả tìm kiếm</h1>

        <form className="sp-search-bar" onSubmit={handleSearch}>
          <Search className="icon" size={20} />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm món ăn, nhà hàng..."
          />
          <button type="submit" className="btn-search">
            Tìm kiếm
          </button>
        </form>

        <div className="sp-tabs">
          <button
            className={`tab ${activeTab === "ALL" ? "active" : ""}`}
            onClick={() => setActiveTab("ALL")}
          >
            Tất cả
          </button>
          <button
            className={`tab ${activeTab === "RESTAURANT" ? "active" : ""}`}
            onClick={() => setActiveTab("RESTAURANT")}
          >
            <Store size={16} /> Nhà hàng
          </button>
          <button
            className={`tab ${activeTab === "MENU_ITEM" ? "active" : ""}`}
            onClick={() => setActiveTab("MENU_ITEM")}
          >
            <Utensils size={16} /> Món ăn
          </button>
        </div>
      </div>

      <div className="sp-content">
        {loading ? (
          renderSkeletons()
        ) : !filteredItems || filteredItems.length === 0 ? (
          <div className="sp-empty">
            <div className="empty-img">🔍</div>
            <h3>Không tìm thấy kết quả</h3>
            <p>
              Rất tiếc, chúng tôi không tìm thấy kết quả nào cho "
              <strong>{q}</strong>".
              <br />
              Hãy thử từ khóa khác hoặc kiểm tra chính tả.
            </p>
            <div className="suggestions">
              <span>Gợi ý:</span>
              <button onClick={() => setSearchParams({ q: "Pizza" })}>
                Pizza
              </button>
              <button onClick={() => setSearchParams({ q: "Sushi" })}>
                Sushi
              </button>
              <button onClick={() => setSearchParams({ q: "Cơm tấm" })}>
                Cơm tấm
              </button>
            </div>
          </div>
        ) : (
          <div className="sp-grid">
            {filteredItems.map((item, index) => {
              if (item.type === "RESTAURANT" && item.restaurant) {
                const r = item.restaurant;
                const img =
                  r.coverImage ||
                  r.avatar ||
                  "https://placehold.co/600x400?text=Restaurant";
                return (
                  <div
                    key={index}
                    className="sp-card"
                    onClick={() => handleClickItem(item)}
                  >
                    <div className="card-media">
                      <img src={img} alt={r.name} loading="lazy" />
                      <span className="badge badge-res">Nhà hàng</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={r.name}>
                          {r.name}
                        </h3>
                        {r.avgRating > 0 && (
                          <div className="rating">
                            <Star size={14} fill="#eab308" stroke="none" />
                            <span>{r.avgRating}</span>
                          </div>
                        )}
                      </div>
                      <div className="meta">
                        <div className="row">
                          <MapPin size={14} />
                          <span className="address">
                            {r.address?.district}, {r.address?.city}
                          </span>
                        </div>
                        <div className="cuisine-tag">
                          {r.cuisineType || "Đa dạng"}
                        </div>
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem chi tiết</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                );
              }

              if (item.type === "MENU_ITEM" && item.menuItem) {
                const m = item.menuItem;
                const img =
                  m.thumbImage ||
                  m.image ||
                  "https://placehold.co/600x400?text=Menu+Item";
                const price =
                  m.basePrice != null
                    ? m.basePrice
                    : m.price != null
                    ? m.price
                    : 0;

                return (
                  <div
                    key={index}
                    className="sp-card"
                    onClick={() => handleClickItem(item)}
                  >
                    <div className="card-media">
                      <img src={img} alt={m.name} loading="lazy" />
                      <span className="badge badge-food">Món ăn</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={m.name}>
                          {m.name}
                        </h3>
                      </div>
                      <div className="meta">
                        <div className="row price">
                          {price > 0
                            ? `${price.toLocaleString()}đ`
                            : "Giá liên hệ"}
                        </div>
                        <div className="restaurant-ref">
                          tại{" "}
                          <strong>{m.restaurant?.name || "Nhà hàng"}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem chi tiết món</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                );
              }

              if (item.type === "OWNER" && item.owner) {
                const o = item.owner;
                return (
                  <div
                    key={index}
                    className="sp-card sp-card--owner"
                    onClick={() => handleClickItem(item)}
                  >
                    <div className="card-media owner-media">
                      <div className="owner-avatar">
                        <User size={24} />
                      </div>
                      <span className="badge">Chủ / Quản lý</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={o.fullName || o.email}>
                          {o.fullName || o.email || "Chủ nhà hàng"}
                        </h3>
                      </div>
                      <div className="meta owner-meta">
                        {o.email && (
                          <div className="row">
                            <Mail size={14} />
                            <span>{o.email}</span>
                          </div>
                        )}
                        {o.phone && (
                          <div className="row">
                            <Phone size={14} />
                            <span>{o.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem hồ sơ</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                );
              }

              if (item.type === "LOCATION") {
                const label = item.locationLabel;
                const city = item.locationCity;
                const district = item.locationDistrict;
                return (
                  <div
                    key={index}
                    className="sp-card sp-card--location"
                    onClick={() => handleClickItem(item)}
                  >
                    <div className="card-media location-media">
                      <div className="location-icon">
                        <MapPin size={22} />
                      </div>
                      <span className="badge">Khu vực</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={label}>
                          {label}
                        </h3>
                      </div>
                      <div className="meta">
                        <div className="row">
                          <span>
                            {[district, city].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Lọc theo khu vực</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
