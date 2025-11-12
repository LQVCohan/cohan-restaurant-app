import React, { useContext, useEffect, useMemo, useState } from "react";
import CustomerList from "./CustomerList";
import CustomerFilters from "./CustomerFilters";
import PromotionModal from "./PromotionModal";
import CustomerDetailModal from "./CustomerModal";
import AddCustomerModal from "./AddCustomerModal";
import useUserManagement from "../../../hooks/useUserManagement";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { AuthContext } from "../../../context/AuthContext";
import "./CustomerManagement.scss";

/* ===== Helpers ===== */
const toDateStringVI = (ts) => {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const ms = String(ts).length === 10 ? ts * 1000 : ts;
    return new Date(ms).toLocaleDateString("vi-VN");
  }
  if (typeof ts === "string" && /^\d+$/.test(ts)) {
    const n = Number(ts);
    const ms = String(n).length === 10 ? n * 1000 : n;
    return new Date(ms).toLocaleDateString("vi-VN");
  }
  const p = Date.parse(ts);
  if (!Number.isNaN(p)) return new Date(p).toLocaleDateString("vi-VN");
  return new Date().toLocaleDateString("vi-VN");
};

const buildRecentOrdersForUser = (orders = []) =>
  orders.slice(0, 5).map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    date: toDateStringVI(o.createdAt),
    amount: o?.totals?.grandTotal || 0,
    items: (o.items || []).map((it) => it.name).filter(Boolean),
    raw: o,
  }));

const GUEST_BADGE = "🟡";

const CustomerManagement = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};

  const {
    filteredCustomers,
    loading: usersLoading,
    searchCustomers,
    filterCustomers,
    switchRestaurant,
    getCustomers,
  } = useUserManagement();

  const { loadOrdersAll, ordersAll, ordersAllLoading } = useOrderManagement();

  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState(defaultRestaurantId);

  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* Sync default restaurant */
  useEffect(() => {
    if (!selectedRestaurantId && restaurants?.length) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  /* Initial fetch + when restaurant changes */
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

  /* Search & filter */
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
  const formatCompactCount = (n) =>
    new Intl.NumberFormat("vi-VN", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Number(n || 0));

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    switchRestaurant(restaurantId);
  };

  /* Orders map */
  const ordersByUserId = useMemo(() => {
    const map = new Map();
    (ordersAll || []).forEach((o) => {
      const uid = o?.user?.id;
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(o);
    });
    for (const [, list] of map.entries()) {
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

  /* Decorate customers with recent orders + keep guest icon on card (not in name) */
  const customersDecorated = useMemo(() => {
    return (filteredCustomers || []).map((c) => {
      const uid = c.id;
      const userOrders = (uid && ordersByUserId.get(uid)) || [];
      const recentOrders = buildRecentOrdersForUser(userOrders);
      return {
        ...c,
        // tên KH không gắn icon vàng; icon sẽ hiển thị riêng trên card như trước
        displayName: c.name || "Khách hàng",
        recentOrders,
        isGuestBadge: c.isGuest ? GUEST_BADGE : "",
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
  const loading = usersLoading || ordersAllLoading;

  return (
    <div
      className={`customer-management ${
        showRightSidebar ? "is-sidebar-open" : ""
      }`}
    >
      {/* Header */}
      <header className="cm-header">
        <div className="cm-header__left">
          <div className="cm-header__icon">👥</div>
          <div className="cm-header__info">
            <h1>Quản Lý Khách Hàng</h1>
            <select
              value={selectedRestaurantId}
              onChange={(e) => handleRestaurantChange(e.target.value)}
              className="cm-restaurant"
            >
              {(restaurants || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cm-header__right">
          <div className="cm-header__stat">
            <span className="dot" />
            <span>24 Online</span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn--primary"
          >
            ➕ Thêm khách hàng
          </button>

          <button
            onClick={() => setShowRightSidebar((v) => !v)}
            className="btn btn--secondary"
          >
            ⚙️ Bộ Lọc
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="cm-toolbar">
        <div className="cm-toolbar__left">
          <div className="cm-search">
            <span className="cm-search__icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm khách hàng... (Ctrl + K)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="cm-quick">
            {quickFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                className={`cm-quick__pill ${
                  activeFilter === f.key ? "is-active" : ""
                }`}
                title={`${f.label}: ${f.count.toLocaleString("vi-VN")}`}
              >
                <span className="cm-quick__icon">{f.icon}</span>
                <span className="cm-quick__label">{f.label}</span>
                <span className="cm-quick__count">
                  {formatCompactCount(f.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cm-toolbar__right">
          <button className="btn btn--primary">📊 Xuất Báo Cáo</button>
          <button
            onClick={() => setShowPromotionModal(true)}
            className="btn btn--success"
          >
            📧 Gửi Khuyến Mãi
          </button>
        </div>
      </div>

      {/* Content Grid: content + sidebar (2 cột) */}
      <main className="cm-content">
        <section className="cm-content__main">
          <CustomerList
            customers={customersDecorated}
            loading={loading}
            onCustomerClick={handleCustomerClick}
          />
        </section>

        <aside className="cm-content__sidebar">
          <CustomerFilters
            onClose={() => setShowRightSidebar(false)}
            onApplyFilters={filterCustomers}
          />
        </aside>
      </main>

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
