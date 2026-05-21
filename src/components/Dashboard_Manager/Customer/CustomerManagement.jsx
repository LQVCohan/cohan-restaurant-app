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
  UserCheck,
  BarChart3,
} from "lucide-react";

// Components
import CustomerList from "./CustomerList";
import CustomerFilters from "./CustomerFilters";
import PromotionModal from "./PromotionModal";
import CustomerDetailModal from "./CustomerModal";
import AddCustomerModal from "./AddCustomerModal";
import Modal from "../../common/Modal";
import { downloadXlsxWorkbook } from "../../../utils/xlsxWorkbook";
import { normalizeRanks, resolveCustomerRank } from "./customerRankUtils";

// Hooks & Context
import useUserManagement from "../../../hooks/useUserManagement";
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

const GET_CUSTOMER_LIST_SUMMARIES = gql`
  query GetCustomerListSummaries(
    $restaurantId: ID!
    $userIds: [ID!]!
    $recentLimit: Int
    $topDishLimit: Int
  ) {
    customerListSummaries(
      restaurantId: $restaurantId
      userIds: $userIds
      recentLimit: $recentLimit
      topDishLimit: $topDishLimit
    ) {
      userId
      recentOrders {
        id
        orderCode
        createdAt
        amount
        items
      }
      topDishes {
        dishName
        quantity
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

const buildTopDishes = (topDishes = []) => (topDishes || []).map((dish) => dish?.dishName).filter(Boolean);

// Định dạng số lượng hiển thị trên nút lọc (VD: 1.2k)
const formatCompactCount = (n) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
const EXCEL_INVALID_SHEET_NAME_CHARS = /[\[\]:*?/\\]/g;
const EXPORT_LIMIT = 1000;

const createSafeSheetName = (baseName, usedNames) => {
  const rawName = String(baseName || "").replace(EXCEL_INVALID_SHEET_NAME_CHARS, "").trim();
  const fallback = "Rank";
  const normalizedBase = (rawName || fallback).slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
  let candidate = normalizedBase;
  let seq = 2;

  while (usedNames.has(candidate)) {
    const suffix = ` - ${seq}`;
    const maxBaseLength = Math.max(1, EXCEL_SHEET_NAME_MAX_LENGTH - suffix.length);
    candidate = `${normalizedBase.slice(0, maxBaseLength)}${suffix}`;
    seq += 1;
  }

  usedNames.add(candidate);
  return candidate;
};
const getRankBoundsForFilter = (filterKey, rankSettings) => {
  const ascending = [...normalizeRanks(rankSettings)].sort(
    (a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0),
  );
  if (filterKey === "all" || !ascending.length) return null;

  const base = ascending[0];
  const middle = ascending[1] || null;
  const top = ascending[ascending.length - 1];
  const rankAt = (index) => ascending[index] || null;

  if (filterKey === "new" && base) {
    const next = rankAt(1);
    return {
      rankName: base.name,
      minPoints: Number(base.minPoints || 0),
      maxPointsExclusive: next ? Number(next.minPoints || 0) : null,
    };
  }
  if (filterKey === "frequent" && middle) {
    const next = rankAt(2);
    return {
      rankName: middle.name,
      minPoints: Number(middle.minPoints || 0),
      maxPointsExclusive: next ? Number(next.minPoints || 0) : null,
    };
  }
  if (filterKey === "vip" && top) {
    return {
      rankName: top.name,
      minPoints: Number(top.minPoints || 0),
      maxPointsExclusive: null,
    };
  }
  return null;
};

/* ================== Main Component ================== */

const CustomerManagement = () => {
  // --- 1. Hooks & State ---
  const { restaurants = [] } = useContext(AuthContext) || {};

  const {
    customerPageItems,
    customerPageInfo,
    customerTotalCount,
    loading: usersLoading,
    switchRestaurant,
    getCustomersPage,
    getCustomerExportRows,
    getCustomerFilterCounts,
  } = useUserManagement();

  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState(defaultRestaurantId);

  // UI States
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState("current_list");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Filter & Search States
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [rankDraft, setRankDraft] = useState([]);
  const [customerFilterCounts, setCustomerFilterCounts] = useState(null);
  const [customerFilterCountsLoading, setCustomerFilterCountsLoading] = useState(false);

  const { data: rankSettingsData, refetch: refetchRankSettings } = useQuery(
    GET_CUSTOMER_RANK_SETTINGS,
    {
      skip: !selectedRestaurantId,
      variables: { restaurantId: selectedRestaurantId },
      fetchPolicy: "network-only",
    },
  );
  const [saveRankSettings, { loading: savingRank }] = useMutation(
    UPSERT_CUSTOMER_RANK_SETTINGS,
  );

  // --- 2. Effects ---

  // Sync default restaurant ID khi load trang
  useEffect(() => {
    if (!selectedRestaurantId && restaurants?.length) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  const summaryUserIds = useMemo(
    () => [...new Set((customerPageItems || []).map((c) => c?.id).filter(Boolean))],
    [customerPageItems],
  );
  const { data: summaryData, refetch: refetchSummaries } = useQuery(
    GET_CUSTOMER_LIST_SUMMARIES,
    {
      skip: !selectedRestaurantId || !summaryUserIds.length,
      variables: {
        restaurantId: selectedRestaurantId,
        userIds: summaryUserIds,
        recentLimit: 5,
        topDishLimit: 3,
      },
      fetchPolicy: "network-only",
    },
  );

  // Fetch dữ liệu khách hàng khi thay đổi nhà hàng
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    if (!selectedRestaurantId) return;
    getCustomersPage({
      restaurantId: selectedRestaurantId, includeGuests: true, search: searchDebounced, limit: 30, customerRank: getRankBoundsForFilter(activeFilter, rankSettings),
    });
  }, [activeFilter, getCustomersPage, rankSettings, searchDebounced, selectedRestaurantId]);
  useEffect(() => {
    if (!selectedRestaurantId) return;
    let cancelled = false;
    setCustomerFilterCountsLoading(true);
    getCustomerFilterCounts({
      restaurantId: selectedRestaurantId,
      search: searchDebounced,
      includeGuests: true,
      customerKind: "ALL",
    })
      .then((result) => {
        if (!cancelled) setCustomerFilterCounts(result);
      })
      .finally(() => {
        if (!cancelled) setCustomerFilterCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getCustomerFilterCounts, searchDebounced, selectedRestaurantId]);

  // --- 3. Handlers ---

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilter = (filterKey) => {
    if (typeof filterKey === "object" && filterKey?.category) {
      filterKey = filterKey.category;
    }
    setActiveFilter(filterKey);
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

  const refreshCustomerListAfterCreate = async (createdUser = null) => {
    await getCustomersPage({ restaurantId: selectedRestaurantId, includeGuests: true, search: searchDebounced, limit: 30 });
    if (selectedRestaurantId) await refetchSummaries();

    if (!createdUser) {
      return { visibleInCurrentList: null };
    }

    const name = (
      createdUser.fullName ||
      createdUser.username ||
      ""
    ).toLowerCase();
    const email = (createdUser.email || "").toLowerCase();
    const phone = createdUser.phone || "";
    const q = (searchQuery || "").trim().toLowerCase();
    const matchesSearch =
      !q ||
      name.includes(q) ||
      email.includes(q) ||
      phone.includes(searchQuery || "");

    const createdUserRankName = resolveCustomerRank(
      createdUser?.loyaltyPoints,
      rankSettings,
    ).name;
    const sortedAsc = [...rankSettings].sort((a, b) => a.minPoints - b.minPoints);
    const baseName = sortedAsc[0]?.name || "Mới";
    const middleName =
      (sortedAsc.length > 2 ? sortedAsc[sortedAsc.length - 2] : sortedAsc[1])?.name ||
      "Thân thiết";
    const topName = sortedAsc[sortedAsc.length - 1]?.name || "VIP";
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "vip" && createdUserRankName === topName) ||
      (activeFilter === "new" && createdUserRankName === baseName) ||
      (activeFilter === "frequent" && createdUserRankName === middleName);

    return { visibleInCurrentList: matchesSearch && matchesFilter };
  };

  // --- 4. Data Processing (Memoized) ---

  // Gom nhóm đơn hàng theo UserID để map vào Customer
  const summaryByUserId = useMemo(() => {
    const map = new Map();
    (summaryData?.customerListSummaries || []).forEach((row) => {
      if (row?.userId) map.set(row.userId, row);
    });
    return map;
  }, [summaryData]);
  const rankSettings = useMemo(
    () => normalizeRanks(rankSettingsData?.customerRankSettings?.ranks || []),
    [rankSettingsData],
  );

  // Decorate: Gắn đơn hàng gần đây vào thông tin khách hàng
  const customersDecorated = useMemo(() => {
    return (customerPageItems || []).map((c) => {
      const uid = c.id;
      const summary = (uid && summaryByUserId.get(uid)) || null;
      const recentOrders = (summary?.recentOrders || []).map((o) => ({
        ...o,
        date: toDateStringVI(o?.createdAt),
      }));
      const topDishes = buildTopDishes(summary?.topDishes || []);
      return {
        ...c,
        displayName: c.name || "Khách hàng",
        customerType: resolveCustomerRank(c?.loyaltyPoints, rankSettings).name,
        rankName: resolveCustomerRank(c?.loyaltyPoints, rankSettings).name,
        rankSettings,
        recentOrders,
        favoriteItems: c.favoriteItems?.length ? c.favoriteItems : topDishes,
        topDishes,
        isGuestBadge: c.isGuest ? "GUEST" : "",
      };
    });
  }, [customerPageItems, rankSettings, summaryByUserId]);

  const onlineCount = useMemo(
    () => customersDecorated.filter((c) => c.online).length,
    [customersDecorated],
  );

  // Tính toán số lượng cho các bộ lọc nhanh (Quick Filters)
  const tierFilters = useMemo(() => {
    const sortedAsc = [...rankSettings].sort((a, b) => a.minPoints - b.minPoints);
    const base = sortedAsc[0];
    const middle = sortedAsc.length > 2 ? sortedAsc[sortedAsc.length - 2] : sortedAsc[1];
    const top = sortedAsc[sortedAsc.length - 1];
    return {
      topName: top?.name || "VIP",
      middleName: middle?.name || "Thân thiết",
      baseName: base?.name || "Mới",
    };
  }, [rankSettings]);
  const rankCountsByFilter = useMemo(() => {
    const sortedByMin = [...(customerFilterCounts?.ranks || [])]
      .sort((a, b) => Number(a?.minPoints || 0) - Number(b?.minPoints || 0));
    const base = sortedByMin[0] || null;
    const top = sortedByMin[sortedByMin.length - 1] || null;
    const middle = sortedByMin.length > 2 ? sortedByMin[sortedByMin.length - 2] : sortedByMin[1] || null;
    return {
      all: Number(customerFilterCounts?.total || 0),
      vip: Number(top?.count || 0),
      new: Number(base?.count || 0),
      frequent: Number(middle?.count || 0),
    };
  }, [customerFilterCounts]);

  const customersVisible = customersDecorated;

  const quickFilters = useMemo(() => {
    const total = customerFilterCounts ? rankCountsByFilter.all : (customersDecorated.length || 0);
    const vip = customerFilterCounts ? rankCountsByFilter.vip : customersDecorated.filter((c) => c.customerType === tierFilters.topName).length;
    const isNew = customerFilterCounts ? rankCountsByFilter.new : customersDecorated.filter((c) => c.customerType === tierFilters.baseName).length;
    const often = customerFilterCounts ? rankCountsByFilter.frequent : customersDecorated.filter((c) => c.customerType === tierFilters.middleName).length;

    return [
      { key: "all", label: "Tất cả", icon: <Users size={16} />, count: total },
      {
        key: "vip",
        label: tierFilters.topName,
        icon: <Star size={16} fill="currentColor" />,
        count: vip,
      },
      { key: "new", label: tierFilters.baseName, icon: <Sparkles size={16} />, count: isNew },
      {
        key: "frequent",
        label: tierFilters.middleName,
        icon: <UserCheck size={16} />,
        count: often,
      },
    ];
  }, [customerFilterCounts, customersDecorated, rankCountsByFilter, tierFilters]);
  const expectedFilteredExportTotal = useMemo(() => {
    if (!customerFilterCounts) return null;
    if (activeFilter === "all") return Number(customerFilterCounts.total || 0);
    return Number(rankCountsByFilter[activeFilter] || 0);
  }, [activeFilter, customerFilterCounts, rankCountsByFilter]);

  const loading = usersLoading;

  const toCustomerRow = (customer, index) => [
    index + 1,
    customer.id || "",
    customer.displayName || customer.name || "",
    customer.phone || "",
    customer.email || "",
    resolveCustomerRank(customer?.loyaltyPoints, rankSettings).name || "",
    Number(customer.loyaltyPoints || 0),
    Number(customer.totalOrders || 0),
    Number(customer.totalSpending || 0),
    customer.online ? "Online" : "Offline",
    customer.isGuest ? "Guest" : "Registered",
    customer.lastLoginAt ? toDateStringVI(customer.lastLoginAt) : "",
  ];

  const buildScopeSheets = (scope, rows, ranks) => {
    const header = [
      "STT",
      "Mã KH",
      "Tên khách hàng",
      "Số điện thoại",
      "Email",
      "Hạng khách",
      "Điểm tích lũy",
      "Tổng đơn",
      "Tổng chi tiêu",
      "Trạng thái online",
      "Loại khách hàng",
      "Đăng nhập gần nhất",
    ];

    if (scope === "current_list") {
      return [
        { name: "DanhSachHienTai", rows: [header, ...rows.map(toCustomerRow)] },
      ];
    }

    if (scope === "customer_type") {
      const guestRows = rows.filter((c) => c.isGuest);
      const registeredRows = rows.filter((c) => !c.isGuest);
      return [
        { name: "KhachGuest", rows: [header, ...guestRows.map(toCustomerRow)] },
        {
          name: "KhachDangKy",
          rows: [header, ...registeredRows.map(toCustomerRow)],
        },
      ];
    }

    const groupedByRank = rows.reduce((acc, customer) => {
      const rank = resolveCustomerRank(customer?.loyaltyPoints, ranks);
      const rankName = rank?.name || "KhongXacDinh";
      if (!acc.has(rankName)) acc.set(rankName, []);
      acc.get(rankName).push(customer);
      return acc;
    }, new Map());

    const usedSheetNames = new Set();
    return normalizeRanks(ranks).map((rank) => {
      const customersByRank = groupedByRank.get(rank.name) || [];
      const safeSheetName = createSafeSheetName(rank?.name, usedSheetNames);
      return { name: safeSheetName, rows: [header, ...customersByRank.map(toCustomerRow)] };
    });
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      setExportError("");

      const rankFilter = getRankBoundsForFilter(activeFilter, rankSettings);
      const visibleRows = exportScope === "filtered_all"
        ? await getCustomerExportRows({ restaurantId: selectedRestaurantId, includeGuests: true, search: searchDebounced, limit: EXPORT_LIMIT, customerRank: rankFilter })
        : (customersVisible || []);
      if (!visibleRows.length) {
        setExportError("Không có dữ liệu để xuất theo bộ lọc hiện tại.");
        return;
      }

      const sheets = buildScopeSheets(exportScope, visibleRows, rankSettings);
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const scopeSuffix =
        exportScope === "current_list"
          ? "danh-sach-hien-tai"
          : exportScope === "filtered_all"
            ? "tat-ca-theo-bo-loc"
          : exportScope === "customer_type"
            ? "phan-loai-guest"
            : "phan-loai-hang";
      downloadXlsxWorkbook(
        sheets,
        `customer-export-${scopeSuffix}-${dateSuffix}.xlsx`,
      );
      if (
        exportScope === "filtered_all" &&
        Number(expectedFilteredExportTotal || 0) > EXPORT_LIMIT &&
        visibleRows.length >= EXPORT_LIMIT
      ) {
        setExportError(`Bộ lọc hiện có khoảng ${new Intl.NumberFormat("vi-VN").format(expectedFilteredExportTotal)} khách. File xuất chỉ gồm tối đa ${new Intl.NumberFormat("vi-VN").format(EXPORT_LIMIT)} khách đầu tiên theo thứ tự hiện tại.`);
      }
      setShowExportModal(false);
    } catch (err) {
      setExportError(err?.message || "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

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
                  {customerFilterCountsLoading && !customerFilterCounts ? "…" : formatCompactCount(f.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cm-toolbar-right">
          <button
            className="cm-btn cm-btn-text"
            title="Xuất danh sách Excel"
            onClick={() => setShowExportModal(true)}
          >
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
            customers={customersVisible}
            loading={loading}
            onCustomerClick={handleCustomerClick}
          />
          <div className="text-xs text-slate-500 mt-1">
            {Number.isFinite(Number(customerTotalCount)) && Number(customerTotalCount) > 0
              ? `Đang hiển thị ${customersVisible.length} / ${Number(customerTotalCount)} khách`
              : `Đã tải ${customersVisible.length} khách${customerPageInfo?.hasNextPage ? " — còn dữ liệu, bấm Tải thêm để xem tiếp" : ""}`}
          </div>
          {customerPageInfo?.hasNextPage ? (
            <div className="mt-3 flex justify-center">
              <button
                className="cm-btn cm-btn-secondary"
                onClick={() =>
                  getCustomersPage({
                    restaurantId: selectedRestaurantId,
                    includeGuests: true,
                    search: searchDebounced,
                    customerRank: getRankBoundsForFilter(activeFilter, rankSettings),
                    limit: 30,
                    cursor: customerPageInfo?.endCursor || undefined,
                    append: true,
                  })
                }
              >
                Tải thêm
              </button>
            </div>
          ) : null}
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
                            i === idx
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
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
                              ? {
                                  ...item,
                                  minPoints: Number(e.target.value || 0),
                                }
                              : item,
                          ),
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
          customers={customersVisible}
          restaurantId={selectedRestaurantId}
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
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCreated={refreshCustomerListAfterCreate}
        />
      )}

      {showExportModal && (
        <Modal
          isOpen
          onClose={() => {
            if (!exporting) setShowExportModal(false);
          }}
          title="Xuất danh sách khách hàng (.xlsx)"
          size="md"
        >
          <Modal.Body>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Chọn phạm vi xuất cho danh sách đang lọc/tìm kiếm hiện
                tại.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "current_list"}
                  onChange={() => setExportScope("current_list")}
                />
                <span>
                  <strong>Danh sách hiện tại</strong> — 1 sheet: toàn bộ khách
                  đã tải/đang hiển thị.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "filtered_all"}
                  onChange={() => setExportScope("filtered_all")}
                />
                <span>
                  <strong>Tất cả theo bộ lọc hiện tại</strong> — xuất tối đa 1.000 khách đầu tiên.
                </span>
              </label>
              {exportScope === "filtered_all" && Number(expectedFilteredExportTotal || 0) > EXPORT_LIMIT ? (
                <div className="text-sm text-amber-700">
                  Bộ lọc hiện có khoảng {new Intl.NumberFormat("vi-VN").format(expectedFilteredExportTotal)} khách. File xuất sẽ lấy tối đa 1.000 khách đầu tiên theo thứ tự hiện tại.
                </div>
              ) : null}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "customer_type"}
                  onChange={() => setExportScope("customer_type")}
                />
                <span>
                  <strong>Phân loại Guest/Registered</strong> — 2 sheet: khách
                  guest và khách đăng ký.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "loyalty_tier"}
                  onChange={() => setExportScope("loyalty_tier")}
                />
                <span>
                  <strong>Phân loại theo hạng</strong> — 3 sheet: VIP, Thân
                  thiết, Mới (theo loyalty points).
                </span>
              </label>
              {exportError ? (
                <div className="text-sm text-red-600">{exportError}</div>
              ) : null}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="btn btn-secondary"
              onClick={() => setShowExportModal(false)}
              disabled={exporting}
            >
              Hủy
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              {exporting ? "Đang xuất..." : "Xuất .xlsx"}
            </button>
          </Modal.Footer>
        </Modal>
      )}

    </div>
  );
};

export default CustomerManagement;
