// src/pages/OrderManagement/OrderManagement.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import {
  Clock,
  ChefHat,
  CheckCircle,
  AlertTriangle,
  History,
  Loader,
  ChevronDown,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  Filter,
  Search,
  ShoppingBag,
  Download, // <--- Đã thêm import này
} from "lucide-react";
import { gql, useMutation } from "@apollo/client";

// Import Components con
import OrderCard from "./components/OrderCard";
import OrderModal from "./components/OrderModal";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
import NewOrderModal from "./components/NewOrderModal";
import StatsCard from "./components/StatsCard";
import OrderSettingsModal from "./components/OrderSettingsModal";

import useOrderManagement from "../../../hooks/useOrderManagement";
import { useNotification } from "@/hooks/useNotification";
import { AuthContext } from "@/context/AuthContext";
import useSocketOrder from "@/hooks/useSocketOrder";

// Import Style
import "./OrderManagement.scss";

/* ---------------- GQL ---------------- */
const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
      updatedAt
    }
  }
`;
const CONFIRM_INCOMING_ORDER = gql`
  mutation ConfirmIncomingOrder($input: ConfirmIncomingOrderInput!) {
    confirmIncomingOrder(input: $input) { order { id currentStatus updatedAt } }
  }
`;
const REJECT_INCOMING_ORDER = gql`
  mutation RejectIncomingOrder($input: RejectIncomingOrderInput!) {
    rejectIncomingOrder(input: $input) { order { id currentStatus updatedAt } }
  }
`;
const CREATE_TEMP_BILL_PRINT_JOB = gql`
  mutation CreateTemporaryBillPrintJob($input: CreateTemporaryBillPrintJobInput!) {
    createTemporaryBillPrintJob(input: $input) { ok message }
  }
`;

const useRestaurant = () => {
  const { restaurants } = useContext(AuthContext);
  return { restaurantList: restaurants || [] };
};

/* ---------------- Component: DishSummaryPanel ---------------- */
const DishSummaryPanel = ({
  dishes,
  activeKey,
  onDishClick,
  onClearHighlight,
  size = "m",
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!dishes || dishes.length === 0) return null;
  const hasHighlight = !!activeKey;

  const formatPortion = (value) => {
    if (value == null) return "";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return Number.isInteger(num)
      ? num.toString()
      : num.toString().replace(/\.0+$/, "");
  };

  return (
    <div className={`om-summary ${collapsed ? "om-summary--collapsed" : ""}`}>
      <div className="om-summary__header">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="om-summary__toggle"
        >
          <ChefHat size={18} />
          <span>Tóm tắt món cần làm ({dishes.length})</span>
          <span className="om-summary__arrow">{collapsed ? "▼" : "▲"}</span>
        </button>

        {!collapsed && hasHighlight && (
          <button onClick={onClearHighlight} className="om-summary__clear-btn">
            Bỏ chọn
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="om-summary__list custom-scrollbar">
          {dishes.map((dish) => {
            const isActive = activeKey === dish.key;
            let qtyLabel = "";

            if (dish.unit === "kg") {
              const portions = dish.portions || [];
              if (portions.length === 0) qtyLabel = "";
              else if (portions.length <= 4)
                qtyLabel = portions.map(formatPortion).join("/") + "kg";
              else {
                const visible = portions.slice(0, 4);
                qtyLabel =
                  visible.map(formatPortion).join("/") +
                  ` +${portions.length - 4}kg`;
              }
            } else {
              qtyLabel = dish.totalCount ?? 0;
            }

            return (
              <button
                key={dish.key}
                onClick={() => onDishClick(dish)}
                className={`om-chip om-chip--${size} ${
                  isActive ? "om-chip--active" : ""
                }`}
              >
                <span className="om-chip__name">{dish.name}</span>
                <span className="om-chip__qty">{qtyLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------- Main Component ---------------- */
const OrderManagement = () => {
  // --- STATE ---
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("oldest");

  const [focusMode, setFocusMode] = useState(false);
  const [highlightDishKey, setHighlightDishKey] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState([]);

  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };
  const { restaurantList } = useRestaurant();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [mutConfirmIncomingOrder] = useMutation(CONFIRM_INCOMING_ORDER);
  const [mutRejectIncomingOrder] = useMutation(REJECT_INCOMING_ORDER);
  const [mutCreateTempBillJob] = useMutation(CREATE_TEMP_BILL_PRINT_JOB);

  // Settings
  const [timeSettings, setTimeSettings] = useState({
    warn: 10,
    danger: 20,
    critical: 30,
  });
  const [hiddenOrderIds, setHiddenOrderIds] = useState([]);
  const [chipSize, setChipSize] = useState("m");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeColors, setTimeColors] = useState({
    ok: "#16a34a",
    warn: "#eab308",
    danger: "#f97316",
    critical: "#b91c1c",
  });

  // --- EFFECTS & HOOKS ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem("orderSettings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.timeSettings) setTimeSettings(parsed.timeSettings);
        if (parsed.chipSize) setChipSize(parsed.chipSize);
        if (parsed.timeColors) setTimeColors(parsed.timeColors);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "orderSettings",
        JSON.stringify({ timeSettings, chipSize, timeColors })
      );
    } catch (e) {
      void e;
    }
  }, [timeSettings, chipSize, timeColors]);

  const {
    ordersNow,
    ordersNowLoading,
    ordersNowError,
    loadOrdersNow,
    updateItemStatus,
  } = useOrderManagement();

  const orders = ordersNow || [];
  const ordersLoading = ordersNowLoading;
  const ordersError = ordersNowError;
  const loadOrders = loadOrdersNow;

  useEffect(() => {
    if (restaurantList.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantList[0].id);
    }
  }, [restaurantList, selectedRestaurantId]);

  useEffect(() => {
    setHiddenOrderIds([]);
  }, [selectedRestaurantId]);

  // Socket Realtime
  useSocketOrder(selectedRestaurantId, {
    onAny: (evt) => {
      if (evt?.order?.tableCode)
        showNotification(
          `Realtime: ${evt.type} (${evt.order.tableCode})`,
          "info"
        );
      if (loadOrders && selectedRestaurantId) {
        loadOrders({
          variables: { restaurantId: selectedRestaurantId, limit: 100 },
          fetchPolicy: "network-only",
        });
      }
    },
  });

  useEffect(() => {
    if (selectedRestaurantId && loadOrders) {
      loadOrders({
        variables: { restaurantId: selectedRestaurantId, limit: 100 },
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  // Keybind 'F' for Focus Mode
  useEffect(() => {
    const onKey = (e) => {
      if (
        ["input", "textarea", "select"].includes(
          (e.target?.tagName || "").toLowerCase()
        ) ||
        e.target?.isContentEditable
      )
        return;
      if (e.key.toLowerCase() === "f") setFocusMode((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- LOGIC ---
  const activeOrders = useMemo(
    () =>
      (orders || []).filter(
        (o) =>
          !["served", "completed", "cancelled"].includes(o.currentStatus) &&
          !hiddenOrderIds.includes(o.id)
      ),
    [orders, hiddenOrderIds]
  );

  const normalizeText = (value) => {
    if (!value) return "";
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const isRemoteStaffPendingOrder = useCallback((order) => {
    if (!order) return false;
    const typeOk = ["delivery", "takeaway"].includes(order.orderType);
    const statusOk = order.currentStatus === "pending";
    const meta = order.clientMeta || {};
    const source = String(meta.source || meta.clientSource || "").toLowerCase();
    const channel = String(meta.channel || "").toLowerCase();
    const clientType = String(meta.clientType || "").toLowerCase();
    return typeOk && statusOk && [source, channel, clientType].includes("staff_remote");
  }, []);

  const filteredOrders = useMemo(() => {
    const raw = searchTerm || "";
    const q = normalizeText(raw);
    const endsWithSpace = /\s$/.test(raw);
    const singleToken = q && !q.includes(" ");

    const matchesStatus = (o) => {
      if (statusFilter === "remote_staff_pending") return isRemoteStaffPendingOrder(o);
      return !statusFilter || o.currentStatus === statusFilter;
    };
    const matchesTableType = (o) => !tableFilter || o.orderType === tableFilter;
    const matchesDate = (o) => {
      const created = o?.createdAt ? new Date(o.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) return !dateFrom && !dateTo;
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (created < from) return false;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`);
        if (created > to) return false;
      }
      return true;
    };

    if (!q)
      return activeOrders.filter(
        (o) => matchesStatus(o) && matchesTableType(o) && matchesDate(o)
      );

    if (endsWithSpace && singleToken) {
      return activeOrders.filter((o) => {
        const table = normalizeText(o.tableCode);
        const code = normalizeText(o.orderCode);
        const id = normalizeText(o.id);
        return (
          (table === q || code === q || id === q || id.endsWith(q)) &&
          matchesStatus(o) &&
          matchesTableType(o) &&
          matchesDate(o)
        );
      });
    }

    const tokens = q.split(" ");
    return activeOrders.filter((o) => {
      const combined = [
        o.id,
        o.orderCode,
        o.tableCode,
        o.user?.fullName,
        o.note,
        o.user?.phone,
        ...(o.items || []).map((it) => it.name),
      ]
        .map(normalizeText)
        .join(" ");
      return (
        tokens.every((t) => combined.includes(t)) &&
        matchesStatus(o) &&
        matchesTableType(o) &&
        matchesDate(o)
      );
    });
  }, [activeOrders, searchTerm, statusFilter, tableFilter, dateFrom, dateTo, isRemoteStaffPendingOrder]);

  const orderedFilteredOrders = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === "newest" ? tb - ta : ta - tb;
    });
    return sorted;
  }, [filteredOrders, sortBy]);

  const handleExportCsv = useCallback(() => {
    const rows = orderedFilteredOrders.map((o) => ({
      orderCode: o.orderCode || o.id,
      tableCode: o.tableCode || "",
      orderType: o.orderType || "",
      status: o.currentStatus || "",
      paymentStatus: o.payment?.status || "",
      paymentMethod: o.payment?.method || "",
      total: o.totals?.grandTotal || 0,
      createdAt: o.createdAt || "",
    }));
    const header = [
      "orderCode",
      "tableCode",
      "orderType",
      "status",
      "paymentStatus",
      "paymentMethod",
      "total",
      "createdAt",
    ];
    const csvRows = rows.map((r) =>
      header
        .map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${selectedRestaurantId || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [orderedFilteredOrders, selectedRestaurantId]);

  const dishSummaries = useMemo(() => {
    const map = new Map();
    activeOrders.forEach((order) => {
      const createdAtMs = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();
      (order.items || []).forEach((item) => {
        if (!item || item.status === "cancelled") return;
        const name = item.name || "Món không tên";
        const unit = item.unit || "portion";
        const dishId = item.dishId || item.menuId || name;
        const key = `${dishId}-${unit}-${name}`;

        if (!map.has(key)) {
          map.set(key, {
            key,
            dishId,
            name,
            unit,
            totalCount: 0,
            portions: [],
            orderIds: new Set(),
            earliestCreatedAt: createdAtMs,
          });
        }
        const summary = map.get(key);
        const qty = Number(item.quantity || 0);
        if (createdAtMs < summary.earliestCreatedAt)
          summary.earliestCreatedAt = createdAtMs;
        if (unit === "kg" && qty > 0) summary.portions.push(qty);
        else if (qty > 0) summary.totalCount += qty;
        if (order.id) summary.orderIds.add(order.id);
      });
    });

    return Array.from(map.values())
      .map((d) => ({ ...d, orderIds: Array.from(d.orderIds) }))
      .sort((a, b) => {
        const ta = a.earliestCreatedAt,
          tb = b.earliestCreatedAt;
        if (ta !== tb) return ta - tb;
        return (
          b.orderIds.length - a.orderIds.length ||
          (b.totalCount || 0) - (a.totalCount || 0) ||
          a.name.localeCompare(b.name, "vi")
        );
      });
  }, [activeOrders]);

  const stats = useMemo(
    () => ({
      total: activeOrders.length,
      pending: activeOrders.filter(
        (o) => !["completed", "cancelled", "served"].includes(o.currentStatus)
      ).length,
      preparing: activeOrders.filter((o) => o.currentStatus === "preparing")
        .length,
      completed: 0,
    }),
    [activeOrders]
  );

  // --- HANDLERS ---
  const handleUpdateStatus = useCallback(
    async (orderId, status, extraNote = "") => {
      if (!orderId || !status) return;
      try {
        const { data } = await mutUpdateOrderStatus({
          variables: {
            input: { id: orderId, restaurantId: selectedRestaurantId, status, note: extraNote },
          },
        });
        const updated = data?.updateOrderStatus;
        setSelectedOrder((prev) =>
          prev?.id === orderId
            ? { ...prev, currentStatus: status, updatedAt: updated?.updatedAt }
            : prev
        );
        if (["served", "completed", "cancelled"].includes(status)) {
          setHiddenOrderIds((prev) =>
            prev.includes(orderId) ? prev : [...prev, orderId]
          );
        }
        if (loadOrders && selectedRestaurantId)
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
      } catch (err) {
        console.error(err);
        showNotification(err?.message || "Lỗi cập nhật", "error");
      }
    },
    [mutUpdateOrderStatus, loadOrders, selectedRestaurantId, showNotification]
  );

  const handleUpdateItemStatus = useCallback(
    (orderId, itemKey, nextStatus) => {
      const ord = orders.find((o) => o.id === orderId);
      return updateItemStatus({
        orderId,
        itemKey,
        status: nextStatus,
        restaurantId: selectedRestaurantId,
        tableCode: ord?.tableCode,
        itemsSnapshot: ord?.items,
        afterSuccess: (updated) => {
          if (updated) setSelectedOrder(updated);
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        },
      });
    },
    [orders, selectedRestaurantId, loadOrders, updateItemStatus]
  );

  const handleDishClick = useCallback((dish) => {
    if (!dish) return;
    setHighlightDishKey(dish.key);
    setHighlightedOrderIds(dish.orderIds || []);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const cards = Array.from(document.querySelectorAll("[data-order-id]"));
        const matched = cards.find((el) =>
          (dish.orderIds || []).includes(el.getAttribute("data-order-id"))
        );
        if (matched)
          matched.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, []);

  const handleClearHighlight = useCallback(() => {
    setHighlightDishKey(null);
    setHighlightedOrderIds([]);
  }, []);

  const handleRejectOrder = useCallback(
    async (orderId) => {
      const reason = window.prompt("Nhập lý do từ chối đơn:", "");
      if (reason == null) return;
      await mutRejectIncomingOrder({ variables: { input: { id: orderId, restaurantId: selectedRestaurantId, reason } } });
      loadOrders({ variables: { restaurantId: selectedRestaurantId, limit: 100 }, fetchPolicy: "network-only" });
      showNotification("Đã từ chối đơn từ xa", "warning");
    },
    [loadOrders, mutRejectIncomingOrder, selectedRestaurantId, showNotification]
  );
  const handleConfirmRemoteOrder = useCallback(async (orderId) => {
    await mutConfirmIncomingOrder({ variables: { input: { id: orderId, restaurantId: selectedRestaurantId } } });
    loadOrders({ variables: { restaurantId: selectedRestaurantId, limit: 100 }, fetchPolicy: "network-only" });
  }, [loadOrders, mutConfirmIncomingOrder, selectedRestaurantId]);
  const handleCreateTemporaryBill = useCallback(async (order) => {
    if (!order?.id || !selectedRestaurantId) return;
    await mutCreateTempBillJob({ variables: { input: { orderId: order.id, restaurantId: selectedRestaurantId } } });
    showNotification("Đã tạo print job in tạm tính.", "success");
  }, [mutCreateTempBillJob, selectedRestaurantId, showNotification]);

  // ---------------- RENDER ----------------
  return (
    <div className={`om-container ${focusMode ? "om-container--focus" : ""}`}>
      <div className="om-wrapper">
        {/* --- 1. HEADER --- */}
        <header className="om-header">
          {!focusMode ? (
            <div className="om-header__titles">
              <h1 className="om-header__title">🍽️ Quản Lý Đơn Hàng</h1>
              <p className="om-header__subtitle">
                Theo dõi và xử lý đơn hàng thời gian thực
              </p>
            </div>
          ) : (
            <div className="om-header__focus-title">
              <span className="om-badge-live">LIVE</span>
              <h1>KITCHEN DISPLAY</h1>
            </div>
          )}

          <div className="om-header__actions">
            {!focusMode && (
              <>
                {restaurantList.length > 0 && (
                  <div className="om-select-wrapper">
                    <select
                      value={selectedRestaurantId}
                      onChange={(e) => setSelectedRestaurantId(e.target.value)}
                      className="om-select"
                    >
                      {restaurantList.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="om-select-icon" />
                  </div>
                )}
                <button
                  onClick={() => setShowHistory(true)}
                  className="om-btn-icon"
                  title="Lịch sử"
                >
                  <History size={20} />
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="om-btn-icon"
                  title="Cài đặt"
                >
                  <Settings size={20} />
                </button>
              </>
            )}

            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`om-btn-focus ${
                focusMode ? "om-btn-focus--active" : ""
              }`}
            >
              {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{focusMode ? "Thoát chế độ Bếp" : "Chế độ Bếp"}</span>
            </button>
          </div>
        </header>

        {/* --- 2. STATS (Normal Mode only) --- */}
        {!focusMode && (
          <div className="om-stats-grid">
            <StatsCard
              icon={<ShoppingBag />}
              title="Tổng đơn hàng"
              value={stats.total}
              variant="blue"
            />
            <StatsCard
              icon={<Clock />}
              title="Chưa hoàn thành"
              value={stats.pending}
              variant="warning"
            />
            <StatsCard
              icon={<ChefHat />}
              title="Đang chuẩn bị"
              value={stats.preparing}
              variant="purple"
            />
            <StatsCard
              icon={<CheckCircle />}
              title="Đã xong (phiên)"
              value={stats.completed}
              variant="success"
            />
          </div>
        )}

        {/* --- 3. TOOLBAR --- */}
        <div className={`om-toolbar ${focusMode ? "om-toolbar--focus" : ""}`}>
          <div className="om-toolbar__inner">
            <div className="om-toolbar__filters">
              {/* Search */}
              <div className="om-search-box">
                <Search size={18} className="om-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm ID, Tên KH, Món..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="om-search-input"
                />
              </div>

              {/* Filter Buttons */}
              <div className="om-filter-group">
                <div className="om-select-wrapper">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="om-select-input"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="pending">Chờ xác nhận</option>
                    <option value="remote_staff_pending">Đơn từ xa chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="preparing">Đang chuẩn bị</option>
                    <option value="ready">Sẵn sàng</option>
                  </select>
                  <Filter size={16} className="om-select-icon-left" />
                  <ChevronDown size={14} className="om-select-icon-right" />
                </div>

                {!focusMode && (
                  <div className="om-select-wrapper">
                    <select
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      className="om-select-input"
                    >
                      <option value="">Tất cả loại</option>
                      <option value="dine_in">Tại bàn</option>
                      <option value="takeaway">Mang về</option>
                      <option value="delivery">Giao hàng</option>
                    </select>
                    <ChevronDown size={14} className="om-select-icon-right" />
                  </div>
                )}
                {!focusMode && (
                  <>
                    <div className="om-select-wrapper">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="om-select-input"
                        title="Từ ngày"
                      />
                    </div>
                    <div className="om-select-wrapper">
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="om-select-input"
                        title="Đến ngày"
                      />
                    </div>
                    <div className="om-select-wrapper">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="om-select-input"
                      >
                        <option value="oldest">Cũ nhất trước</option>
                        <option value="newest">Mới nhất trước</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="om-toolbar__actions">
              {focusMode ? (
                <div className="om-size-control">
                  <span>Cỡ thẻ:</span>
                  <select
                    value={chipSize}
                    onChange={(e) => setChipSize(e.target.value)}
                  >
                    <option value="s">Nhỏ</option>
                    <option value="m">Vừa</option>
                    <option value="l">Lớn</option>
                  </select>
                </div>
              ) : (
                <button className="om-btn-outline" onClick={handleExportCsv}>
                  <Download size={18} />
                  <span>Xuất BC</span>
                </button>
              )}

              <button
                onClick={() => setShowNewOrderModal(true)}
                disabled={!selectedRestaurantId}
                className="om-btn-primary"
              >
                <Plus size={18} />
                <span>Đơn mới</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- 4. SUMMARY PANEL (Focus Mode) --- */}
        {focusMode && dishSummaries.length > 0 && (
          <DishSummaryPanel
            dishes={dishSummaries}
            activeKey={highlightDishKey}
            onDishClick={handleDishClick}
            onClearHighlight={handleClearHighlight}
            size={chipSize}
          />
        )}

        {/* --- 5. GRID CONTENT --- */}
        <div className="om-content">
          {ordersLoading ? (
            <div className="om-state">
              <Loader size={40} className="om-spinner" />
              <p>Đang tải dữ liệu đơn hàng...</p>
            </div>
          ) : ordersError ? (
            <div className="om-state om-state--error">
              <AlertTriangle size={48} />
              <h3>Đã xảy ra lỗi</h3>
              <p>{ordersError.message}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="om-state om-state--empty">
              <div className="om-state__icon-bg">
                <CheckCircle size={40} />
              </div>
              <h3>Không có đơn hàng nào</h3>
              <p>
                {activeOrders.length > 0
                  ? "Không tìm thấy kết quả phù hợp"
                  : "Đợi đơn hàng mới xuất hiện..."}
              </p>
            </div>
          ) : (
            <div className="om-grid">
              {orderedFilteredOrders.map((order) => (
                <div
                  key={order.id}
                  data-order-id={order.id}
                  className={`om-card-wrapper ${
                    highlightedOrderIds.includes(order.id)
                      ? "om-card-wrapper--highlight"
                      : ""
                  }`}
                >
                  <OrderCard
                    order={order}
                    onUpdateStatus={async (orderId, status) => {
                      if (status === "confirmed" && isRemoteStaffPendingOrder(order)) return handleConfirmRemoteOrder(orderId);
                      return handleUpdateStatus(orderId, status);
                    }}
                    onRejectOrder={handleRejectOrder}
                    isRemoteStaffPending={isRemoteStaffPendingOrder(order)}
                    onViewOrder={() => setSelectedOrder(order)}
                    onViewItem={(data) => setSelectedItem(data)}
                    isFocusMode={focusMode}
                    onQuickItemDone={handleUpdateItemStatus}
                    onMessageCustomer={(o) => {
                      const threadId = o?.clientMeta?.chatThreadId;
                      if (!threadId) return showNotification("Chưa có luồng chat cho đơn này", "warning");
                      window.location.href = `/staff?tab=contacts&threadId=${threadId}`;
                    }}
                    timeThresholds={timeSettings}
                    timeColors={timeColors}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- 6. MODALS --- */}
        {showNewOrderModal && (
          <NewOrderModal
            isOpen={showNewOrderModal}
            onClose={() => setShowNewOrderModal(false)}
            restaurantId={selectedRestaurantId}
            onSuccess={() => {
              setShowNewOrderModal(false);
              if (loadOrders && selectedRestaurantId)
                loadOrders({
                  variables: { restaurantId: selectedRestaurantId, limit: 100 },
                  fetchPolicy: "network-only",
                });
            }}
          />
        )}

        <OrderSettingsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          timeSettings={timeSettings}
          onSaveTimeSettings={setTimeSettings}
          chipSize={chipSize}
          onSaveChipSize={setChipSize}
          timeColors={timeColors}
          onSaveTimeColors={setTimeColors}
        />

        {selectedOrder && (
          <OrderModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateItemStatus={handleUpdateItemStatus}
            onCreateTemporaryBill={handleCreateTemporaryBill}
          />
        )}

        {selectedItem && (
          <ItemModal
            item={selectedItem.item}
            onClose={() => setSelectedItem(null)}
          />
        )}

        {showHistory && (
          <HistoryModal
            restaurantId={selectedRestaurantId}
            onClose={() => setShowHistory(false)}
            onViewOrder={(o) => setSelectedOrder(o)}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
