// src/pages/OrderManagement/OrderManagement.js
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
  Eye,
  Download,
  History,
  Loader,
  ChevronDown,
  Maximize2,
  Minimize2,
  Settings,
} from "lucide-react";
import { gql, useMutation } from "@apollo/client";

import OrderCard from "./components/OrderCard";
import OrderModal from "./components/OrderModal";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
import NewOrderModal from "./components/NewOrderModal.jsx";
import StatsCard from "./components/StatsCard";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { useNotification } from "@/hooks/useNotification";
import { AuthContext } from "@/context/AuthContext";
import useSocketOrder from "@/hooks/useSocketOrder";
import OrderSettingsModal from "./components/OrderSettingsModal.jsx";
import "./OrderManagement.scss";

/* ---------------- GQL: cập nhật trạng thái ORDER theo ID ---------------- */

const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
      updatedAt
    }
  }
`;

// ---------------- Auth/Restaurant ----------------
const useRestaurant = () => {
  const { restaurants } = useContext(AuthContext);
  return {
    restaurantList: restaurants || [],
  };
};

/**
 * Panel tóm tắt món trong chế độ Focus (Bếp)
 * - dishes: [{ key, name, unit, totalCount?, portions?, orderIds }]
 */
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
    if (Number.isInteger(num)) return num.toString();
    return num.toString().replace(/\.0+$/, "");
  };

  return (
    <div className={`dishSummary dishSummary--${size}`}>
      <div className="dishSummary__header">
        <button
          type="button"
          className="dishSummary__toggle"
          onClick={() => setCollapsed((s) => !s)}
        >
          Tóm tắt món ({dishes.length}){" "}
          <span className="dishSummary__toggleIcon">
            {collapsed ? "▼" : "▲"}
          </span>
        </button>

        {!collapsed && (
          <button
            type="button"
            className="dishSummary__clearButton"
            onClick={onClearHighlight}
            disabled={!hasHighlight}
          >
            Tắt đánh dấu
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="dishSummary__list">
          {dishes.map((dish) => {
            const isActive = activeKey === dish.key;

            let qtyLabel = "";
            if (dish.unit === "kg") {
              const portions = dish.portions || [];
              if (portions.length === 0) {
                qtyLabel = "";
              } else if (portions.length <= 4) {
                qtyLabel =
                  portions.map((p) => formatPortion(p)).join(" / ") + " kg";
              } else {
                const visible = portions.slice(0, 4);
                const hidden = portions.length - visible.length;
                qtyLabel =
                  visible.map((p) => formatPortion(p)).join(" / ") +
                  ` +${hidden} kg`;
              }
            } else {
              qtyLabel = dish.totalCount ?? 0;
            }

            return (
              <button
                key={dish.key}
                type="button"
                className={`dishSummary__item ${
                  isActive ? "dishSummary__item--active" : ""
                }`}
                onClick={() => onDishClick(dish)}
              >
                <span className="dishSummary__name">{dish.name}</span>
                <span className="dishSummary__qty">{qtyLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------- Component ----------------
const OrderManagement = () => {
  // Modal & filter state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");

  // focus mode (Kitchen view)
  const [focusMode, setFocusMode] = useState(false);

  // highlight theo món
  const [highlightDishKey, setHighlightDishKey] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState([]);

  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // Restaurant
  const { restaurantList } = useRestaurant();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  // Hooks GQL
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);

  // ======= SETTINGS =======
  const [timeSettings, setTimeSettings] = useState({
    warn: 10,
    danger: 20,
    critical: 30,
  });
  const [hiddenOrderIds, setHiddenOrderIds] = useState([]);
  const [chipSize, setChipSize] = useState("m"); // s | m | l
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeColors, setTimeColors] = useState({
    ok: "#16a34a", // xanh lá
    warn: "#eab308", // vàng
    danger: "#f97316", // cam/đỏ nhạt
    critical: "#b91c1c", // đỏ đậm
  });
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
      console.warn("Cannot load orderSettings from localStorage", e);
    }
  }, []);

  // lưu mỗi khi đổi
  useEffect(() => {
    try {
      const payload = { timeSettings, chipSize, timeColors };
      localStorage.setItem("orderSettings", JSON.stringify(payload));
    } catch {}
  }, [timeSettings, chipSize, timeColors]);
  // ====== DÙNG ĐÚNG TÊN BIẾN CỦA HOOK useOrderManagement ======
  const {
    ordersNow,
    ordersNowLoading,
    ordersNowError,
    loadOrdersNow,
    updateItemStatus,
  } = useOrderManagement();

  // Chuẩn hoá thành biến local như code cũ
  const orders = ordersNow || [];
  const ordersLoading = ordersNowLoading;
  const ordersError = ordersNowError;
  const loadOrders = loadOrdersNow;

  // Auto-pick first restaurant
  useEffect(() => {
    if (restaurantList.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantList[0].id);
    }
  }, [restaurantList, selectedRestaurantId]);
  useEffect(() => {
    setHiddenOrderIds([]);
  }, [selectedRestaurantId]);
  // socket realtime cho màn quản lý (theo restaurantId)
  useSocketOrder(selectedRestaurantId, {
    onAny: (evt) => {
      if (evt?.order?.tableCode) {
        showNotification(
          `Realtime: ${evt.type} (${evt.order.tableCode})`,
          "info"
        );
      }
      if (loadOrders && selectedRestaurantId) {
        loadOrders({
          variables: { restaurantId: selectedRestaurantId, limit: 100 },
          fetchPolicy: "network-only",
        });
      }
    },
  });

  // Fetch orders khi đổi nhà hàng
  useEffect(() => {
    if (selectedRestaurantId && loadOrders) {
      loadOrders({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 100,
        },
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  // Toggle focus với phím "f"
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTypingElement =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        e.target?.isContentEditable;

      if (isTypingElement) return; // đang gõ trong ô, bỏ qua

      if (e.key.toLowerCase() === "f") {
        setFocusMode((s) => !s);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ========= Active orders (bỏ served/completed/cancelled) =========
  const activeOrders = useMemo(
    () =>
      (orders || []).filter(
        (o) =>
          o.currentStatus !== "served" &&
          o.currentStatus !== "completed" &&
          o.currentStatus !== "cancelled" &&
          !hiddenOrderIds.includes(o.id) // ẩn tạm
      ),
    [orders, hiddenOrderIds]
  );

  // ========= TÓM TẮT MÓN CHO CHẾ ĐỘ FOCUS =========
  // ========= TÓM TẮT MÓN CHO CHẾ ĐỘ FOCUS =========
  // Sắp xếp món theo thời gian xuất hiện sớm nhất (món chờ lâu nhất đứng đầu)
  const dishSummaries = useMemo(() => {
    const map = new Map();

    (activeOrders || []).forEach((order) => {
      const createdAtMs = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();

      (order.items || []).forEach((item) => {
        if (!item) return;
        if (item.status === "cancelled") return;

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

        // ghi nhận thời điểm xuất hiện sớm nhất của món
        if (
          summary.earliestCreatedAt == null ||
          createdAtMs < summary.earliestCreatedAt
        ) {
          summary.earliestCreatedAt = createdAtMs;
        }

        if (unit === "kg") {
          if (Number.isFinite(qty) && qty > 0) {
            summary.portions.push(qty);
          }
        } else {
          if (Number.isFinite(qty) && qty > 0) {
            summary.totalCount += qty;
          }
        }

        if (order.id) {
          summary.orderIds.add(order.id);
        }
      });
    });

    const arr = Array.from(map.values()).map((d) => ({
      ...d,
      orderIds: Array.from(d.orderIds),
    }));

    arr.sort((a, b) => {
      const ta = a.earliestCreatedAt ?? Number.POSITIVE_INFINITY;
      const tb = b.earliestCreatedAt ?? Number.POSITIVE_INFINITY;

      // 1) Món nào xuất hiện SỚM hơn (chờ lâu hơn) đứng trước
      if (ta !== tb) return ta - tb;

      // 2) Nếu cùng thời gian, ưu tiên món xuất hiện ở nhiều order hơn
      const na = a.orderIds.length;
      const nb = b.orderIds.length;
      if (nb !== na) return nb - na;

      // 3) Nếu vẫn bằng, ưu tiên tổng count / số lần xuất hiện
      const ca = a.totalCount || (a.portions || []).length;
      const cb = b.totalCount || (b.portions || []).length;
      if (cb !== ca) return cb - ca;

      // 4) Cuối cùng: sort theo tên
      return a.name.localeCompare(b.name, "vi");
    });

    return arr;
  }, [activeOrders]);

  // ========= Handlers =========

  const handleUpdateStatus = useCallback(
    async (orderId, status) => {
      if (!orderId || !status) return;

      try {
        const { data } = await mutUpdateOrderStatus({
          variables: {
            input: {
              id: orderId,
              status,
            },
          },
        });

        const updated = data?.updateOrderStatus;

        // ⚡ Cập nhật ngay trạng thái trong modal nếu đang mở đơn này
        setSelectedOrder((prev) =>
          prev && prev.id === orderId
            ? { ...prev, currentStatus: status, updatedAt: updated?.updatedAt }
            : prev
        );

        // ⚡ Nếu trạng thái là served (hoặc hoàn tất khác) → ẩn card ngay
        const terminalStatuses = ["served", "completed", "cancelled"];
        if (terminalStatuses.includes(status)) {
          setHiddenOrderIds((prev) =>
            prev.includes(orderId) ? prev : [...prev, orderId]
          );
        }

        // vẫn load lại để sync với server (socket, totals, v.v.)
        if (loadOrders && selectedRestaurantId) {
          await loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        }
      } catch (err) {
        console.error("Update order status failed:", err);
        showNotification?.(
          err?.message || "Cập nhật trạng thái đơn thất bại.",
          "error"
        );
      }
    },
    [
      mutUpdateOrderStatus,
      loadOrders,
      selectedRestaurantId,
      showNotification,
      setSelectedOrder,
      setHiddenOrderIds,
    ]
  );

  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
  }, []);

  const handleViewItem = useCallback((itemData) => {
    setSelectedItem(itemData);
  }, []);

  const handleNewOrderSuccess = useCallback(() => {
    setShowNewOrderModal(false);
    if (loadOrders && selectedRestaurantId) {
      loadOrders({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 100,
        },
        fetchPolicy: "network-only",
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  /** ✅ Đổi trạng thái item theo ORDER ID + itemKey */
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
        afterSuccess: (updatedServerOrder) => {
          if (updatedServerOrder) {
            setSelectedOrder(updatedServerOrder);
          }
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        },
      });
    },
    [orders, selectedRestaurantId, loadOrders, updateItemStatus]
  );

  // Khi click vào 1 món ở panel tóm tắt
  const handleDishClick = useCallback((dish) => {
    if (!dish) return;
    setHighlightDishKey(dish.key);
    setHighlightedOrderIds(dish.orderIds || []);

    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const cards = Array.from(
        document.querySelectorAll(
          ".orderCardWrapper[data-order-id], .orderCard[data-order-id]"
        )
      );

      const matched = cards.filter((el) => {
        const id = el.getAttribute("data-order-id");
        return id && (dish.orderIds || []).includes(id);
      });

      if (matched.length > 0) {
        matched[0].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
  }, []);

  const handleClearHighlight = useCallback(() => {
    setHighlightDishKey(null);
    setHighlightedOrderIds([]);
  }, []);

  // ========= Filters & stats =========
  // Chuẩn hoá text để search: bỏ dấu, lower-case, gom khoảng trắng
  // Chuẩn hoá text để search: bỏ dấu, lower-case, gom khoảng trắng
  const normalizeText = (value) => {
    if (!value) return "";
    return String(value)
      .toLowerCase()
      .normalize("NFD") // tách dấu tiếng Việt
      .replace(/[\u0300-\u036f]/g, "") // xoá dấu
      .replace(/\s+/g, " ") // gom nhiều space
      .trim();
  };

  const filteredOrders = useMemo(() => {
    const raw = searchTerm || "";
    const q = normalizeText(raw);

    const endsWithSpace = /\s$/.test(raw); // có space ở cuối?
    const singleToken = q && !q.includes(" ");

    const matchesStatus = (order) =>
      !statusFilter || order.currentStatus === statusFilter;

    const matchesTableType = (order) =>
      !tableFilter || order.orderType === tableFilter;

    // 1) Không gõ gì → trả luôn
    if (!q) {
      return (activeOrders || []).filter(
        (o) => matchesStatus(o) && matchesTableType(o)
      );
    }

    // 2) TRƯỜNG HỢP ĐẶC BIỆT: "A1 " (1 token + space cuối)
    //    → so sánh chính xác tableCode / orderCode / id
    if (endsWithSpace && singleToken) {
      return (activeOrders || []).filter((order) => {
        const table = normalizeText(order.tableCode);
        const code = normalizeText(order.orderCode);
        const id = normalizeText(order.id);

        const isExactMatch =
          table === q || code === q || id === q || id.endsWith(q);

        return isExactMatch && matchesStatus(order) && matchesTableType(order);
      });
    }

    // 3) Còn lại: search mềm, nhiều token (vd: "a1 canh", "0938 com ga")
    const tokens = q.split(" ");

    return (activeOrders || []).filter((order) => {
      const user = order.user || {};

      // thu thập dữ liệu để search
      const phones = [user.phone];
      const emails = [user.email];

      const combined = [
        order.id,
        order.orderCode,
        order.tableCode,
        user.fullName,

        order.note,
        ...phones,
        ...emails,
        ...(order.items || []).map((it) => it.name),
      ]
        .map(normalizeText)
        .join(" ");

      const matchesSearch = tokens.every((t) => combined.includes(t));

      return matchesSearch && matchesStatus(order) && matchesTableType(order);
    });
  }, [activeOrders, searchTerm, statusFilter, tableFilter]);

  const orderedFilteredOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb; // cũ hơn đứng trước
    });
  }, [filteredOrders]);
  const stats = useMemo(
    () => ({
      total: activeOrders.length,
      pending: activeOrders.filter(
        (o) =>
          o.currentStatus !== "completed" &&
          o.currentStatus !== "cancelled" &&
          o.currentStatus !== "served"
      ).length,
      preparing: activeOrders.filter((o) => o.currentStatus === "preparing")
        .length,
      completed: 0,
    }),
    [activeOrders]
  );

  return (
    <div className={`orderManagement ${focusMode ? "focusMode" : ""}`}>
      <div className={`container ${focusMode ? "container--fluid" : ""}`}>
        {/* Header */}
        <div
          className={`header-order-management ${
            focusMode ? "header-order-management--compact" : ""
          }`}
        >
          <div className="headerContent">
            {!focusMode && (
              <div>
                <h1 className="title">🍽️ Quản Lý Đơn Hàng</h1>
                <p className="subtitle">
                  Theo dõi và xử lý đơn hàng nhà hàng theo thời gian thực
                </p>
              </div>
            )}

            <div className="headerActions">
              {!focusMode && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="historyButton"
                >
                  <History size={20} />
                  <span>Lịch sử đơn hàng</span>
                </button>
              )}
              <button
                type="button"
                className="settingsButton"
                title="Cài đặt hiển thị"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => setFocusMode((s) => !s)}
                className={`focusToggleButton ${
                  focusMode ? "focusToggleButton--on" : ""
                }`}
                title="Nhấn F để bật/tắt nhanh"
              >
                {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span>
                  {focusMode ? "Thoát chế độ Bếp" : "Chế độ Bếp (Focus)"}
                </span>
              </button>
            </div>
          </div>

          {/* Quick controls for Focus mode */}
          {focusMode && (
            <>
              <div className="focusControls">
                <div className="controlsLeft">
                  <div className="searchBox">
                    <input
                      type="text"
                      placeholder="Tìm nhanh (ID, tên KH, mã bàn)…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="searchInput"
                    />
                    <div className="searchIcon">
                      <Eye size={16} />
                    </div>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filterSelect"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="pending">Chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="preparing">Đang chuẩn bị</option>
                    <option value="ready">Sẵn sàng</option>
                  </select>
                </div>

                <div className="controlsRight">
                  <div className="chipSizeControl">
                    <label>Cỡ thẻ món:</label>
                    <select
                      value={chipSize}
                      onChange={(e) => setChipSize(e.target.value)}
                      className="chipSizeSelect"
                    >
                      <option value="s">Nhỏ</option>
                      <option value="m">Vừa</option>
                      <option value="l">Lớn</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setShowNewOrderModal(true)}
                    disabled={!selectedRestaurantId}
                    className="newOrderButton focusNewOrderButton"
                  >
                    Tạo đơn nhanh
                  </button>
                </div>
              </div>

              {dishSummaries.length > 0 && (
                <DishSummaryPanel
                  dishes={dishSummaries}
                  activeKey={highlightDishKey}
                  onDishClick={handleDishClick}
                  onClearHighlight={handleClearHighlight}
                  size={chipSize}
                />
              )}
            </>
          )}
        </div>

        {/* Stats (hide in focus) */}
        {!focusMode && (
          <div className="statsGrid">
            <StatsCard
              icon={<CheckCircle className="text-blue-600" />}
              title="Tổng đơn hàng"
              value={stats.total}
              bgColor="bg-blue-50"
            />
            <StatsCard
              icon={<Clock className="text-orange-600" />}
              title="Chưa hoàn thành"
              value={stats.pending}
              bgColor="bg-orange-50"
            />
            <StatsCard
              icon={<ChefHat className="text-purple-600" />}
              title="Đang chuẩn bị"
              value={stats.preparing}
              bgColor="bg-purple-50"
            />
            <StatsCard
              icon={<CheckCircle className="text-green-600" />}
              title="Hoàn thành"
              value={stats.completed}
              bgColor="bg-green-50"
            />
          </div>
        )}

        {/* Controls (hide in focus) */}
        {!focusMode && (
          <div className="controls">
            <div className="controlsLeft">
              {restaurantList.length > 0 && (
                <div className="restaurantSelectWrapper">
                  <select
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    disabled={restaurantList.length === 1}
                    className="filterSelect restaurantSelect"
                  >
                    {restaurantList.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                  <div className="restaurantSelectIcon">
                    <ChevronDown size={16} />
                  </div>
                </div>
              )}

              <div className="searchBox">
                <input
                  type="text"
                  placeholder="Tìm kiếm đơn hàng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="searchInput"
                />
                <div className="searchIcon">
                  <Eye size={16} />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filterSelect"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="preparing">Đang chuẩn bị</option>
                <option value="ready">Sẵn sàng</option>
              </select>

              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="filterSelect"
              >
                <option value="">Tất cả loại</option>
                <option value="dine_in">Tại bàn</option>
                <option value="takeaway">Mang về</option>
                <option value="delivery">Giao hàng</option>
              </select>
            </div>

            <div className="controlsRight">
              <button className="exportButton">
                <Download size={16} />
                Xuất báo cáo
              </button>

              <button
                onClick={() => setShowNewOrderModal(true)}
                disabled={!selectedRestaurantId}
                className="newOrderButton"
              >
                Đơn hàng mới
              </button>
            </div>
          </div>
        )}

        {/* States */}
        {ordersLoading && (
          <div className="loadingState">
            <Loader size={32} className="text-blue-600 animate-spin" />
            <p className="loadingText">Đang tải đơn hàng cho nhà hàng...</p>
          </div>
        )}

        {ordersError && (
          <div className="errorState">
            <AlertTriangle size={48} className="errorIcon" />
            <h3>Đã xảy ra lỗi</h3>
            <p>{ordersError.message}</p>
          </div>
        )}

        {!ordersLoading && !ordersError && filteredOrders.length === 0 && (
          <div className="emptyState">
            <CheckCircle size={48} />
            <h3>Không có đơn hàng nào</h3>
            <p>
              {activeOrders.length > 0
                ? "Không tìm thấy kết quả phù hợp"
                : "Chọn nhà hàng để bắt đầu"}
            </p>
          </div>
        )}

        {/* Orders Grid */}
        {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
          <div className="ordersGrid">
            {orderedFilteredOrders.map((order) => (
              <div
                key={order.id}
                className={`orderCardWrapper ${
                  highlightedOrderIds.includes(order.id)
                    ? "orderCardWrapper--highlighted"
                    : ""
                }`}
                data-order-id={order.id}
              >
                <OrderCard
                  order={order}
                  onUpdateStatus={handleUpdateStatus}
                  onViewOrder={handleViewOrder}
                  onViewItem={handleViewItem}
                  isFocusMode={focusMode}
                  onQuickItemDone={handleUpdateItemStatus}
                  timeThresholds={timeSettings}
                  timeColors={timeColors}
                />
              </div>
            ))}
          </div>
        )}

        {/* Modals */}
        {showNewOrderModal && (
          <NewOrderModal
            isOpen={showNewOrderModal}
            onClose={() => setShowNewOrderModal(false)}
            restaurantId={selectedRestaurantId}
            onSuccess={handleNewOrderSuccess}
          />
        )}
        <OrderSettingsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          timeSettings={timeSettings}
          onSaveTimeSettings={setTimeSettings}
          chipSize={chipSize}
          onSaveChipSize={setChipSize}
          timeColors={timeColors} // 👈 đưa state vào
          onSaveTimeColors={setTimeColors}
        />
        {selectedOrder && (
          <OrderModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateItemStatus={handleUpdateItemStatus}
          />
        )}

        {selectedItem && (
          <ItemModal
            item={selectedItem.item}
            orderInfo={selectedItem.orderInfo}
            onClose={() => setSelectedItem(null)}
          />
        )}

        {showHistory && (
          <HistoryModal
            restaurantId={selectedRestaurantId}
            onClose={() => setShowHistory(false)}
            onViewOrder={handleViewOrder}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
