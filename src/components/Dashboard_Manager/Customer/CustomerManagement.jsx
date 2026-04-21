import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Gift,
  Star,
  Sparkles,
  Zap,
  UserCheck,
  BarChart3,
} from "lucide-react";

// Components
import CustomerList from "./CustomerList";
import CustomerFilters from "./CustomerFilters";
import PromotionModal from "./PromotionModal";
import CustomerDetailModal from "./CustomerModal";
import AddCustomerModal from "./AddCustomerModal";

// Hooks & Context
import useUserManagement from "../../../hooks/useUserManagement";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { AuthContext } from "../../../context/AuthContext";

// Styles
import "./CustomerManagement.scss";

const GET_CUSTOMER_RANK_SETTINGS = gql`
  query GetCustomerRankSettings($restaurantId: ID!) {
    customerRankSettings(restaurantId: $restaurantId) {
      restaurantId
      ranks {
        name
        minPoints
        benefits
      }
    }
  }
`;

const UPSERT_CUSTOMER_RANK_SETTINGS = gql`
  mutation UpsertCustomerRankSettings(
    $restaurantId: ID!
    $ranks: [RankThresholdInput!]!
  ) {
    upsertCustomerRankSettings(restaurantId: $restaurantId, ranks: $ranks) {
      restaurantId
      ranks {
        name
        minPoints
        benefits
      }
    }
  }
`;

/* ================== Helpers ================== */

const toDateStringVI = (ts) => {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    // Nếu timestamp là giây (10 số), đổi sang ms
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

// Tạo danh sách đơn hàng rút gọn để hiển thị nhanh
const buildRecentOrdersForUser = (orders = []) =>
  orders.slice(0, 5).map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    date: toDateStringVI(o.createdAt),
    amount: o?.totals?.grandTotal || 0,
    items: (o.items || []).map((it) => it.name).filter(Boolean),
    raw: o,
  }));

const buildTopDishes = (orders = []) => {
  const dishCount = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const name = item?.name?.trim();
      if (!name) continue;
      dishCount.set(name, (dishCount.get(name) || 0) + Number(item.quantity || 1));
    }
  }
  return [...dishCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dishName]) => dishName);
};

// Định dạng số lượng hiển thị trên nút lọc (VD: 1.2k)
const formatCompactCount = (n) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

/* ================== Main Component ================== */

const CustomerManagement = () => {
  // --- 1. Hooks & State ---
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

  // UI States
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Filter & Search States
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rankDraft, setRankDraft] = useState([]);

  const { data: rankSettingsData, refetch: refetchRankSettings } = useQuery(
    GET_CUSTOMER_RANK_SETTINGS,
    {
      skip: !selectedRestaurantId,
      variables: { restaurantId: selectedRestaurantId },
      fetchPolicy: "network-only",
    }
  );
  const [saveRankSettings, { loading: savingRank }] = useMutation(
    UPSERT_CUSTOMER_RANK_SETTINGS
  );

  // --- 2. Effects ---

  // Sync default restaurant ID khi load trang
  useEffect(() => {
    if (!selectedRestaurantId && restaurants?.length) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  // Fetch dữ liệu khách hàng và đơn hàng khi thay đổi nhà hàng
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

  // --- 3. Handlers ---

  const handleSearch = (query) => {
    setSearchQuery(query);
    searchCustomers(query);
    // Reload orders để đảm bảo dữ liệu mới nhất khi search
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

  const handleFilter = (filterKey) => {
    if (typeof filterKey === "object" && filterKey?.category) {
      filterKey = filterKey.category;
    }
    setActiveFilter(filterKey);
    filterCustomers(filterKey);
  };

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    switchRestaurant(restaurantId);
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleSaveRankSettings = async () => {
    if (!selectedRestaurantId || !rankDraft.length) return;
    await saveRankSettings({
      variables: {
        restaurantId: selectedRestaurantId,
        ranks: rankDraft.map((r) => ({
          name: r.name,
          minPoints: Number(r.minPoints || 0),
          benefits: r.benefits || "",
        })),
      },
    });
    await refetchRankSettings();
  };

  // --- 4. Data Processing (Memoized) ---

  // Gom nhóm đơn hàng theo UserID để map vào Customer
  const ordersByUserId = useMemo(() => {
    const map = new Map();
    (ordersAll || []).forEach((o) => {
      const uid = o?.user?.id;
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(o);
    });

    // Sort đơn hàng mới nhất lên đầu cho mỗi user
    for (const [, list] of map.entries()) {
      list.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });
    }
    return map;
  }, [ordersAll]);

  // Decorate: Gắn đơn hàng gần đây vào thông tin khách hàng
  const customersDecorated = useMemo(() => {
    return (filteredCustomers || []).map((c) => {
      const uid = c.id;
      const userOrders = (uid && ordersByUserId.get(uid)) || [];
      const recentOrders = buildRecentOrdersForUser(userOrders);
      const topDishes = buildTopDishes(userOrders);
      return {
        ...c,
        displayName: c.name || "Khách hàng",
        recentOrders,
        favoriteItems: c.favoriteItems?.length ? c.favoriteItems : topDishes,
        topDishes,
        isGuestBadge: c.isGuest ? "GUEST" : "",
      };
    });
  }, [filteredCustomers, ordersByUserId]);

  const onlineCount = useMemo(
    () => customersDecorated.filter((c) => c.online).length,
    [customersDecorated]
  );

  // Tính toán số lượng cho các bộ lọc nhanh (Quick Filters)
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
      { key: "all", label: "Tất cả", icon: <Users size={16} />, count: total },
      {
        key: "vip",
        label: "VIP",
        icon: <Star size={16} fill="currentColor" />,
        count: vip,
      },
      { key: "new", label: "Mới", icon: <Sparkles size={16} />, count: isNew },
      {
        key: "frequent",
        label: "Thân thiết",
        icon: <UserCheck size={16} />,
        count: often,
      },
    ];
  }, [customersDecorated]);

  const loading = usersLoading || ordersAllLoading;

  useEffect(() => {
    const ranks = rankSettingsData?.customerRankSettings?.ranks || [];
    setRankDraft(ranks);
  }, [rankSettingsData]);

  // --- 5. Render ---

  return (
    <div className={`cm-page ${showRightSidebar ? "is-sidebar-open" : ""}`}>
      {/* === HEADER SECTION === */}
      <header className="cm-header">
        <div className="cm-header-left">
          <div className="cm-brand-icon">
            <Users size={20} strokeWidth={2.5} />
          </div>
          <div className="cm-header-info">
            <h1 className="cm-title">Quản lý Khách hàng</h1>
            <div className="cm-select-wrapper">
              <select
                value={selectedRestaurantId}
                onChange={(e) => handleRestaurantChange(e.target.value)}
                className="cm-select"
              >
                {(restaurants || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="cm-header-right">
          <div className="cm-stat-badge">
            <span className="cm-dot-pulse" />
            <span>{onlineCount} Online</span>
          </div>

          <button
            className="cm-btn cm-btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Thêm khách</span>
          </button>

          <button
            className={`cm-btn cm-btn-icon ${showRightSidebar ? "active" : ""}`}
            onClick={() => setShowRightSidebar((v) => !v)}
            title="Bộ lọc nâng cao"
          >
            <Filter size={18} />
          </button>
        </div>
      </header>

      {/* === TOOLBAR SECTION === */}
      <div className="cm-toolbar">
        <div className="cm-toolbar-left">
          {/* Search Box */}
          <div className="cm-search-box">
            <Search className="cm-search-icon" size={18} />
            <input
              type="text"
              placeholder="Tìm tên, SĐT, mã khách..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="cm-quick-filters">
            {quickFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                className={`cm-pill ${
                  activeFilter === f.key ? "is-active" : ""
                }`}
              >
                <span className="cm-pill-icon">{f.icon}</span>
                <span className="cm-pill-label">{f.label}</span>
                <span className="cm-pill-count">
                  {formatCompactCount(f.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cm-toolbar-right">
          <button className="cm-btn cm-btn-text" title="Xuất danh sách Excel">
            <Download size={20} />
          </button>
          <button
            onClick={() => setShowPromotionModal(true)}
            className="cm-btn cm-btn-secondary"
          >
            <Gift size={18} className="text-yellow-600" />
            <span className="text-yellow-700">Gửi Ưu Đãi</span>
          </button>
          <button
            className="cm-btn cm-btn-secondary"
            onClick={() => (window.location.hash = "#customer-analytics")}
          >
            <BarChart3 size={18} />
            <span>Phân tích người dùng</span>
          </button>
        </div>
      </div>

      {/* === MAIN CONTENT LAYOUT === */}
      <main className="cm-layout">
        <section className="cm-main-area">
          <CustomerList
            customers={customersDecorated}
            loading={loading}
            onCustomerClick={handleCustomerClick}
          />
        </section>

        {/* Sidebar Filter Panel (Animated) */}
        <aside className="cm-sidebar">
          {showRightSidebar && (
            <>
              <CustomerFilters
                onClose={() => setShowRightSidebar(false)}
                onApplyFilters={handleFilter}
              />
              <div className="cm-rank-settings">
                <h4>Cài đặt mốc rank</h4>
                {rankDraft.map((rank, idx) => (
                  <div key={`${rank.name}-${idx}`} className="cm-rank-row">
                    <input
                      value={rank.name}
                      onChange={(e) =>
                        setRankDraft((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      value={rank.minPoints}
                      onChange={(e) =>
                        setRankDraft((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, minPoints: Number(e.target.value || 0) }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <button
                  className="cm-btn cm-btn-primary"
                  onClick={handleSaveRankSettings}
                  disabled={savingRank}
                >
                  Lưu mốc rank
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {/* === MODALS === */}

      {/* Modal gửi khuyến mãi */}
      {showPromotionModal && (
        <PromotionModal
          onClose={() => setShowPromotionModal(false)}
          customers={customersDecorated}
        />
      )}

      {/* Modal chi tiết khách hàng */}
      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={Boolean(selectedCustomer)}
          customer={selectedCustomer}
          restaurantId={selectedRestaurantId}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* Modal thêm khách hàng mới */}
      {showAddModal && (
        <AddCustomerModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
};

export default CustomerManagement;
