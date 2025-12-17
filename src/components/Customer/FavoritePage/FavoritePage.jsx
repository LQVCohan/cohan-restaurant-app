import React, { useState, useMemo } from "react";
import {
  Heart,
  Search,
  ShoppingBag,
  MapPin,
  Star,
  ChefHat,
  Layers,
  ArrowRight,
  Trash2,
  Plus,
} from "lucide-react";
import "./FavoritePage.scss";

// --- MOCK DATA ---
const FAVORITES_DATA = [
  // 1. NHÀ HÀNG
  {
    id: 1,
    type: "restaurant",
    name: "Kichi Kichi - Lẩu Băng Chuyền",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    rating: 4.8,
    reviews: 120,
    distance: "2.5km",
    address: "Vincom Đồng Khởi, Q.1",
    status: "open",
  },
  {
    id: 2,
    type: "restaurant",
    name: "Pizza 4P's - Ben Thanh",
    image:
      "https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=600&q=80",
    rating: 4.9,
    reviews: 850,
    distance: "1.2km",
    address: "Thủ Khoa Huân, Q.1",
    status: "closed",
  },
  // 2. MÓN ĂN
  {
    id: 3,
    type: "food",
    name: "Burger Bò Wagyu Phô Mai",
    restaurant: "Burger King",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
    price: 159000,
    oldPrice: 199000,
    rating: 4.5,
    sold: 500,
  },
  {
    id: 4,
    type: "food",
    name: "Cơm Tấm Sườn Bì Chả",
    restaurant: "Cơm Tấm Cali",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
    price: 65000,
    rating: 4.7,
    sold: 1200,
  },
  // 3. ĐẦU BẾP
  {
    id: 5,
    type: "chef",
    name: "Chef Gordon Ramsay",
    specialty: "Món Âu Cao Cấp",
    image:
      "https://images.unsplash.com/photo-1583394293214-28ded15ee548?auto=format&fit=crop&w=600&q=80",
    followers: "125k",
    recipes: 45,
  },
  // 4. BỘ SƯU TẬP (MỚI)
  {
    id: 6,
    type: "collection",
    name: "Healthy Food cho dân văn phòng",
    itemsCount: 12,
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80",
    author: "FoodHub Admin",
  },
];

const TABS = [
  { id: "all", label: "Tất cả", icon: <Heart size={18} /> },
  { id: "restaurant", label: "Nhà hàng", icon: <MapPin size={18} /> },
  { id: "food", label: "Món ăn", icon: <ShoppingBag size={18} /> },
  { id: "chef", label: "Đầu bếp", icon: <ChefHat size={18} /> },
  { id: "collection", label: "Bộ sưu tập", icon: <Layers size={18} /> },
];

const FavoritePage = () => {
  const [activeTab, setActiveTab] = useState("all");

  const filteredData = useMemo(() => {
    return activeTab === "all"
      ? FAVORITES_DATA
      : FAVORITES_DATA.filter((item) => item.type === activeTab);
  }, [activeTab]);

  return (
    <div className="favorite-page">
      <div className="fav-container">
        {/* HEADER */}
        <div className="page-header">
          <div className="header-content">
            <h1>Danh sách yêu thích ❤️</h1>
            <p>Lưu giữ những hương vị làm bạn say mê</p>
          </div>
          <div className="search-bar-mini">
            <Search size={18} />
            <input type="text" placeholder="Tìm trong yêu thích..." />
          </div>
        </div>

        {/* TABS FILTER */}
        <div className="tabs-wrapper">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-pill ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* GRID CONTENT */}
        <div className="fav-grid">
          {filteredData.map((item) => (
            <div key={item.id} className="fav-card">
              {/* IMAGE AREA */}
              <div className="card-image">
                <img src={item.image} alt={item.name} />
                <button className="btn-remove-fav" title="Bỏ thích">
                  <Heart size={18} fill="#ff4d4f" color="#ff4d4f" />
                </button>
                {item.status === "closed" && (
                  <div className="overlay-closed">Đã đóng cửa</div>
                )}
                {item.type === "food" && item.oldPrice && (
                  <span className="discount-tag">
                    Giảm {Math.round((1 - item.price / item.oldPrice) * 100)}%
                  </span>
                )}
              </div>

              {/* INFO AREA */}
              <div className="card-info">
                {/* --- RENDER LOGIC THEO TYPE --- */}

                {/* 1. TYPE: RESTAURANT */}
                {item.type === "restaurant" && (
                  <>
                    <div className="top-row">
                      <h3 className="name">{item.name}</h3>
                      <div className="rating">
                        <Star size={12} fill="#ffc107" color="#ffc107" />{" "}
                        {item.rating}
                      </div>
                    </div>
                    <p className="sub-text">
                      <MapPin size={12} /> {item.address} • {item.distance}
                    </p>
                    <div className="action-row">
                      <button className="btn-primary-outline">Xem Menu</button>
                      <button className="btn-primary-solid">Đến Quán</button>
                    </div>
                  </>
                )}

                {/* 2. TYPE: FOOD */}
                {item.type === "food" && (
                  <>
                    <div className="top-row">
                      <h3 className="name">{item.name}</h3>
                    </div>
                    <p className="sub-text">{item.restaurant}</p>
                    <div className="price-row">
                      <span className="price">
                        {item.price.toLocaleString()}đ
                      </span>
                      {item.oldPrice && (
                        <span className="old-price">
                          {item.oldPrice.toLocaleString()}đ
                        </span>
                      )}
                    </div>
                    <div className="action-row">
                      <button className="btn-cart">
                        <Plus size={16} /> Thêm vào giỏ
                      </button>
                    </div>
                  </>
                )}

                {/* 3. TYPE: CHEF */}
                {item.type === "chef" && (
                  <>
                    <div className="chef-badge">
                      <ChefHat size={14} /> Đầu bếp
                    </div>
                    <h3 className="name text-center">{item.name}</h3>
                    <p className="sub-text text-center">{item.specialty}</p>
                    <div className="stats-row">
                      <span>
                        <strong>{item.recipes}</strong> Công thức
                      </span>
                      <span>
                        <strong>{item.followers}</strong> Theo dõi
                      </span>
                    </div>
                    <button className="btn-primary-outline full-width">
                      Xem Hồ Sơ
                    </button>
                  </>
                )}

                {/* 4. TYPE: COLLECTION */}
                {item.type === "collection" && (
                  <>
                    <div className="collection-badge">
                      <Layers size={14} /> Bộ sưu tập
                    </div>
                    <h3 className="name">{item.name}</h3>
                    <p className="sub-text">Bởi {item.author}</p>
                    <div className="action-row mt-auto">
                      <span className="item-count">
                        {item.itemsCount} địa điểm
                      </span>
                      <button className="btn-circle">
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* EMPTY STATE */}
        {filteredData.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <Heart size={64} />
            </div>
            <h3>Chưa có mục yêu thích nào</h3>
            <p>Hãy khám phá thêm và thả tim cho những món ngon nhé!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritePage;
