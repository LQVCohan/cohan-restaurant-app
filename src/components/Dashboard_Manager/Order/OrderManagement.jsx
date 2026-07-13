// src/pages/OrderManagement/OrderManagement.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  ChefHat,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Minimize2,
  Plus,
  Filter,
  Download,
} from "lucide-react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";

import OrderCard from "./components/OrderCard";
import OrderModal from "./components/OrderModal";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
import NewOrderModal from "./components/NewOrderModal";
import OrderSettingsModal from "./components/OrderSettingsModal";

import useOrderManagement from "../../../hooks/useOrderManagement";
import { useNotification } from "@/hooks/useNotification";
import useSocketOrder from "@/hooks/useSocketOrder";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";

import "./OrderManagement.scss";

/* ---------------- GQL ---------------- */
const ORDERS_BY_RESTAURANT_NOW = gql`
  query OrdersByRestaurantNow($restaurantId: ID!, $limit: Int, $cursor: ID) {
    ordersByRestaurantNow(
      restaurantId: $restaurantId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          orderCode
          parentOrderCode
          orderKind
          parentOrderId
          rootOrderId
          orderPaymentStatus
          tableCode
          currentStatus
          restaurantId
          priority
          note
          user {
            id
            fullName
            email
            phone
          }
          items {
            _id
            dishId
            menuId
            categoryId
            name
            unit
            basePrice
            servingKey
            servingVariant {
              key
              name
              mode
              price
              sellQty
              sellUnit
            }
            modifiersPrice
            unitPrice
            lineSubtotal
            note
            priority
            quantity
            originalQuantity
            cancelledQuantity
            returnedQuantity
            voidRequests {
              requestId
              quantity
              reason
              status
              requestedBy
              requestedAt
              reviewedBy
              reviewedAt
              reviewNote
            }
            returnRequests {
              requestId
              quantity
              reason
              refundMode
              status
              requestedBy
              requestedAt
              reviewedBy
              reviewedAt
              reviewNote
            }
            weightGrams
            status
            station
            ingredientsSnapshot {
              ingredientId
              name
              quantity
              unit
              baseUnitQuantity
              costPerBaseUnit
              totalCost
            }
          }
          totals {
            subtotal
            discount
            discountReason
            voucherCode
            promotionId
            tax
            service
            shippingFee
            grandTotal
          }
          payment {
            method
            status
            paidAmount
            changeAmount
            currency
            requestedAt
            requestedBy
            paidAt
            paidBy
          }
          shipping {
            fullName
            phone
            address
            deliveryMethod
            deliveryTime
            scheduleDate
            scheduleTime
          }
          statusTimeline {
            status
            at
            note
            byUserId
          }
          customerInfo {
            name
            phone
            email
            note
            partySize
            timeTo
          }
          clientMeta
          orderType
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

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
    confirmIncomingOrder(input: $input) {
      order {
        id
        currentStatus
        updatedAt
      }
    }
  }
`;
const REJECT_INCOMING_ORDER = gql`
  mutation RejectIncomingOrder($input: RejectIncomingOrderInput!) {
    rejectIncomingOrder(input: $input) {
      order {
        id
        currentStatus
        updatedAt
      }
    }
  }
`;
const CREATE_TEMP_BILL_PRINT_JOB = gql`
  mutation CreateTemporaryBillPrintJob(
    $input: CreateTemporaryBillPrintJobInput!
  ) {
    createTemporaryBillPrintJob(input: $input) {
      ok
      message
    }
  }
`;

const REQUEST_ORDER_ITEM_VOID = gql`
  mutation ManagerRequestOrderItemVoid($input: RequestOrderItemVoidInput!) {
    requestOrderItemVoid(input: $input) {
      id
      restaurantId
      items {
        _id
        voidRequests {
          requestId
          quantity
          reason
          status
        }
      }
    }
  }
`;

const ACTIVE_ORDER_HIDDEN_STATUSES = new Set([
  "served",
  "completed",
  "cancelled",
  "failed",
]);
const PREP_ITEM_HIDDEN_STATUSES = new Set(["served", "cancelled", "returned"]);
const PREP_ITEM_ACTIVE_STATUSES = new Set([
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
]);

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const normalizeId = (value) => (value ? String(value) : null);
const normalizeTableCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
const normalizePrepStation = (value) => {
  const station = normalizeStatus(value);
  return ["kitchen", "bar"].includes(station) ? station : null;
};
const getItemStation = (item) =>
  normalizePrepStation(item?.station || item?.prepStation);
const isVisiblePrepItem = (item) =>
  Boolean(item) && !PREP_ITEM_HIDDEN_STATUSES.has(normalizeStatus(item?.status));
const matchesPrepStation = (item, stationMode) =>
  stationMode === "all" || getItemStation(item) === stationMode;

const isParentTableSession = (order) => order?.orderKind === "table_session";

const isPaidOrder = (order) => {
  const statuses = [order?.orderPaymentStatus, order?.payment?.status]
    .map((value) => normalizeStatus(value))
    .filter(Boolean);
  return statuses.includes("paid");
};

const resolveKitchenActionOrderId = (order, fallbackId = null) => {
  if (!order || isParentTableSession(order)) return null;
  return (
    normalizeId(order?.sourceOrderId || order?.actionOrderId || order?.id) ||
    normalizeId(fallbackId)
  );
};

const ORDER_STATUS_KPI_DEFS = [
  { id: "total", icon: "🧾", label: "Tổng đơn", tone: "neutral" },
  { id: "pending", icon: "⏳", label: "Chờ xử lý", tone: "warning" },
  { id: "preparing", icon: "👨‍🍳", label: "Đang chuẩn bị", tone: "accent" },
  { id: "completed", icon: "✅", label: "Hoàn thành", tone: "success" },
  { id: "cancelled", icon: "✕", label: "Đã hủy", tone: "danger" },
];
const KITCHEN_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "remote_staff_pending", label: "Từ xa" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "preparing", label: "Đang chuẩn bị" },
  { value: "ready", label: "Sẵn sàng" },
];
const PREP_STATION_OPTIONS = [
  { value: "kitchen", label: "Bếp chính", shortLabel: "Bếp" },
  { value: "bar", label: "Quầy bar", shortLabel: "Bar" },
  { value: "all", label: "Tổng hợp", shortLabel: "Tất cả" },
];
const PREP_STATION_META = {
  kitchen: {
    title: "MÀN HÌNH BẾP",
    emptyTitle: "Bếp chính chưa có món cần xử lý.",
    emptyCopy: "Món mới vào bếp sẽ được đồng bộ realtime tại đây.",
  },
  bar: {
    title: "MÀN HÌNH QUẦY BAR",
    emptyTitle: "Quầy bar chưa có món cần xử lý.",
    emptyCopy: "Đồ uống và món thuộc quầy bar sẽ được đồng bộ realtime tại đây.",
  },
  all: {
    title: "BẾP & QUẦY BAR",
    emptyTitle: "Chưa có món cần xử lý.",
    emptyCopy: "Bếp và quầy bar đang chờ món mới được đồng bộ realtime.",
  },
};
const CHIP_SIZE_OPTIONS = [
  { value: "s", label: "Nhỏ" },
  { value: "m", label: "Vừa" },
  { value: "l", label: "Lớn" },
];
const getBatchSessionKey = (order) => {
  const tableCode = normalizeTableCode(order?.tableCode);
  if (order?.orderType !== "dine_in" || !tableCode) return null;
  const sessionId =
    normalizeId(order?.rootOrderId) ||
    normalizeId(order?.parentOrderId) ||
    normalizeId(order?.id);
  if (!sessionId) return null;
  return `${normalizeId(order?.restaurantId) || ""}:${tableCode}:${sessionId}`;
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
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="om-summary__toggle"
        >
          <ChefHat size={18} />
          <span>Tóm tắt món cần làm ({dishes.length})</span>
          <span className="om-summary__arrow">{collapsed ? "▼" : "▲"}</span>
        </button>

        {!collapsed && hasHighlight && (
          <button
            type="button"
            onClick={onClearHighlight}
            className="om-summary__clear-btn"
          >
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
                type="button"
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

export const RejectOrderDialog = ({
  open,
  orderLabel,
  reason,
  error,
  loading = false,
  onReasonChange,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div
      className="om-reject-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="om-reject-dialog-title"
    >
      <button
        type="button"
        className="om-reject-dialog__backdrop"
        onClick={onCancel}
        aria-label="Đóng hộp thoại từ chối đơn"
      />
      <form
        className="om-reject-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm?.();
        }}
      >
        <div className="om-reject-dialog__header">
          <span className="om-reject-dialog__eyebrow">Từ chối đơn</span>
          <h2 id="om-reject-dialog-title">Nhập lý do từ chối đơn</h2>
          {orderLabel && (
            <p>
              Đơn <strong>{orderLabel}</strong> sẽ được gửi trạng thái từ chối.
            </p>
          )}
        </div>

        <label className="om-reject-dialog__field">
          <span>Lý do từ chối</span>
          <textarea
            value={reason}
            onChange={(event) => onReasonChange?.(event.target.value)}
            placeholder="Ví dụ: Món đã hết, khách đặt sai chi nhánh..."
            rows={4}
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "om-reject-dialog-error" : undefined}
          />
        </label>

        {error && (
          <p id="om-reject-dialog-error" className="om-reject-dialog__error">
            {error}
          </p>
        )}

        <div className="om-reject-dialog__actions">
          <button
            type="button"
            className="om-reject-dialog__cancel"
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="om-reject-dialog__confirm"
            disabled={loading}
          >
            {loading ? "Đang từ chối..." : "Xác nhận từ chối"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ---------------- Main Component ---------------- */
const OrderManagement = () => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [rejectDialog, setRejectDialog] = useState({
    open: false,
    orderId: null,
    reason: "",
    error: "",
    loading: false,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("oldest");

  const [focusMode, setFocusMode] = useState(false);
  const [stationMode, setStationMode] = useState("kitchen");
  const [highlightDishKey, setHighlightDishKey] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState([]);

  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };
  const {
    restaurantOptions: restaurantList,
    selectedRestaurantId,
    setSelectedRestaurantId,
  } = useManagerRestaurantSelection();
  const [
    loadOrders,
    { data: ordersData, loading: ordersLoading, error: ordersError },
  ] = useLazyQuery(ORDERS_BY_RESTAURANT_NOW, {
    notifyOnNetworkStatusChange: true,
  });
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [mutConfirmIncomingOrder] = useMutation(CONFIRM_INCOMING_ORDER);
  const [mutRejectIncomingOrder] = useMutation(REJECT_INCOMING_ORDER);
  const [mutCreateTempBillJob] = useMutation(CREATE_TEMP_BILL_PRINT_JOB);
  const [mutRequestOrderItemVoid] = useMutation(REQUEST_ORDER_ITEM_VOID);

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
        JSON.stringify({ timeSettings, chipSize, timeColors }),
      );
    } catch (e) {
      void e;
    }
  }, [timeSettings, chipSize, timeColors]);

  const {
    updateItemStatus,
    reviewOrderItemVoid,
    requestOrderItemReturn,
    reviewOrderItemReturn,
  } = useOrderManagement();

  const refetchOrders = useCallback(
    (fetchPolicy = "network-only") => {
      if (!selectedRestaurantId) return Promise.resolve();
      return loadOrders({
        variables: { restaurantId: selectedRestaurantId, limit: 100 },
        fetchPolicy,
      });
    },
    [loadOrders, selectedRestaurantId],
  );

  const orders = useMemo(() => {
    const nodes =
      ordersData?.ordersByRestaurantNow?.edges?.map((edge) => edge.node) || [];
    return nodes.map((order) => ({
      ...order,
      actionOrderId: resolveKitchenActionOrderId(order, order?.id),
    }));
  }, [ordersData]);

  useEffect(() => {
    setHiddenOrderIds([]);
  }, [selectedRestaurantId]);

  useEffect(() => {
    setHighlightDishKey(null);
    setHighlightedOrderIds([]);
  }, [stationMode]);

  useSocketOrder(selectedRestaurantId, {
    onAny: (evt) => {
      if (evt?.order?.tableCode) {
        showNotification(
          `Realtime: ${evt.type} (${evt.order.tableCode})`,
          "info",
        );
      }
      void refetchOrders();
    },
    onCustomerPaymentRequested: (evt) => {
      const label =
        evt?.tableCode ||
        evt?.trackingCode ||
        evt?.order?.trackingCode ||
        "không rõ bàn";
      showNotification(`Khách yêu cầu thanh toán (${label})`, "warning");
    },
    onCustomerStaffCallRequested: (evt) => {
      const label =
        evt?.tableCode ||
        evt?.trackingCode ||
        evt?.order?.trackingCode ||
        "không rõ bàn";
      const reason = evt?.message ? `: ${evt.message}` : "";
      showNotification(`Khách cần hỗ trợ (${label})${reason}`, "warning");
    },
  });

  useEffect(() => {
    void refetchOrders();
  }, [refetchOrders]);

  useEffect(() => {
    document.body.classList.toggle("order-kitchen-active", focusMode);

    if (!focusMode) {
      return () => {
        document.body.classList.remove("order-kitchen-active");
      };
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("order-kitchen-active");
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

  useEffect(() => {
    const onKey = (e) => {
      const tagName = (e.target?.tagName || "").toLowerCase();

      if (
        ["input", "textarea", "select"].includes(tagName) ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
        return;
      }

      if (e.key.toLowerCase() === "f") setFocusMode((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const activeOrders = useMemo(
    () =>
      (orders || []).filter((order) => {
        const currentStatus = normalizeStatus(order?.currentStatus);
        return (
          !isParentTableSession(order) &&
          !isPaidOrder(order) &&
          !ACTIVE_ORDER_HIDDEN_STATUSES.has(currentStatus) &&
          !hiddenOrderIds.includes(order.id)
        );
      }),
    [orders, hiddenOrderIds],
  );

  const stationQueueCounts = useMemo(() => {
    const counts = { kitchen: 0, bar: 0, all: 0 };
    activeOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (
          !isVisiblePrepItem(item) ||
          !PREP_ITEM_ACTIVE_STATUSES.has(normalizeStatus(item?.status))
        ) {
          return;
        }
        counts.all += 1;
        const station = getItemStation(item);
        if (station) counts[station] += 1;
      });
    });
    return counts;
  }, [activeOrders]);

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
    const statusOk = normalizeStatus(order.currentStatus) === "pending";
    const meta = order.clientMeta || {};
    const source = String(meta.source || meta.clientSource || "").toLowerCase();
    const channel = String(meta.channel || "").toLowerCase();
    const clientType = String(meta.clientType || "").toLowerCase();
    return (
      typeOk &&
      statusOk &&
      [source, channel, clientType].includes("staff_remote")
    );
  }, []);

  const filteredOrders = useMemo(() => {
    const raw = searchTerm || "";
    const q = normalizeText(raw);
    const endsWithSpace = /\s$/.test(raw);
    const singleToken = q && !q.includes(" ");

    const matchesStatus = (order) => {
      if (focusMode && statusFilter !== "remote_staff_pending") return true;
      if (statusFilter === "remote_staff_pending") {
        return isRemoteStaffPendingOrder(order);
      }
      return (
        !statusFilter || normalizeStatus(order.currentStatus) === statusFilter
      );
    };
    const matchesTableType = (order) =>
      !tableFilter || order.orderType === tableFilter;
    const matchesDate = (order) => {
      const created = order?.createdAt ? new Date(order.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) {
        return !dateFrom && !dateTo;
      }
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

    if (!q) {
      return activeOrders.filter(
        (order) =>
          matchesStatus(order) && matchesTableType(order) && matchesDate(order),
      );
    }

    if (endsWithSpace && singleToken) {
      return activeOrders.filter((order) => {
        const table = normalizeText(order.tableCode);
        const code = normalizeText(order.orderCode);
        const id = normalizeText(order.id);
        return (
          (table === q || code === q || id === q || id.endsWith(q)) &&
          matchesStatus(order) &&
          matchesTableType(order) &&
          matchesDate(order)
        );
      });
    }

    const tokens = q.split(" ");
    return activeOrders.filter((order) => {
      const combined = [
        order.id,
        order.orderCode,
        order.tableCode,
        order.user?.fullName,
        order.note,
        order.user?.phone,
        ...(order.items || []).map((item) => item.name),
      ]
        .map(normalizeText)
        .join(" ");
      return (
        tokens.every((token) => combined.includes(token)) &&
        matchesStatus(order) &&
        matchesTableType(order) &&
        matchesDate(order)
      );
    });
  }, [
    activeOrders,
    searchTerm,
    statusFilter,
    tableFilter,
    dateFrom,
    dateTo,
    isRemoteStaffPendingOrder,
    focusMode,
  ]);

  const orderedFilteredOrders = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return sortBy === "newest" ? tb - ta : ta - tb;
      return String(a.orderCode || a.id || "").localeCompare(
        String(b.orderCode || b.id || ""),
      );
    });
    return sorted;
  }, [filteredOrders, sortBy]);

  const batchIndexByOrderId = useMemo(() => {
    const map = new Map();
    const groups = new Map();

    for (const order of activeOrders || []) {
      const groupKey = getBatchSessionKey(order);
      if (!groupKey) continue;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(order);
    }

    for (const ordersInSession of groups.values()) {
      const sorted = [...ordersInSession].sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        const codeCompare = String(a?.orderCode || "").localeCompare(
          String(b?.orderCode || ""),
        );
        if (codeCompare !== 0) return codeCompare;
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

      sorted.forEach((order, index) => {
        if (order?.id) {
          map.set(order.id, index + 1);
        }
      });
    }

    return map;
  }, [activeOrders]);

  const displayOrders = useMemo(
    () =>
      orderedFilteredOrders
        .map((order) => {
          const matchesFocusItemStatus = (item) => {
            if (!statusFilter) return true;
            if (statusFilter === "remote_staff_pending") {
              return isRemoteStaffPendingOrder(order);
            }
            return normalizeStatus(item?.status) === statusFilter;
          };
          const items = focusMode
            ? (order.items || []).filter(
                (item) =>
                  isVisiblePrepItem(item) &&
                  matchesPrepStation(item, stationMode) &&
                  matchesFocusItemStatus(item),
              )
            : order.items;
          if (focusMode && items.length === 0) return null;
          return {
            ...order,
            items,
            actionOrderId: resolveKitchenActionOrderId(order, order.id),
            batchDisplayIndex: batchIndexByOrderId.get(order.id) || null,
          };
        })
        .filter(Boolean),
    [
      orderedFilteredOrders,
      batchIndexByOrderId,
      focusMode,
      stationMode,
      statusFilter,
      isRemoteStaffPendingOrder,
    ],
  );

  const focusItemCount = useMemo(
    () =>
      displayOrders.reduce(
        (total, order) => total + (order.items || []).length,
        0,
      ),
    [displayOrders],
  );
  const activeStationMeta = PREP_STATION_META[stationMode];

  const handleExportCsv = useCallback(() => {
    const rows = orderedFilteredOrders.map((order) => ({
      orderCode: order.orderCode || order.id,
      tableCode: order.tableCode || "",
      orderType: order.orderType || "",
      status: order.currentStatus || "",
      paymentStatus: order.payment?.status || order.orderPaymentStatus || "",
      paymentMethod: order.payment?.method || "",
      subtotal: order.totals?.subtotal || 0,
      discount: order.totals?.discount || 0,
      voucherCode: order.totals?.voucherCode || "",
      promotionId: order.totals?.promotionId || "",
      discountReason: order.totals?.discountReason || "",
      shippingFee: order.totals?.shippingFee || 0,
      total: order.totals?.grandTotal || 0,
      createdAt: order.createdAt || "",
    }));
    const header = [
      "orderCode",
      "tableCode",
      "orderType",
      "status",
      "paymentStatus",
      "paymentMethod",
      "subtotal",
      "discount",
      "voucherCode",
      "promotionId",
      "discountReason",
      "shippingFee",
      "total",
      "createdAt",
    ];
    const csvRows = rows.map((row) =>
      header
        .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
        .join(","),
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
    displayOrders.forEach((order) => {
      const createdAtMs = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();
      (order.items || []).forEach((item) => {
        if (!isVisiblePrepItem(item)) return;
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
        if (createdAtMs < summary.earliestCreatedAt) {
          summary.earliestCreatedAt = createdAtMs;
        }
        if (unit === "kg" && qty > 0) summary.portions.push(qty);
        else if (qty > 0) summary.totalCount += qty;
        if (order.id) summary.orderIds.add(order.id);
      });
    });

    return Array.from(map.values())
      .map((dish) => ({ ...dish, orderIds: Array.from(dish.orderIds) }))
      .sort((a, b) => {
        const ta = a.earliestCreatedAt;
        const tb = b.earliestCreatedAt;
        if (ta !== tb) return ta - tb;
        return (
          b.orderIds.length - a.orderIds.length ||
          (b.totalCount || 0) - (a.totalCount || 0) ||
          a.name.localeCompare(b.name, "vi")
        );
      });
  }, [displayOrders]);

  const stats = useMemo(() => {
    const countByStatus = (statuses) =>
      orders.filter((order) =>
        statuses.includes(normalizeStatus(order.currentStatus)),
      ).length;

    return {
      total: orders.length,
      pending: countByStatus(["pending"]),
      preparing: countByStatus(["preparing"]),
      completed: countByStatus(["completed"]),
      cancelled: countByStatus(["cancelled"]),
    };
  }, [orders]);

  const mergeSelectedOrderMetadata = useCallback(
    (updatedOrder, fallbackOrder = null) => {
      const source = fallbackOrder || selectedOrder || null;
      return {
        ...(updatedOrder || {}),
        actionOrderId:
          resolveKitchenActionOrderId(source, updatedOrder?.id) ||
          updatedOrder?.id,
        batchDisplayIndex:
          source?.batchDisplayIndex ??
          batchIndexByOrderId.get(updatedOrder?.id) ??
          null,
      };
    },
    [batchIndexByOrderId, selectedOrder],
  );

  const handleUpdateStatus = useCallback(
    async (orderId, status, extraNote = "") => {
      const order = displayOrders.find(
        (item) => item.id === orderId || item.actionOrderId === orderId,
      );
      const targetOrderId = resolveKitchenActionOrderId(order, orderId);
      if (!targetOrderId || !status) return;
      try {
        const { data } = await mutUpdateOrderStatus({
          variables: {
            input: {
              id: targetOrderId,
              restaurantId: selectedRestaurantId,
              status,
              note: extraNote,
            },
          },
        });
        const updated = data?.updateOrderStatus;
        setSelectedOrder((prev) => {
          if (!prev) return prev;
          if (
            prev?.id !== order?.id &&
            prev?.actionOrderId !== targetOrderId &&
            prev?.id !== targetOrderId
          ) {
            return prev;
          }
          return {
            ...prev,
            currentStatus: status,
            updatedAt: updated?.updatedAt,
          };
        });
        if (ACTIVE_ORDER_HIDDEN_STATUSES.has(normalizeStatus(status))) {
          const hiddenId = order?.id || targetOrderId;
          setHiddenOrderIds((prev) =>
            prev.includes(hiddenId) ? prev : [...prev, hiddenId],
          );
        }
        await refetchOrders();
      } catch (err) {
        console.error(err);
        showNotification(err?.message || "Lỗi cập nhật", "error");
      }
    },
    [
      displayOrders,
      mutUpdateOrderStatus,
      refetchOrders,
      selectedRestaurantId,
      showNotification,
    ],
  );

  const handleUpdateItemStatus = useCallback(
    (orderId, itemKey, nextStatus) => {
      const order = displayOrders.find(
        (item) => item.id === orderId || item.actionOrderId === orderId,
      );
      const targetOrderId =
        resolveKitchenActionOrderId(order, orderId) || normalizeId(orderId);
      if (!targetOrderId) return;
      return updateItemStatus({
        orderId: targetOrderId,
        itemKey,
        status: nextStatus,
        restaurantId: selectedRestaurantId,
        tableCode: order?.tableCode,
        itemsSnapshot: order?.items,
        afterSuccess: async (updated) => {
          if (updated) {
            setSelectedOrder(mergeSelectedOrderMetadata(updated, order));
          }
          await refetchOrders();
        },
      });
    },
    [
      displayOrders,
      mergeSelectedOrderMetadata,
      refetchOrders,
      selectedRestaurantId,
      updateItemStatus,
    ],
  );

  const handleDishClick = useCallback((dish) => {
    if (!dish) return;
    setHighlightDishKey(dish.key);
    setHighlightedOrderIds(dish.orderIds || []);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const cards = Array.from(document.querySelectorAll("[data-order-id]"));
        const matched = cards.find((el) =>
          (dish.orderIds || []).includes(el.getAttribute("data-order-id")),
        );
        if (matched) {
          matched.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
  }, []);

  const handleClearHighlight = useCallback(() => {
    setHighlightDishKey(null);
    setHighlightedOrderIds([]);
  }, []);

  const rejectDialogOrder = useMemo(
    () =>
      displayOrders.find(
        (item) =>
          item.id === rejectDialog.orderId ||
          item.actionOrderId === rejectDialog.orderId,
      ) || null,
    [displayOrders, rejectDialog.orderId],
  );

  const handleRejectOrder = useCallback((orderId) => {
    setRejectDialog({
      open: true,
      orderId,
      reason: "",
      error: "",
      loading: false,
    });
  }, []);

  const handleCloseRejectDialog = useCallback(() => {
    setRejectDialog({
      open: false,
      orderId: null,
      reason: "",
      error: "",
      loading: false,
    });
  }, []);

  const handleRejectReasonChange = useCallback((reason) => {
    setRejectDialog((prev) => ({ ...prev, reason, error: "" }));
  }, []);

  const handleConfirmRejectOrder = useCallback(async () => {
    const reason = rejectDialog.reason.trim();
    if (!reason) {
      setRejectDialog((prev) => ({
        ...prev,
        error: "Vui lòng nhập lý do từ chối đơn.",
      }));
      return;
    }

    const order = rejectDialogOrder;
    const targetOrderId = resolveKitchenActionOrderId(
      order,
      rejectDialog.orderId,
    );
    if (!targetOrderId) return;

    setRejectDialog((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await mutRejectIncomingOrder({
        variables: {
          input: {
            id: targetOrderId,
            restaurantId: selectedRestaurantId,
            reason,
          },
        },
      });
      await refetchOrders();
      showNotification("Đã từ chối đơn từ xa", "warning");
      handleCloseRejectDialog();
    } catch (err) {
      setRejectDialog((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Không thể từ chối đơn. Vui lòng thử lại.",
      }));
    }
  }, [
    handleCloseRejectDialog,
    mutRejectIncomingOrder,
    refetchOrders,
    rejectDialog.orderId,
    rejectDialog.reason,
    rejectDialogOrder,
    selectedRestaurantId,
    showNotification,
  ]);

  const handleConfirmRemoteOrder = useCallback(
    async (orderId) => {
      const order = displayOrders.find(
        (item) => item.id === orderId || item.actionOrderId === orderId,
      );
      const targetOrderId = resolveKitchenActionOrderId(order, orderId);
      await mutConfirmIncomingOrder({
        variables: {
          input: { id: targetOrderId, restaurantId: selectedRestaurantId },
        },
      });
      await refetchOrders();
    },
    [
      displayOrders,
      mutConfirmIncomingOrder,
      refetchOrders,
      selectedRestaurantId,
    ],
  );

  const handleCreateTemporaryBill = useCallback(
    async (order) => {
      const targetOrderId = resolveKitchenActionOrderId(order, order?.id);
      if (!targetOrderId || !selectedRestaurantId) return;
      await mutCreateTempBillJob({
        variables: {
          input: { orderId: targetOrderId, restaurantId: selectedRestaurantId },
        },
      });
      showNotification("Đã tạo print job in tạm tính.", "success");
    },
    [mutCreateTempBillJob, selectedRestaurantId, showNotification],
  );

  const handleReviewItemVoid = useCallback(
    async (payload) => {
      const updatedOrder = await reviewOrderItemVoid(payload);
      if (updatedOrder) {
        setSelectedOrder((prev) =>
          mergeSelectedOrderMetadata(updatedOrder, prev),
        );
        await refetchOrders();
      }
      return updatedOrder;
    },
    [mergeSelectedOrderMetadata, refetchOrders, reviewOrderItemVoid],
  );

  const handleCancelItemImmediately = useCallback(
    async ({ orderId, orderItemId, quantity, reason }) => {
      try {
        const requestResult = await mutRequestOrderItemVoid({
          variables: {
            input: { orderId, orderItemId, quantity, reason },
          },
        });
        const requestedOrder = requestResult?.data?.requestOrderItemVoid;
        const requestedItem = (requestedOrder?.items || []).find(
          (item) => String(item?._id) === String(orderItemId),
        );
        const pendingRequest = [...(requestedItem?.voidRequests || [])]
          .reverse()
          .find((request) => request?.status === "pending");
        if (!pendingRequest?.requestId) {
          throw new Error("Không tìm thấy yêu cầu vừa tạo.");
        }

        const updatedOrder = await reviewOrderItemVoid({
          orderId,
          orderItemId,
          requestId: pendingRequest.requestId,
          approve: true,
          note: `Hủy ngay tại màn hình bếp/POS: ${reason}`,
        });
        if (updatedOrder) {
          setSelectedOrder((previous) =>
            mergeSelectedOrderMetadata(updatedOrder, previous),
          );
          await refetchOrders();
        }
        showNotification("Đã hủy món và cập nhật lại hóa đơn.", "success");
        return updatedOrder;
      } catch {
        showNotification(
          "Chưa thể hủy món. Kiểm tra quyền hủy đơn rồi thử lại.",
          "error",
        );
        throw new Error(
          "Chưa thể hủy món. Kiểm tra quyền hủy đơn rồi thử lại.",
        );
      }
    },
    [
      mergeSelectedOrderMetadata,
      mutRequestOrderItemVoid,
      refetchOrders,
      reviewOrderItemVoid,
      showNotification,
    ],
  );

  const handleRequestItemReturn = useCallback(
    async (payload) => {
      const updatedOrder = await requestOrderItemReturn(payload);
      if (updatedOrder) {
        setSelectedOrder((prev) =>
          mergeSelectedOrderMetadata(updatedOrder, prev),
        );
        await refetchOrders();
      }
      return updatedOrder;
    },
    [mergeSelectedOrderMetadata, refetchOrders, requestOrderItemReturn],
  );

  const handleReviewItemReturn = useCallback(
    async (payload) => {
      const updatedOrder = await reviewOrderItemReturn(payload);
      if (updatedOrder) {
        setSelectedOrder((prev) =>
          mergeSelectedOrderMetadata(updatedOrder, prev),
        );
        await refetchOrders();
      }
      return updatedOrder;
    },
    [mergeSelectedOrderMetadata, refetchOrders, reviewOrderItemReturn],
  );

  return (
    <div
      className={`om-container ${focusMode ? "om-container--focus" : ""}`}
      data-station={focusMode ? stationMode : undefined}
    >
      <div className="om-wrapper">
        {!focusMode ? (
          <ManagementPageHeader
            eyebrow="ORDER MANAGER"
            title="Quản lý đơn hàng"
            subtitle="Xử lý đơn tại chỗ, mang đi, giao hàng và thanh toán trong ca làm."
            icon="🍽️"
            statsPlacement="none"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Tìm mã đơn, khách, bàn, món..."
            selectedRestaurant={selectedRestaurantId}
            onRestaurantChange={setSelectedRestaurantId}
            restaurantList={restaurantList}
            quickActions={[
              {
                icon: "🕘",
                label: "Lịch sử",
                onClick: () => setShowHistory(true),
              },
              {
                icon: "⚙️",
                label: "Cài đặt",
                onClick: () => setIsSettingsOpen(true),
              },
            ]}
            primaryAction={{
              icon: focusMode ? "🡼" : "🡾",
              label: focusMode ? "Thoát chế độ Bếp" : "Chế độ Bếp",
              onClick: () => setFocusMode(!focusMode),
            }}
          />
        ) : (
          <header className="om-header">
            <div>
              <div className="om-header__focus-title">
                <span className="om-badge-live">LIVE</span>
                <h1>{activeStationMeta.title}</h1>
              </div>
              <div className="om-header__meta" aria-live="polite">
                <span>{focusItemCount.toLocaleString("vi-VN")} món</span>
                <span>•</span>
                <span>{displayOrders.length.toLocaleString("vi-VN")} đơn</span>
                <span>•</span>
                <span>
                  {sortBy === "oldest"
                    ? "Ưu tiên đơn cũ nhất trước"
                    : "Ưu tiên đơn mới nhất trước"}
                </span>
              </div>
            </div>
            <div className="om-header__actions">
              <button
                type="button"
                onClick={() => setFocusMode(false)}
                className="om-btn-focus om-btn-focus--active"
              >
                <Minimize2 size={18} />
                <span>Thoát màn hình chế biến</span>
              </button>
            </div>
          </header>
        )}

        {!focusMode && (
          <section className="om-kpi-panel" aria-label="Tổng quan đơn hàng">
            {ORDER_STATUS_KPI_DEFS.map((item) => (
              <article
                key={item.id}
                className={`om-kpi-card om-kpi-card--${item.tone}`}
              >
                <span className="om-kpi-card__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="om-kpi-card__body">
                  <span className="om-kpi-card__label">{item.label}</span>
                  <strong className="om-kpi-card__value">
                    {stats[item.id].toLocaleString("vi-VN")}
                  </strong>
                </div>
              </article>
            ))}
          </section>
        )}

        <section
          className={`om-toolbar ${focusMode ? "om-toolbar--focus" : ""}`}
          aria-label={focusMode ? "Điều khiển màn hình chế biến" : "Bộ lọc đơn hàng"}
        >
          <div className="om-toolbar__inner">
            <div className="om-toolbar__filters">
              {focusMode && (
                <div
                  className="om-station-switcher"
                  role="group"
                  aria-label="Khu vực chế biến"
                >
                  {PREP_STATION_OPTIONS.map((option) => {
                    const isActive = stationMode === option.value;
                    const count = stationQueueCounts[option.value] || 0;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`om-station-switcher__btn ${
                          isActive ? "om-station-switcher__btn--active" : ""
                        }`}
                        aria-pressed={isActive}
                        aria-label={`${option.label}, ${count} món cần xử lý`}
                        onClick={() => setStationMode(option.value)}
                      >
                        <span>{option.shortLabel}</span>
                        <strong>{count}</strong>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="om-filter-group">
                {focusMode ? (
                  <div className="om-field om-field--kitchen-status">
                    <span className="om-field__label">Trạng thái món</span>
                    <div
                      className="om-status-segmented"
                      role="group"
                      aria-label="Trạng thái món"
                    >
                      {KITCHEN_STATUS_FILTER_OPTIONS.map((option) => (
                        <button
                          key={option.value || "all"}
                          type="button"
                          className={`om-status-segmented__btn ${
                            statusFilter === option.value
                              ? "om-status-segmented__btn--active"
                              : ""
                          }`}
                          onClick={() => setStatusFilter(option.value)}
                          aria-pressed={statusFilter === option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className="om-field">
                    <span className="om-field__label">Trạng thái đơn</span>
                    <span className="om-select-wrapper">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="om-select-input"
                        aria-label="Trạng thái đơn"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Chờ xác nhận</option>
                        <option value="remote_staff_pending">
                          Đơn từ xa chờ xác nhận
                        </option>
                        <option value="confirmed">Đã xác nhận</option>
                        <option value="preparing">Đang chuẩn bị</option>
                        <option value="ready">Sẵn sàng</option>
                      </select>
                      <Filter size={16} className="om-select-icon-left" />
                      <ChevronDown size={14} className="om-select-icon-right" />
                    </span>
                  </label>
                )}

                {!focusMode && (
                  <label className="om-field">
                    <span className="om-field__label">Loại đơn</span>
                    <span className="om-select-wrapper">
                      <select
                        value={tableFilter}
                        onChange={(e) => setTableFilter(e.target.value)}
                        className="om-select-input"
                        aria-label="Loại đơn"
                      >
                        <option value="">Tất cả loại</option>
                        <option value="dine_in">Tại bàn</option>
                        <option value="takeaway">Mang về</option>
                        <option value="delivery">Giao hàng</option>
                      </select>
                      <ChevronDown size={14} className="om-select-icon-right" />
                    </span>
                  </label>
                )}
                {!focusMode && (
                  <>
                    <label className="om-field">
                      <span className="om-field__label">Từ ngày</span>
                      <span className="om-select-wrapper">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="om-select-input"
                          aria-label="Từ ngày"
                        />
                      </span>
                    </label>
                    <label className="om-field">
                      <span className="om-field__label">Đến ngày</span>
                      <span className="om-select-wrapper">
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="om-select-input"
                          aria-label="Đến ngày"
                        />
                      </span>
                    </label>
                    <label className="om-field">
                      <span className="om-field__label">Sắp xếp</span>
                      <span className="om-select-wrapper">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="om-select-input"
                          aria-label="Sắp xếp đơn hàng"
                        >
                          <option value="oldest">Cũ nhất trước</option>
                          <option value="newest">Mới nhất trước</option>
                        </select>
                        <ChevronDown
                          size={14}
                          className="om-select-icon-right"
                        />
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="om-toolbar__actions">
              {focusMode ? (
                <div className="om-size-control om-size-control--segmented">
                  <span>Cỡ thẻ:</span>
                  <div
                    className="om-size-segmented"
                    role="group"
                    aria-label="Cỡ thẻ món"
                  >
                    {CHIP_SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`om-size-segmented__btn ${
                          chipSize === option.value
                            ? "om-size-segmented__btn--active"
                            : ""
                        }`}
                        onClick={() => setChipSize(option.value)}
                        aria-pressed={chipSize === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="om-btn-outline"
                  onClick={handleExportCsv}
                >
                  <Download size={18} />
                  <span>Xuất BC</span>
                </button>
              )}

              {!focusMode && (
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(true)}
                  disabled={!selectedRestaurantId}
                  className="om-btn-primary"
                >
                  <Plus size={18} />
                  <span>Đơn mới</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {focusMode && dishSummaries.length > 0 && (
          <DishSummaryPanel
            dishes={dishSummaries}
            activeKey={highlightDishKey}
            onDishClick={handleDishClick}
            onClearHighlight={handleClearHighlight}
            size={chipSize}
          />
        )}

        <section
          className="om-content"
          aria-label={focusMode ? "Danh sách món theo khu vực" : "Danh sách đơn hàng"}
          aria-live="polite"
        >
          {ordersLoading ? (
            <div
              className="om-skeleton-grid"
              aria-label="Đang tải dữ liệu đơn hàng"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <article className="om-skeleton-card" key={index}>
                  <div className="om-skeleton-card__top" />
                  <div className="om-skeleton-card__line om-skeleton-card__line--wide" />
                  <div className="om-skeleton-card__line" />
                  <div className="om-skeleton-card__items">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              ))}
            </div>
          ) : ordersError ? (
            <div className="om-state om-state--error" role="alert">
              <AlertTriangle size={48} />
              <h3>Không tải được đơn hàng</h3>
              <p>{ordersError.message}</p>
              {selectedRestaurantId && (
                <button
                  type="button"
                  className="om-state__retry"
                  onClick={() => void refetchOrders()}
                >
                  Thử tải lại
                </button>
              )}
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="om-state om-state--empty">
              <div className="om-state__icon-bg">
                <CheckCircle size={40} />
              </div>
              <h3>
                {focusMode
                  ? activeStationMeta.emptyTitle
                  : "Chưa có đơn hàng trong bộ lọc hiện tại."}
              </h3>
              <p>
                {focusMode
                  ? activeStationMeta.emptyCopy
                  : "Điều chỉnh bộ lọc hoặc chờ đơn mới được đồng bộ realtime."}
              </p>
            </div>
          ) : (
            <div className="om-grid">
              {displayOrders.map((order) => (
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
                      if (
                        status === "confirmed" &&
                        isRemoteStaffPendingOrder(order)
                      ) {
                        return handleConfirmRemoteOrder(orderId);
                      }
                      return handleUpdateStatus(orderId, status);
                    }}
                    onRejectOrder={handleRejectOrder}
                    isRemoteStaffPending={isRemoteStaffPendingOrder(order)}
                    onViewOrder={() => setSelectedOrder(order)}
                    onViewItem={(data) => setSelectedItem(data)}
                    isFocusMode={focusMode}
                    onQuickItemDone={handleUpdateItemStatus}
                    onMessageCustomer={(currentOrder) => {
                      const threadId = currentOrder?.clientMeta?.chatThreadId;
                      if (!threadId) {
                        return showNotification(
                          "Chưa có luồng chat cho đơn này",
                          "warning",
                        );
                      }
                      window.location.href = `/staff?tab=contacts&threadId=${threadId}`;
                    }}
                    timeThresholds={timeSettings}
                    timeColors={timeColors}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {showNewOrderModal && (
          <NewOrderModal
            isOpen={showNewOrderModal}
            onClose={() => setShowNewOrderModal(false)}
            restaurantId={selectedRestaurantId}
            onSuccess={async () => {
              setShowNewOrderModal(false);
              await refetchOrders();
            }}
          />
        )}

        <RejectOrderDialog
          open={rejectDialog.open}
          orderLabel={
            rejectDialogOrder?.orderCode ||
            rejectDialogOrder?.tableCode ||
            rejectDialog.orderId
          }
          reason={rejectDialog.reason}
          error={rejectDialog.error}
          loading={rejectDialog.loading}
          onReasonChange={handleRejectReasonChange}
          onCancel={handleCloseRejectDialog}
          onConfirm={handleConfirmRejectOrder}
        />

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
            onReviewItemVoid={handleReviewItemVoid}
            onCancelItem={handleCancelItemImmediately}
            onRequestItemReturn={handleRequestItemReturn}
            onReviewItemReturn={handleReviewItemReturn}
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
            onViewOrder={(order) => setSelectedOrder(order)}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
