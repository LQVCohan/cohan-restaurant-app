// src/pages/CustomerManagement/index.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import CustomerList from "./CustomerList";
import CustomerFilters from "./CustomerFilters";
import PromotionModal from "./PromotionModal";
import CustomerDetailModal from "./CustomerModal";
import AddCustomerModal from "./AddCustomerModal";
import useUserManagement from "../../../hooks/useUserManagement";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { AuthContext } from "../../../context/AuthContext"; // ⚠️ chỉnh path nếu khác
import "./CustomerManagement.scss";

// Helper: build recent orders array for cards/modals
const buildRecentOrdersForUser = (orders = []) => {
  return orders.slice(0, 5).map((o) => ({
    date:
      typeof o.createdAt === "number"
        ? new Date(
            String(o.createdAt).length === 10 ? o.createdAt * 1000 : o.createdAt
          ).toLocaleDateString("vi-VN")
        : new Date(o.createdAt).toLocaleDateString("vi-VN"),
    amount: o?.totals?.grandTotal || 0,
    items: (o.items || []).map((it) => it.name).filter(Boolean),
    orderCode: o.orderCode,
    id: o.id,
  }));
};

const GUEST_BADGE = "🟡";

const CustomerManagement = () => {
  // ⬇️ Lấy danh sách nhà hàng từ AuthContext (manager)
  const { restaurants = [] } = useContext(AuthContext) || {};

  const {
    customers,
    filteredCustomers,
    loading: usersLoading,
    searchCustomers,
    filterCustomers,
    switchRestaurant,
    getCustomers,
  } = useUserManagement();

  const { loadOrdersAll, ordersAll, ordersAllLoading } = useOrderManagement();

  // chọn nhà hàng theo id (lấy từ context)
  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState(defaultRestaurantId);

  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Đồng bộ khi context nhà hàng thay đổi (lần đầu/mỗi khi reload profile)
  useEffect(() => {
    if (!selectedRestaurantId && restaurants?.length) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  // Fetch customers + orders khi mount/đổi nhà hàng
  useEffect(() => {
    getCustomers({ includeGuests: true, search: "" });

    if (selectedRestaurantId) {
      loadOrdersAll({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 300,
          cursor: null,
        },
        fetchPolicy: "network-only",
      });
    }
  }, [getCustomers, loadOrdersAll, selectedRestaurantId]);

  // Search (áp dụng FE filter + có thể refetch ordersAll nếu muốn)
  const handleSearch = (query) => {
    setSearchQuery(query);
    searchCustomers(query);
    if (selectedRestaurantId) {
      loadOrdersAll({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 300,
          cursor: null,
        },
        fetchPolicy: "network-only",
      });
    }
  };

  const handleFilter = (filter) => {
    setActiveFilter(filter);
    filterCustomers(filter);
  };

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    // Nếu hook user có switchRestaurant theo code, bạn có thể pass name/slug
    // Ở đây giữ nguyên để không phá flow hiện tại
    switchRestaurant(restaurantId);
  };

  // Map orders -> userId
  const ordersByUserId = useMemo(() => {
    const map = new Map();
    (ordersAll || []).forEach((o) => {
      const uid = o?.user?.id;
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(o);
    });
    // sort desc theo createdAt
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => {
        const ta =
          typeof a.createdAt === "number"
            ? (String(a.createdAt).length === 10
                ? a.createdAt * 1000
                : a.createdAt) || 0
            : Date.parse(a.createdAt) || 0;
        const tb =
          typeof b.createdAt === "number"
            ? (String(b.createdAt).length === 10
                ? b.createdAt * 1000
                : b.createdAt) || 0
            : Date.parse(b.createdAt) || 0;
        return tb - ta;
      });
    }
    return map;
  }, [ordersAll]);

  // Gắn recentOrders + icon Guest vào mỗi customer
  const customersDecorated = useMemo(() => {
    return (filteredCustomers || []).map((c) => {
      const uid = c.id;
      const userOrders = (uid && ordersByUserId.get(uid)) || [];
      const recentOrders = buildRecentOrdersForUser(userOrders);

      const baseName = c.name || "Khách hàng";
      const displayName = c.isGuest ? `${baseName} ${GUEST_BADGE}` : baseName;

      return {
        ...c,
        name: displayName,
        displayName,
        recentOrders,
      };
    });
  }, [filteredCustomers, ordersByUserId]);

  const quickFilters = useMemo(() => {
    const total = customersDecorated.length || 0;
    const vip = customersDecorated.filter(
      (c) => c.customerType === "VIP"
    ).length;
    const isNew = customersDecorated.filter(
      (c) => c.customerType === "Mới"
    ).length;
    const often = customersDecorated.filter(
      (c) => c.customerType === "Thường xuyên"
    ).length;

    return [
      { key: "all", label: "Tất cả", icon: "👥", count: total },
      { key: "vip", label: "VIP", icon: "⭐", count: vip },
      { key: "new", label: "Mới", icon: "🆕", count: isNew },
      { key: "frequent", label: "Thường xuyên", icon: "🔥", count: often },
    ];
  }, [customersDecorated]);

  const handleCustomerClick = (customer) => setSelectedCustomer(customer);
  const handleSidebarToggle = () => setShowRightSidebar(!showRightSidebar);

  const loading = usersLoading || ordersAllLoading;

  return (
    <div className="customer-management">
      {/* Header */}
      <div className="customer-management__header">
        <div className="header__content">
          <div className="header__left">
            <div className="header__icon">
              <span>👥</span>
            </div>
            <div className="header__info">
              <h1>Quản Lý Khách Hàng</h1>

              {/* Dropdown nhà hàng từ AuthContext */}
              <select
                value={selectedRestaurantId}
                onChange={(e) => handleRestaurantChange(e.target.value)}
                className="restaurant-selector"
              >
                {(restaurants || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <div className="header__legend">
                <span className="legend-item">
                  <span className="legend-dot">{GUEST_BADGE}</span> Guest
                </span>
              </div>
            </div>
          </div>

          <div className="header__right">
            <div className="stats">
              <div className="stat-item stat-item--online">
                <div className="stat-indicator"></div>
                <span>24 Online</span>
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn--primary"
              style={{ marginRight: 8 }}
            >
              <span>➕</span>
              <span>Thêm khách hàng</span>
            </button>

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
                  <span className="count">{filter.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar__right">
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
            customers={customersDecorated}
            loading={loading}
            onCustomerClick={handleCustomerClick}
          />
        </div>

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
          customers={customersDecorated}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {showAddModal && (
        <AddCustomerModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
};

export default CustomerManagement;
