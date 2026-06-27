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
  ChevronLeft,
  Clock,
  Sparkles,
} from "lucide-react";
import "./SearchPage.scss";

const POPULAR_KEYWORDS = ["Pizza", "Sushi", "Cơm tấm", "Lẩu", "Cà phê"];
const TABS = [
  { value: "ALL", label: "Tất cả", icon: Sparkles },
  { value: "RESTAURANT", label: "Nhà hàng", icon: Store },
  { value: "MENU_ITEM", label: "Món ăn", icon: Utensils },
];

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
    const nextQuery = localSearch.trim();
    if (nextQuery) {
      setSearchParams({ q: nextQuery });
      return;
    }
    setSearchParams({});
  };

  const tabCounts = useMemo(() => {
    const items = results?.items || [];
    return {
      ALL: items.length,
      RESTAURANT: items.filter((item) => item.type === "RESTAURANT").length,
      MENU_ITEM: items.filter((item) => item.type === "MENU_ITEM").length,
    };
  }, [results]);

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

  const handleCardKeyDown = (event, item) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleClickItem(item);
  };

  const renderSkeletons = () => (
    <div className="sp-grid" role="status" aria-live="polite" aria-label="Đang tải kết quả tìm kiếm">
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
    <main className="sp-container">
      <section className="sp-header" aria-labelledby="search-page-title">
        <div className="sp-hero-copy">
          <button type="button" className="sp-back-link" onClick={() => navigate(-1)}>
            <ChevronLeft size={16} /> Quay lại
          </button>
          <span className="sp-kicker">Tìm kiếm thông minh</span>
          <h1 id="search-page-title" className="sp-title">
            Tìm đúng món, đúng quán nhanh hơn
          </h1>
          <p className="sp-subtitle">
            Nhập tên món, nhà hàng hoặc khu vực. Cohan sẽ gom kết quả theo món ăn, nhà hàng và gợi ý liên quan để bạn chọn nhanh hơn.
          </p>
        </div>

        <form className="sp-search-bar" onSubmit={handleSearch} aria-label="Tìm kiếm món ăn hoặc nhà hàng">
          <Search className="icon" size={20} aria-hidden="true" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm món ăn, nhà hàng, khu vực..."
            aria-label="Từ khóa tìm kiếm"
          />
          <button type="submit" className="btn-search">
            Tìm kiếm
          </button>
        </form>

        <div className="sp-search-meta" aria-label="Gợi ý tìm kiếm">
          <Clock size={16} aria-hidden="true" />
          <span>Gợi ý nhanh:</span>
          {POPULAR_KEYWORDS.map((keyword) => (
            <button key={keyword} type="button" onClick={() => setSearchParams({ q: keyword })}>
              {keyword}
            </button>
          ))}
        </div>

        <div className="sp-tabs" role="tablist" aria-label="Lọc loại kết quả">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={`tab ${activeTab === value ? "active" : ""}`}
              onClick={() => setActiveTab(value)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
              <small>{tabCounts[value] || 0}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="sp-content" aria-live="polite">
        <div className="sp-result-summary">
          <div>
            <span>Kết quả cho</span>
            <strong>{q ? `“${q}”` : "từ khóa của bạn"}</strong>
          </div>
          <p>{loading ? "Đang tìm dữ liệu phù hợp..." : `${filteredItems.length} kết quả đang hiển thị`}</p>
        </div>

        {loading ? (
          renderSkeletons()
        ) : !filteredItems || filteredItems.length === 0 ? (
          <div className="sp-empty">
            <div className="empty-img">🔍</div>
            <h3>Chưa có kết quả phù hợp</h3>
            <p>
              {q ? (
                <>
                  Chúng tôi chưa tìm thấy kết quả cho <strong>{q}</strong>. Hãy thử từ khóa ngắn hơn hoặc chọn một gợi ý bên dưới.
                </>
              ) : (
                "Nhập tên món, nhà hàng hoặc khu vực để bắt đầu tìm kiếm."
              )}
            </p>
            <div className="suggestions">
              <span>Thử nhanh:</span>
              {POPULAR_KEYWORDS.slice(0, 3).map((keyword) => (
                <button key={keyword} type="button" onClick={() => setSearchParams({ q: keyword })}>
                  {keyword}
                </button>
              ))}
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
                  <article
                    key={index}
                    className="sp-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media">
                      <img src={img} alt={`Không gian nhà hàng ${r.name}`} loading="lazy" />
                      <span className="badge badge-res">Nhà hàng</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={r.name}>
                          {r.name}
                        </h3>
                        {r.avgRating > 0 && (
                          <div className="rating" aria-label={`Đánh giá ${r.avgRating} sao`}>
                            <Star size={14} fill="currentColor" stroke="none" aria-hidden="true" />
                            <span>{r.avgRating}</span>
                          </div>
                        )}
                      </div>
                      <div className="meta">
                        <div className="row">
                          <MapPin size={14} aria-hidden="true" />
                          <span className="address">
                            {[r.address?.district, r.address?.city].filter(Boolean).join(", ") || "Đang cập nhật vị trí"}
                          </span>
                        </div>
                        <div className="cuisine-tag">
                          {r.cuisineType || "Đa dạng"}
                        </div>
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem chi tiết</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
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
                  <article
                    key={index}
                    className="sp-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media">
                      <img src={img} alt={`Món ${m.name}`} loading="lazy" />
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
                          tại <strong>{m.restaurant?.name || "Nhà hàng"}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem chi tiết món</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
                );
              }

              if (item.type === "OWNER" && item.owner) {
                const o = item.owner;
                return (
                  <article
                    key={index}
                    className="sp-card sp-card--owner"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media owner-media">
                      <div className="owner-avatar">
                        <User size={24} aria-hidden="true" />
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
                            <Mail size={14} aria-hidden="true" />
                            <span>{o.email}</span>
                          </div>
                        )}
                        {o.phone && (
                          <div className="row">
                            <Phone size={14} aria-hidden="true" />
                            <span>{o.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem hồ sơ</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
                );
              }

              if (item.type === "LOCATION") {
                const label = item.locationLabel;
                const city = item.locationCity;
                const district = item.locationDistrict;
                return (
                  <article
                    key={index}
                    className="sp-card sp-card--location"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media location-media">
                      <div className="location-icon">
                        <MapPin size={22} aria-hidden="true" />
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
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
                );
              }

              return null;
            })}
          </div>
        )}
      </section>
    </main>
  );
}