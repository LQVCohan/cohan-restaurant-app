import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Crown,
  Medal,
  Utensils,
  Coffee, // Icon cho đồ uống
  Calendar,
  LayoutGrid,
} from "lucide-react";
import "./TopDishes.scss";

// HELPER: Format tiền tệ
const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

const TopDishes = () => {
  // --- STATES ---
  const [sortBy, setSortBy] = useState("quantity"); // 'quantity' | 'revenue'
  const [timeRange, setTimeRange] = useState("today"); // 'today' | 'week' | 'month'
  const [category, setCategory] = useState("all"); // 'all' | 'food' | 'drink'

  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsTimeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- MOCK DATA (Cập nhật thêm type) ---
  const rawDishes = [
    {
      id: 1,
      name: "Sashimi Bào Ngư Vi Cá",
      price: 1250000,
      sales: 85,
      type: "food",
      img: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=100&q=80",
    },
    {
      id: 2,
      name: "Bò Wagyu A5 Dát Vàng",
      price: 2800000,
      sales: 62,
      type: "food",
      img: "https://images.unsplash.com/photo-1558030006-4506719b7402?auto=format&fit=crop&w=100&q=80",
    },
    {
      id: 3,
      name: "Tôm Hùm Alaska Bỏ Lò",
      price: 1850000,
      sales: 45,
      type: "food",
      img: null,
    },
    {
      id: 4,
      name: "Cocktail Blue Ocean",
      price: 180000,
      sales: 120,
      type: "drink", // Món nước
      img: null,
    },
    {
      id: 5,
      name: "Rượu Sake Gold Flake",
      price: 3200000,
      sales: 20,
      type: "drink", // Món nước
      img: null,
    },
    {
      id: 6,
      name: "Salad Rong Nho",
      price: 150000,
      sales: 90,
      type: "food",
      img: null,
    },
  ];

  // --- LOGIC XỬ LÝ DỮ LIỆU ---
  const processedData = useMemo(() => {
    let data = [...rawDishes];

    // 1. Lọc theo Category
    if (category !== "all") {
      data = data.filter((d) => d.type === category);
    }

    // 2. Giả lập Lọc theo Time Range (Trong thực tế sẽ gọi API khác)
    // Ở đây mình nhân hệ số random nhẹ để demo số liệu thay đổi
    const multiplier =
      timeRange === "week" ? 5 : timeRange === "month" ? 20 : 1;

    data = data.map((d) => ({
      ...d,
      sales: d.sales * multiplier, // Giả lập số bán tăng theo thời gian
      revenue: d.price * (d.sales * multiplier),
    }));

    // 3. Sắp xếp
    data.sort((a, b) =>
      sortBy === "quantity" ? b.sales - a.sales : b.revenue - a.revenue
    );

    // 4. Cắt Top 5
    const top5 = data.slice(0, 5);

    // 5. Tính Max Value để vẽ Chart
    const maxValue = Math.max(
      ...top5.map((d) => (sortBy === "quantity" ? d.sales : d.revenue))
    );

    return { data: top5, maxValue };
  }, [sortBy, timeRange, category]);

  // --- RENDER HELPERS ---
  const renderRankIcon = (index) => {
    if (index === 0) return <Crown size={16} fill="#fbbf24" stroke="#fbbf24" />;
    if (index === 1) return <Medal size={16} fill="#94a3b8" stroke="#94a3b8" />;
    if (index === 2) return <Medal size={16} fill="#b45309" stroke="#b45309" />;
    return <span className="rank-num">#{index + 1}</span>;
  };

  const timeLabels = { today: "Hôm nay", week: "Tuần này", month: "Tháng này" };

  return (
    <div className="top-dishes-widget">
      {/* 1. HEADER CHÍNH */}
      <div className="widget-header">
        <h3 className="widget-title">Top Món Bán Chạy</h3>

        {/* Time Filter Dropdown */}
        <div className="time-filter-dropdown" ref={dropdownRef}>
          <button
            className="btn-dropdown-trigger"
            onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
          >
            <Calendar size={14} />
            <span>{timeLabels[timeRange]}</span>
            <ChevronDown size={14} />
          </button>

          {isTimeDropdownOpen && (
            <div className="dropdown-menu">
              {Object.entries(timeLabels).map(([key, label]) => (
                <div
                  key={key}
                  className={`dropdown-item ${
                    timeRange === key ? "active" : ""
                  }`}
                  onClick={() => {
                    setTimeRange(key);
                    setIsTimeDropdownOpen(false);
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ (Filter & Sort) */}
      <div className="control-bar">
        {/* Category Tabs */}
        <div className="pill-tabs category-tabs">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
          >
            Tất cả
          </button>
          <button
            className={category === "food" ? "active" : ""}
            onClick={() => setCategory("food")}
          >
            <Utensils size={12} /> Món ăn
          </button>
          <button
            className={category === "drink" ? "active" : ""}
            onClick={() => setCategory("drink")}
          >
            <Coffee size={12} /> Đồ uống
          </button>
        </div>

        {/* Sort Toggles */}
        <div className="pill-tabs sort-tabs">
          <button
            className={sortBy === "quantity" ? "active" : ""}
            onClick={() => setSortBy("quantity")}
            title="Sắp xếp theo số lượng"
          >
            SL
          </button>
          <button
            className={sortBy === "revenue" ? "active" : ""}
            onClick={() => setSortBy("revenue")}
            title="Sắp xếp theo doanh thu"
          >
            $$
          </button>
        </div>
      </div>

      {/* 3. LIST BODY */}
      <div className="dishes-list custom-scrollbar">
        {processedData.data.length > 0 ? (
          processedData.data.map((dish, index) => {
            const value = sortBy === "quantity" ? dish.sales : dish.revenue;
            const percent = (value / processedData.maxValue) * 100;

            return (
              <div key={dish.id} className="dish-row fade-in">
                {/* Cột 1: Rank & Ảnh */}
                <div className="col-visual">
                  <div className={`rank-badge rank-${index + 1}`}>
                    {renderRankIcon(index)}
                  </div>
                  <div className="img-wrapper">
                    {dish.img ? (
                      <img src={dish.img} alt={dish.name} />
                    ) : (
                      <div className="placeholder-img">
                        {dish.type === "drink" ? (
                          <Coffee size={14} />
                        ) : (
                          <Utensils size={14} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cột 2: Thông tin & Bar */}
                <div className="col-info">
                  <div className="info-top">
                    <h4 className="dish-name">{dish.name}</h4>
                    <div className="value-display">
                      {sortBy === "quantity" ? (
                        <>
                          <span className="primary-val">
                            {new Intl.NumberFormat("vi-VN").format(dish.sales)}
                          </span>
                          <span className="unit">suất</span>
                        </>
                      ) : (
                        <span className="primary-val revenue">
                          {formatCurrency(dish.revenue)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${percent}%`,
                        backgroundColor:
                          sortBy === "revenue" ? "#10b981" : undefined,
                      }}
                    />
                  </div>

                  <div className="info-sub">
                    <span>Giá: {formatCurrency(dish.price)}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <LayoutGrid size={32} />
            <p>Chưa có dữ liệu cho bộ lọc này</p>
          </div>
        )}
      </div>

      {/* 4. FOOTER */}
      <div className="widget-footer">
        <button className="view-all-link">
          Xem báo cáo chi tiết <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default TopDishes;
