import React, { useState } from "react";
import CustomerList from "./CustomerList";
import CustomerFilters from "./CustomerFilters";
import PromotionModal from "./PromotionModal";
import CustomerDetailModal from "./CustomerModal";
import useCustomers from "../../../hooks/useCustomers";
import "./CustomerManagement.scss";

const CustomerManagement = () => {
  const {
    customers,
    filteredCustomers,
    loading,
    searchCustomers,
    filterCustomers,
    switchRestaurant,
  } = useCustomers();

  const [selectedRestaurant, setSelectedRestaurant] = useState("saigon");
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const restaurants = [
    { value: "saigon", label: "🏮 Nhà Hàng Sài Gòn" },
    { value: "hanoi", label: "🏛️ Nhà Hàng Hà Nội" },
    { value: "danang", label: "🌊 Nhà Hàng Đà Nẵng" },
  ];

  const quickFilters = [
    { key: "all", label: "Tất cả", icon: "👥", count: 1247 },
    { key: "vip", label: "VIP", icon: "⭐", count: 89 },
    { key: "new", label: "Mới", icon: "🆕", count: 156 },
    { key: "frequent", label: "Thường xuyên", icon: "🔥", count: 234 },
  ];

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurant(restaurantId);
    switchRestaurant(restaurantId);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    searchCustomers(query);
  };

  const handleFilter = (filter) => {
    setActiveFilter(filter);
    filterCustomers(filter);
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleSidebarToggle = () => {
    setShowRightSidebar(!showRightSidebar);
  };

  return (
    <div className="customer-management">
      {/* Page Header */}
      <div className="customer-management__header">
        <div className="header__content">
          <div className="header__left">
            <div className="header__icon">
              <span>👥</span>
            </div>
            <div className="header__info">
              <h1>Quản Lý Khách Hàng</h1>
              <select
                value={selectedRestaurant}
                onChange={(e) => handleRestaurantChange(e.target.value)}
                className="restaurant-selector"
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.value} value={restaurant.value}>
                    {restaurant.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="header__right">
            <div className="stats">
              <div className="stat-item stat-item--online">
                <div className="stat-indicator"></div>
                <span>24 Online</span>
              </div>
              <div className="stat-item stat-item--total">
                <span>📊</span>
                <span>1,247 Khách</span>
              </div>
            </div>

            <button
              onClick={handleSidebarToggle}
              className="btn btn--secondary"
            >
              <span>⚙️</span>
              <span>Bộ Lọc</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="customer-management__toolbar">
        <div className="toolbar__left">
          {/* Search */}
          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm kiếm khách hàng..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            <div className="search-icon">🔍</div>
          </div>

          {/* Quick Filters */}
          <div className="quick-filters">
            {quickFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => handleFilter(filter.key)}
                className={`filter-btn ${
                  activeFilter === filter.key ? "active" : ""
                }`}
              >
                <span>{filter.icon}</span>
                <div className="filter-btn__content">
                  <span>{filter.label}</span>
                  <span className="count">{filter.count}</span>{" "}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar__right">
          <div className="toolbar-controls">
            <div className="control-group">
              <span>Sắp xếp:</span>
              <select className="control-select">
                <option value="recent">Hoạt động gần nhất</option>
                <option value="name">Tên A-Z</option>
                <option value="spending">Chi tiêu cao nhất</option>
                <option value="visits">Số lần ghé thăm</option>
                <option value="joined">Ngày tham gia</option>
              </select>
            </div>
          </div>

          <button className="btn btn--primary">
            <span>📊</span>
            <span>Xuất Báo Cáo</span>
          </button>

          <button
            onClick={() => setShowPromotionModal(true)}
            className="btn btn--success"
          >
            <span>📧</span>
            <span>Gửi Khuyến Mãi</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="customer-management__content">
        <div className="content__main">
          <CustomerList
            customers={filteredCustomers}
            loading={loading}
            onCustomerClick={handleCustomerClick}
          />
        </div>

        {/* Right Sidebar */}
        <div className={`content__sidebar ${showRightSidebar ? "show" : ""}`}>
          <CustomerFilters
            onClose={() => setShowRightSidebar(false)}
            onApplyFilters={filterCustomers}
          />
        </div>
      </div>

      {/* Modals */}
      {showPromotionModal && (
        <PromotionModal
          onClose={() => setShowPromotionModal(false)}
          customers={customers}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};

export default CustomerManagement;
