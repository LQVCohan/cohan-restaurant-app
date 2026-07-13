import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Activity,
  BarChart3,
  Download,
  Gift,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
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
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";

// Hooks & Context
import useUserManagement from "../../../hooks/useUserManagement";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";

// Styles
import "./CustomerManagement.scss";
import "./CustomerManagerScale.scss";

const CUSTOMER_PAGE_SIZE = 9;
const CUSTOMER_PAGE_SIZE_OPTIONS = [CUSTOMER_PAGE_SIZE];

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

const buildTopDishes = (topDishes = []) =>
  (topDishes || []).map((dish) => dish?.dishName).filter(Boolean);

const formatCompactCount = (n) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
const EXCEL_INVALID_SHEET_NAME_CHARS = /[\[\]:*?/\\]/g;

const createSafeSheetName = (baseName, usedNames) => {
  const rawName = String(baseName || "")
    .replace(EXCEL_INVALID_SHEET_NAME_CHARS, "")
    .trim();
  const fallback = "HangKhach";
  const normalizedBase = (rawName || fallback).slice(
    0,
    EXCEL_SHEET_NAME_MAX_LENGTH,
  );
  let candidate = normalizedBase;
  let seq = 2;

  while (usedNames.has(candidate)) {
    const suffix = ` - ${seq}`;
    const maxBaseLength = Math.max(
      1,
      EXCEL_SHEET_NAME_MAX_LENGTH - suffix.length,
    );
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

const CustomerKpiCards = ({ stats }) => (
  <div className="cm-header-kpis" aria-label="Chỉ số khách hàng">
    {stats.map((item) => (
      <div
        key={item.id}
        className={`cm-header-kpi tone-${item.tone || "default"}`}
      >
        <span className="cm-header-kpi__icon">{item.icon}</span>
        <span className="cm-header-kpi__label">{item.label}</span>
        <strong className="cm-header-kpi__value">
          {formatCompactCount(item.value)}
        </strong>
      </div>
    ))}
  </div>
);

/* ================== Main Component ================== */
const CustomerManagement = () => {
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const {
    customerPageItems,
    customerPageInfo,
    customerTotalCount,
    loading: usersLoading,
    switchRestaurant,
    getCustomersPage,
    getCustomerExportRows,
  } = useUserManagement();

  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState("current_list");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPageSize, setCustomerPageSize] = useState(CUSTOMER_PAGE_SIZE);
  const [customerPageIndex, setCustomerPageIndex] = useState(0);
  const [customerPageCursors, setCustomerPageCursors] = useState([null]);

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const applyNavigationSearch = (query = {}) => {
      const value = String(query?.search || query?.customerName || "").trim();
      if (value) setSearchQuery(value);
    };
    const params = new URLSearchParams(window.location.search);
    applyNavigationSearch({
      search: params.get("search"),
      customerName: params.get("customerName"),
    });
    const handleNavigation = (event) => {
      if (event?.detail?.page !== "customers") return;
      applyNavigationSearch(event.detail.query);
    };
    window.addEventListener("manager:navigation-query", handleNavigation);
    return () =>
      window.removeEventListener("manager:navigation-query", handleNavigation);
  }, []);
  const [rankDraft, setRankDraft] = useState([]);

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
  const rankSettings = useMemo(
    () => normalizeRanks(rankSettingsData?.customerRankSettings?.ranks || []),
    [rankSettingsData],
  );
  const customerRankFilter = useMemo(
    () => getRankBoundsForFilter(activeFilter, rankSettings),
    [activeFilter, rankSettings],
  );

  const summaryUserIds = useMemo(
    () => [
      ...new Set((customerPageItems || []).map((c) => c?.id).filter(Boolean)),
    ],
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

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadCustomerPageFromBackend = useCallback(
    async ({ cursor = null, pageSize = customerPageSize } = {}) => {
      if (!selectedRestaurantId) return null;
      return getCustomersPage({
        restaurantId: selectedRestaurantId,
        includeGuests: true,
        search: searchDebounced,
        customerRank: customerRankFilter,
        limit: pageSize,
        cursor: cursor || undefined,
        append: false,
      });
    },
    [
      customerPageSize,
      customerRankFilter,
      getCustomersPage,
      searchDebounced,
      selectedRestaurantId,
    ],
  );

  useEffect(() => {
    setCustomerPageIndex(0);
    setCustomerPageCursors([null]);
    if (!selectedRestaurantId) return;
    loadCustomerPageFromBackend({
      cursor: null,
      pageSize: customerPageSize,
    });
  }, [
    customerPageSize,
    customerRankFilter,
    loadCustomerPageFromBackend,
    searchDebounced,
    selectedRestaurantId,
  ]);

  const handleSearch = (query) => setSearchQuery(query);

  const handleFilter = (filterKey) => {
    if (typeof filterKey === "object" && filterKey?.category) {
      filterKey = filterKey.category;
    }
    setActiveFilter(filterKey);
  };

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    setActiveFilter("all");
    setSelectedCustomer(null);
    setCustomerPageIndex(0);
    setCustomerPageCursors([null]);
    switchRestaurant(restaurantId);
    if (restaurantId) refetchRankSettings?.({ restaurantId });
  };

  const handleCustomerClick = (customer) => setSelectedCustomer(customer);

  const handleCustomerNextPage = async () => {
    if (!customerPageInfo?.hasNextPage || !customerPageInfo?.endCursor) return;
    const nextIndex = customerPageIndex + 1;
    const nextCursor = customerPageInfo.endCursor;
    setCustomerPageIndex(nextIndex);
    setCustomerPageCursors((prev) => {
      const copy = prev.slice(0, nextIndex + 1);
      copy[nextIndex] = nextCursor;
      return copy;
    });
    await loadCustomerPageFromBackend({
      cursor: nextCursor,
      pageSize: customerPageSize,
    });
  };

  const handleCustomerPreviousPage = async () => {
    if (customerPageIndex <= 0) return;
    const previousIndex = customerPageIndex - 1;
    const previousCursor = customerPageCursors[previousIndex] || null;
    setCustomerPageIndex(previousIndex);
    await loadCustomerPageFromBackend({
      cursor: previousCursor,
      pageSize: customerPageSize,
    });
  };

  const handleCustomerPageSizeChange = (size) => {
    const safeSize = CUSTOMER_PAGE_SIZE_OPTIONS.includes(Number(size))
      ? Number(size)
      : CUSTOMER_PAGE_SIZE;
    setCustomerPageSize(safeSize);
    setCustomerPageIndex(0);
    setCustomerPageCursors([null]);
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
    setCustomerPageIndex(0);
    setCustomerPageCursors([null]);
    await loadCustomerPageFromBackend({
      cursor: null,
      pageSize: customerPageSize,
    });
    if (selectedRestaurantId) await refetchSummaries();

    if (!createdUser) return { visibleInCurrentList: null };

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
    const sortedAsc = [...rankSettings].sort(
      (a, b) => a.minPoints - b.minPoints,
    );
    const baseName = sortedAsc[0]?.name || "Mới";
    const middleName =
      (sortedAsc.length > 2
        ? sortedAsc[sortedAsc.length - 2]
        : sortedAsc[1]
      )?.name || "Thân thiết";
    const topName = sortedAsc[sortedAsc.length - 1]?.name || "VIP";
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "vip" && createdUserRankName === topName) ||
      (activeFilter === "new" && createdUserRankName === baseName) ||
      (activeFilter === "frequent" && createdUserRankName === middleName);

    return { visibleInCurrentList: matchesSearch && matchesFilter };
  };

  const summaryByUserId = useMemo(() => {
    const map = new Map();
    (summaryData?.customerListSummaries || []).forEach((row) => {
      if (row?.userId) map.set(row.userId, row);
    });
    return map;
  }, [summaryData]);

  const customersDecorated = useMemo(() => {
    return (customerPageItems || []).map((c) => {
      const uid = c.id;
      const summary = (uid && summaryByUserId.get(uid)) || null;
      const recentOrders = (summary?.recentOrders || []).map((o) => ({
        ...o,
        date: toDateStringVI(o?.createdAt),
      }));
      const topDishes = buildTopDishes(summary?.topDishes || []);
      const resolvedRank = resolveCustomerRank(c?.loyaltyPoints, rankSettings);
      return {
        ...c,
        displayName: c.name || "Khách hàng",
        customerType: resolvedRank.name,
        rankName: resolvedRank.name,
        rankSettings,
        recentOrders,
        favoriteItems: c.favoriteItems?.length
          ? c.favoriteItems
          : topDishes,
        topDishes,
        isGuestBadge: c.isGuest ? "GUEST" : "",
      };
    });
  }, [customerPageItems, rankSettings, summaryByUserId]);

  const onlineCount = useMemo(
    () => customersDecorated.filter((c) => c.online).length,
    [customersDecorated],
  );

  const tierFilters = useMemo(() => {
    const sortedAsc = [...rankSettings].sort(
      (a, b) => a.minPoints - b.minPoints,
    );
    const base = sortedAsc[0];
    const middle =
      sortedAsc.length > 2
        ? sortedAsc[sortedAsc.length - 2]
        : sortedAsc[1];
    const top = sortedAsc[sortedAsc.length - 1];
    return {
      topName: top?.name || "VIP",
      middleName: middle?.name || "Thân thiết",
      baseName: base?.name || "Mới",
    };
  }, [rankSettings]);

  const customersVisible = customersDecorated;

  const quickFilters = useMemo(() => {
    const total = customersDecorated.length || 0;
    const vip = customersDecorated.filter(
      (c) => c.customerType === tierFilters.topName,
    ).length;
    const isNew = customersDecorated.filter(
      (c) => c.customerType === tierFilters.baseName,
    ).length;
    const often = customersDecorated.filter(
      (c) => c.customerType === tierFilters.middleName,
    ).length;

    return [
      {
        key: "all",
        label: "Tất cả",
        icon: <Users size={16} />,
        count: total,
      },
      {
        key: "vip",
        label: tierFilters.topName,
        icon: <Star size={16} fill="currentColor" />,
        count: vip,
      },
      {
        key: "new",
        label: tierFilters.baseName,
        icon: <Sparkles size={16} />,
        count: isNew,
      },
      {
        key: "frequent",
        label: tierFilters.middleName,
        icon: <UserCheck size={16} />,
        count: often,
      },
    ];
  }, [customersDecorated, tierFilters]);

  const loading = usersLoading;
  const customerHeaderStats = [
    {
      id: "total",
      icon: <Users size={18} aria-hidden="true" />,
      label: "Tổng khách hàng",
      value: customerTotalCount || customersDecorated.length,
      tone: "total",
    },
    {
      id: "online",
      icon: <Activity size={18} aria-hidden="true" />,
      label: "Đang hoạt động",
      value: onlineCount,
      tone: "online",
    },
    {
      id: "vip",
      icon: <Star size={18} fill="currentColor" aria-hidden="true" />,
      label: "Khách VIP",
      value: quickFilters.find((f) => f.key === "vip")?.count || 0,
      tone: "vip",
    },
    {
      id: "new",
      icon: <Sparkles size={18} aria-hidden="true" />,
      label: "Khách mới",
      value: quickFilters.find((f) => f.key === "new")?.count || 0,
      tone: "new",
    },
  ];
  const hasCustomerData = Number(customerTotalCount || 0) > 0;
  const customerTotalPages = Math.max(
    1,
    Math.ceil(Number(customerTotalCount || 0) / customerPageSize) || 1,
  );
  const customerPagination = {
    page: customerPageIndex + 1,
    totalPages: customerTotalPages,
    pageSize: customerPageSize,
    pageSizeOptions: CUSTOMER_PAGE_SIZE_OPTIONS,
    totalCount: Number(customerTotalCount || 0),
    hasNextPage: Boolean(customerPageInfo?.hasNextPage),
    hasPreviousPage: customerPageIndex > 0,
    isLoading: loading,
    onNext: handleCustomerNextPage,
    onPrevious: handleCustomerPreviousPage,
    onPageSizeChange: handleCustomerPageSizeChange,
  };

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
    customer.online ? "Đang hoạt động" : "Không hoạt động",
    customer.isGuest ? "Khách vãng lai" : "Có tài khoản",
    customer.lastLoginAt ? toDateStringVI(customer.lastLoginAt) : "",
  ];

  const buildScopeSheets = (scope, rows, ranks) => {
    const header = [
      "STT",
      "Mã khách hàng",
      "Tên khách hàng",
      "Số điện thoại",
      "Email",
      "Hạng khách hàng",
      "Điểm tích lũy",
      "Tổng đơn hàng",
      "Tổng chi tiêu",
      "Trạng thái hoạt động",
      "Loại tài khoản",
      "Đăng nhập gần nhất",
    ];

    if (scope === "current_list") {
      return [
        {
          name: "TrangHienTai",
          rows: [header, ...rows.map(toCustomerRow)],
        },
      ];
    }

    if (scope === "customer_type") {
      const guestRows = rows.filter((c) => c.isGuest);
      const registeredRows = rows.filter((c) => !c.isGuest);
      return [
        {
          name: "KhachVangLai",
          rows: [header, ...guestRows.map(toCustomerRow)],
        },
        {
          name: "KhachCoTaiKhoan",
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
      return {
        name: safeSheetName,
        rows: [header, ...customersByRank.map(toCustomerRow)],
      };
    });
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      setExportError("");

      const rankFilter = getRankBoundsForFilter(activeFilter, rankSettings);
      const visibleRows =
        exportScope === "filtered_all"
          ? await getCustomerExportRows({
              restaurantId: selectedRestaurantId,
              includeGuests: true,
              search: searchDebounced,
              limit: 1000,
              customerRank: rankFilter,
            })
          : customersVisible || [];
      if (!visibleRows.length) {
        setExportError("Không có khách hàng phù hợp để xuất.");
        return;
      }

      const sheets = buildScopeSheets(exportScope, visibleRows, rankSettings);
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const scopeSuffix =
        exportScope === "current_list"
          ? "trang-hien-tai"
          : exportScope === "filtered_all"
            ? "theo-bo-loc"
            : exportScope === "customer_type"
              ? "theo-loai-tai-khoan"
              : "theo-hang-khach-hang";
      downloadXlsxWorkbook(
        sheets,
        `danh-sach-khach-hang-${scopeSuffix}-${dateSuffix}.xlsx`,
      );
      setShowExportModal(false);
    } catch (err) {
      setExportError(err?.message || "Không thể xuất tệp Excel.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const ranks = rankSettingsData?.customerRankSettings?.ranks || [];
    setRankDraft(ranks);
  }, [rankSettingsData]);

  return (
    <div
      className={`cm-page ${showRightSidebar ? "is-sidebar-open" : ""} ${hasCustomerData ? "has-customer-data" : "is-customer-empty"}`}
    >
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="KHÁCH HÀNG"
        title="Quản lý khách hàng"
        subtitle="Tìm kiếm, phân hạng và chăm sóc khách hàng theo từng chi nhánh."
        icon={<Users size={20} aria-hidden="true" />}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={handleRestaurantChange}
        restaurantList={restaurantOptions}
        restaurantDisabled={restaurantsLoading || !hasRestaurants}
        restaurantPlaceholder={
          restaurantsLoading ? "Đang tải nhà hàng..." : "Chưa có nhà hàng"
        }
        stats={[]}
        statsPlacement="none"
        customControls={<CustomerKpiCards stats={customerHeaderStats} />}
        primaryAction={{
          label: "Thêm khách hàng",
          icon: <UserPlus size={16} aria-hidden="true" />,
          onClick: () => setShowAddModal(true),
        }}
      />

      <ManagerCommandBar
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        searchPlaceholder="Tìm theo tên, số điện thoại hoặc mã khách..."
        leftSlot={
          <div className="cm-quick-filter-wrap">
            <div className="cm-quick-filters">
              {quickFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleFilter(f.key)}
                  className={`cm-pill ${activeFilter === f.key ? "is-active" : ""}`}
                  title="Số lượng khách hàng trên trang hiện tại"
                  aria-label={`${f.label}: ${f.count} khách hàng trên trang hiện tại`}
                >
                  <span className="cm-pill-icon">{f.icon}</span>
                  <span className="cm-pill-label">{f.label}</span>
                  <span className="cm-pill-count">
                    {formatCompactCount(f.count)}
                  </span>
                </button>
              ))}
            </div>
            <span className="cm-filter-scope-note">
              Số liệu trên trang hiện tại
            </span>
          </div>
        }
        actions={[
          {
            label: "Xuất Excel",
            icon: <Download size={16} aria-hidden="true" />,
            onClick: () => setShowExportModal(true),
          },
          {
            label: "Gửi ưu đãi",
            icon: <Gift size={16} aria-hidden="true" />,
            onClick: () => setShowPromotionModal(true),
          },
          {
            label: "Xem phân tích",
            icon: <BarChart3 size={16} aria-hidden="true" />,
            onClick: () => (window.location.hash = "#customer-analytics"),
          },
          {
            label: "Lọc",
            icon: <SlidersHorizontal size={16} aria-hidden="true" />,
            variant: showRightSidebar ? "primary" : undefined,
            onClick: () => setShowRightSidebar((v) => !v),
          },
        ]}
      />

      <main className="cm-layout">
        <section className="cm-main-area">
          <CustomerList
            customers={customersVisible}
            loading={loading}
            onCustomerClick={handleCustomerClick}
            pagination={customerPagination}
          />
        </section>

        <aside className="cm-sidebar">
          {showRightSidebar && (
            <>
              <CustomerFilters
                onClose={() => setShowRightSidebar(false)}
                onApplyFilters={handleFilter}
              />
              <div className="cm-rank-settings">
                <h4>Ngưỡng hạng khách hàng</h4>
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
                  {savingRank ? "Đang lưu..." : "Lưu ngưỡng hạng"}
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {showPromotionModal && (
        <PromotionModal
          onClose={() => setShowPromotionModal(false)}
          customers={customersVisible}
          restaurantId={selectedRestaurantId}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={Boolean(selectedCustomer)}
          customer={selectedCustomer}
          restaurantId={selectedRestaurantId}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCreated={refreshCustomerListAfterCreate}
          restaurantId={selectedRestaurantId}
        />
      )}

      {showExportModal && (
        <Modal
          isOpen
          onClose={() => {
            if (!exporting) setShowExportModal(false);
          }}
          title="Xuất danh sách khách hàng"
          size="md"
        >
          <Modal.Body>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Chọn phạm vi dữ liệu cần xuất sang tệp Excel.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "current_list"}
                  onChange={() => setExportScope("current_list")}
                />
                <span>
                  <strong>Trang hiện tại</strong> — xuất khách hàng đang hiển thị
                  vào một trang tính.
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
                  <strong>Toàn bộ kết quả theo bộ lọc</strong> — xuất tối đa
                  1.000 khách hàng phù hợp.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === "customer_type"}
                  onChange={() => setExportScope("customer_type")}
                />
                <span>
                  <strong>Theo loại tài khoản</strong> — tách khách vãng lai và
                  khách có tài khoản thành hai trang tính.
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
                  <strong>Theo hạng khách hàng</strong> — mỗi hạng được xuất
                  thành một trang tính.
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
              {exporting ? "Đang xuất..." : "Xuất tệp Excel"}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default CustomerManagement;
