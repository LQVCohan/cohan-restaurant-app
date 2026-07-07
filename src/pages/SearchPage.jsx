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
  ChefHat,
} from "lucide-react";
import "./SearchPage.scss";

const POPULAR_KEYWORDS = ["Pizza", "Sushi", "Cơm tấm", "Lẩu", "Cà phê"];
const TABS = [
  { value: "ALL", label: "Tất cả", icon: Sparkles },
  { value: "RESTAURANT", label: "Nhà hàng", icon: Store },
  { value: "MENU_ITEM", label: "Món ăn", icon: Utensils },
  { value: "CHEF", label: "Bếp trưởng", icon: ChefHat },
  { value: "LOCATION", label: "Khu vực", icon: MapPin },
  { value: "OWNER", label: "Chủ / Quản lý", icon: User },
];

const resultKey = (item, index) =>
  `${item.type}-${
    item.restaurant?.id ||
    item.menuItem?.id ||
    item.chef?.id ||
    item.owner?.id ||
    item.locationLabel ||
    index
  }`;

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("ALL");
  const [localSearch, setLocalSearch] = useState(q);

  useEffect(() => {
    setLocalSearch(q);
    setActiveTab("ALL");
  }, [q]);

  const { results, loading } = useSearch(q, {}, 30, 0);

  const handleSearch = (event) => {
    event.preventDefault();
    const nextQuery = localSearch.trim();
    setSearchParams(nextQuery ? { q: nextQuery } : {});
  };

  const tabCounts = useMemo(() => {
    const items = results?.items || [];
    return TABS.reduce(
      (counts, tab) => {
        counts[tab.value] =
          tab.value === "ALL"
            ? items.length
            : items.filter((item) => item.type === tab.value).length;
        return counts;
      },
      {},
    );
  }, [results]);

  const visibleTabs = useMemo(
    () =>
      TABS.filter(
        (tab) => tab.value !== "OWNER" || (tabCounts.OWNER || 0) > 0,
      ),
    [tabCounts],
  );

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
      const restaurantId = item.restaurant?.id;
      const menuItemId = item.menuItem.id;
      if (restaurantId) {
        navigate(
          `/cus-menu?restaurantId=${encodeURIComponent(
            restaurantId,
          )}&menuItemId=${encodeURIComponent(menuItemId)}`,
        );
      }
      return;
    }

    if (item.type === "CHEF") {
      const restaurantId = item.chef?.restaurantId || item.restaurant?.id;
      if (restaurantId) navigate(`/restaurant/${restaurantId}`);
      return;
    }

    if (item.type === "OWNER" && item.owner?.id) {
      navigate(`/owner/${item.owner.id}`);
      return;
    }

    if (item.type === "LOCATION" && item.locationLabel) {
      setSearchParams({ q: item.locationLabel });
    }
  };

  const handleCardKeyDown = (event, item) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleClickItem(item);
  };

  const renderSkeletons = () => (
    <div
      className="sp-grid"
      role="status"
      aria-live="polite"
      aria-label="Đang tải kết quả tìm kiếm"
    >
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="sp-card skeleton">
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
          <button
            type="button"
            className="sp-back-link"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={16} /> Quay lại
          </button>
          <span className="sp-kicker">Tìm kiếm thông minh</span>
          <h1 id="search-page-title" className="sp-title">
            Tìm đúng món, đúng quán nhanh hơn
          </h1>
          <p className="sp-subtitle">
            Tìm theo món ăn, danh mục, khẩu phần, cách chế biến, nhà hàng,
            khu vực hoặc bếp trưởng.
          </p>
        </div>

        <form
          className="sp-search-bar"
          onSubmit={handleSearch}
          aria-label="Tìm món ăn, nhà hàng hoặc bếp trưởng"
        >
          <Search className="icon" size={20} aria-hidden="true" />
          <input
            type="search"
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
            placeholder="Tìm món, danh mục, nhà hàng, bếp trưởng..."
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
            <button
              key={keyword}
              type="button"
              onClick={() => setSearchParams({ q: keyword })}
            >
              {keyword}
            </button>
          ))}
        </div>

        <div className="sp-tabs" role="tablist" aria-label="Lọc loại kết quả">
          {visibleTabs.map(({ value, label, icon: Icon }) => (
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
          <p>
            {loading
              ? "Đang tìm dữ liệu phù hợp..."
              : `${filteredItems.length} kết quả đang hiển thị`}
          </p>
        </div>

        {loading ? (
          renderSkeletons()
        ) : filteredItems.length === 0 ? (
          <div className="sp-empty">
            <div className="empty-img">🔍</div>
            <h3>Chưa có kết quả phù hợp</h3>
            <p>
              {q ? (
                <>
                  Chúng tôi chưa tìm thấy kết quả cho <strong>{q}</strong>. Hãy
                  thử tên ngắn hơn, danh mục hoặc cách chế biến.
                </>
              ) : (
                "Nhập tên món, nhà hàng, khu vực hoặc bếp trưởng để bắt đầu."
              )}
            </p>
            <div className="suggestions">
              <span>Thử nhanh:</span>
              {POPULAR_KEYWORDS.slice(0, 3).map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setSearchParams({ q: keyword })}
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="sp-grid">
            {filteredItems.map((item, index) => {
              if (item.type === "RESTAURANT" && item.restaurant) {
                const restaurant = item.restaurant;
                const image =
                  restaurant.coverImage ||
                  restaurant.avatar ||
                  "https://placehold.co/600x400?text=Restaurant";

                return (
                  <article
                    key={resultKey(item, index)}
                    className="sp-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media">
                      <img
                        src={image}
                        alt={`Không gian nhà hàng ${restaurant.name}`}
                        loading="lazy"
                      />
                      <span className="badge badge-res">Nhà hàng</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={restaurant.name}>
                          {restaurant.name}
                        </h3>
                        {restaurant.avgRating > 0 && (
                          <div
                            className="rating"
                            aria-label={`Đánh giá ${restaurant.avgRating} sao`}
                          >
                            <Star
                              size={14}
                              fill="currentColor"
                              stroke="none"
                              aria-hidden="true"
                            />
                            <span>{restaurant.avgRating}</span>
                          </div>
                        )}
                      </div>
                      <div className="meta">
                        <div className="row">
                          <MapPin size={14} aria-hidden="true" />
                          <span className="address">
                            {[restaurant.address?.district, restaurant.address?.city]
                              .filter(Boolean)
                              .join(", ") || "Đang cập nhật vị trí"}
                          </span>
                        </div>
                        {restaurant.phone && (
                          <div className="row">
                            <Phone size={14} aria-hidden="true" />
                            <span>{restaurant.phone}</span>
                          </div>
                        )}
                        <div className="cuisine-tag">
                          {restaurant.cuisineType || "Đa dạng"}
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
                const menuItem = item.menuItem;
                const image =
                  menuItem.thumbImage ||
                  menuItem.image ||
                  "https://placehold.co/600x400?text=Menu+Item";
                const price =
                  menuItem.basePrice != null
                    ? menuItem.basePrice
                    : menuItem.price || 0;
                const cookingMethods = item.cookingMethods || [];
                const servingText = [
                  item.servingLabel,
                  cookingMethods.join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <article
                    key={resultKey(item, index)}
                    className="sp-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media">
                      <img src={image} alt={`Món ${menuItem.name}`} loading="lazy" />
                      <span className="badge badge-food">Món ăn</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={menuItem.name}>
                          {menuItem.name}
                        </h3>
                      </div>
                      <div className="meta">
                        <div className="row price">
                          {price > 0
                            ? `${price.toLocaleString()}đ`
                            : "Giá liên hệ"}
                        </div>
                        <div className="restaurant-ref">
                          tại <strong>{item.restaurant?.name || "Nhà hàng"}</strong>
                        </div>
                        {item.categoryName && (
                          <div className="cuisine-tag">{item.categoryName}</div>
                        )}
                        {servingText && (
                          <div className="row">
                            <Utensils size={14} aria-hidden="true" />
                            <span>{servingText}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem chi tiết món</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
                );
              }

              if (item.type === "CHEF" && item.chef) {
                const chef = item.chef;

                return (
                  <article
                    key={resultKey(item, index)}
                    className="sp-card sp-card--owner"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                  >
                    <div className="card-media owner-media">
                      <div className="owner-avatar">
                        <ChefHat size={28} aria-hidden="true" />
                      </div>
                      <span className="badge">Bếp trưởng</span>
                    </div>
                    <div className="card-info">
                      <div className="top-row">
                        <h3 className="name" title={chef.fullName}>
                          {chef.fullName || "Bếp trưởng"}
                        </h3>
                      </div>
                      <div className="meta owner-meta">
                        <div className="row">
                          <ChefHat size={14} aria-hidden="true" />
                          <span>{chef.positionTitle || "Bếp trưởng"}</span>
                        </div>
                        <div className="row">
                          <Store size={14} aria-hidden="true" />
                          <span>{chef.restaurantName}</span>
                        </div>
                        {chef.contactPhone && (
                          <div className="row">
                            <Phone size={14} aria-hidden="true" />
                            <span>{chef.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="card-action">
                      <span>Xem nhà hàng</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </article>
                );
              }

              if (item.type === "OWNER" && item.owner) {
                const owner = item.owner;

                return (
                  <article
                    key={resultKey(item, index)}
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
                        <h3 className="name" title={owner.fullName || owner.email}>
                          {owner.fullName || owner.email || "Chủ nhà hàng"}
                        </h3>
                      </div>
                      <div className="meta owner-meta">
                        {owner.email && (
                          <div className="row">
                            <Mail size={14} aria-hidden="true" />
                            <span>{owner.email}</span>
                          </div>
                        )}
                        {owner.phone && (
                          <div className="row">
                            <Phone size={14} aria-hidden="true" />
                            <span>{owner.phone}</span>
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
                    key={resultKey(item, index)}
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
