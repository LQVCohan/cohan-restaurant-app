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
  Download,
} from "lucide-react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";

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

const ACTIVE_ORDER_HIDDEN_STATUSES = new Set([
  "served",
  "completed",
  "cancelled",
  "failed",
]);

const useRestaurant = () => {
  const { restaurants } = useContext(AuthContext);
  return { restaurantList: restaurants || [] };
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => (value ? String(value) : null);
const normalizeTableCode = (value) => String(value || "").trim().toUpperCase();

const isParentTableSession = (order) => order?.orderKind === "table_session";

const isPaidOrder = (order) => {
  const statuses = [order?.orderPaymentStatus, order?.payment?.status]
    .map((value) => normalizeStatus(value))
    .filter(Boolean);
  return statuses.includes("paid");
};

const resolveKitchenActionOrderId = (order, fallbackId = null) => {
  if (!order || isParentTableSession(order)) return null;
  return normalizeId(order?.sourceOrderId || order?.actionOrderId || order?.id) ||
    normalizeId(fallbackId);
};

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
  const [loadOrders, { data: ordersData, loading: ordersLoading, error: ordersError }] =
    useLazyQuery(ORDERS_BY_RESTAURANT_NOW, {
      notifyOnNetworkStatusChange: true,
    });
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [mutConfirmIncomingOrder] = useMutation(CONFIRM_INCOMING_ORDER);
  const [mutRejectIncomingOrder] = useMutation(REJECT_INCOMING_ORDER);
  const [mutCreateTempBillJob] = useMutation(CREATE_TEMP_BILL_PRINT_JOB);

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
    const nodes = ordersData?.ordersByRestaurantNow?.edges?.map((edge) => edge.node) || [];
    return nodes.map((order) => ({
      ...order,
      actionOrderId: resolveKitchenActionOrderId(order, order?.id),
    }));
  }, [ordersData]);

  useEffect(() => {
    if (restaurantList.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantList[0].id);
    }
  }, [restaurantList, selectedRestaurantId]);

  useEffect(() => {
    setHiddenOrderIds([]);
  }, [selectedRestaurantId]);

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
      const label = evt?.tableCode || evt?.trackingCode || evt?.order?.trackingCode || "không rõ bàn";
      showNotification(`Khách yêu cầu thanh toán (${label})`, "warning");
    },
    onCustomerStaffCallRequested: (evt) => {
      const label = evt?.tableCode || evt?.trackingCode || evt?.order?.trackingCode || "không rõ bàn";
      const reason = evt?.message ? `: ${evt.message}` : "";
      showNotification(`Khách cần hỗ trợ (${label})${reason}`, "warning");
    },
  });

  useEffect(() => {
    void refetchOrders();
  }, [refetchOrders]);

  useEffect(() => {
    const onKey = (e) => {
      if (
        ["input", "textarea", "select"].includes(
          (e.target?.tagName || "").toLowerCase(),
        ) ||
        e.target?.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === "f") setFocusMode((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      if (statusFilter === "remote_staff_pending") {
        return isRemoteStaffPendingOrder(order);
      }
      return !statusFilter || normalizeStatus(order.currentStatus) === statusFilter;
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
      orderedFilteredOrders.map((order) => ({
        ...order,
        actionOrderId: resolveKitchenActionOrderId(order, order.id),
        batchDisplayIndex: batchIndexByOrderId.get(order.id) || null,
      })),
    [orderedFilteredOrders, batchIndexByOrderId],
  );

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
  }, [activeOrders]);

  const stats = useMemo(
    () => ({
      total: activeOrders.length,
      pending: activeOrders.filter(
        (order) => !ACTIVE_ORDER_HIDDEN_STATUSES.has(normalizeStatus(order.currentStatus)),
      ).length,
      preparing: activeOrders.filter(
        (order) => normalizeStatus(order.currentStatus) === "preparing",
      ).length,
      completed: 0,
    }),
    [activeOrders],
  );

  const mergeSelectedOrderMetadata = useCallback(
    (updatedOrder, fallbackOrder = null) => {
      const source = fallbackOrder || selectedOrder || null;
      return {
        ...(updatedOrder || {}),
        actionOrderId:
          resolveKitchenActionOrderId(source, updatedOrder?.id) || updatedOrder?.id,
        batchDisplayIndex:
          source?.batchDisplayIndex ?? batchIndexByOrderId.get(updatedOrder?.id) ?? null,
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
    [displayOrders, mutUpdateOrderStatus, refetchOrders, selectedRestaurantId, showNotification],
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
    [displayOrders, mergeSelectedOrderMetadata, refetchOrders, selectedRestaurantId, updateItemStatus],
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

  const handleRejectOrder = useCallback(
    async (orderId) => {
      const reason = window.prompt("Nhập lý do từ chối đơn:", "");
      if (reason == null) return;
      const order = displayOrders.find(
        (item) => item.id === orderId || item.actionOrderId === orderId,
      );
      const targetOrderId = resolveKitchenActionOrderId(order, orderId);
      await mutRejectIncomingOrder({
        variables: {
          input: { id: targetOrderId, restaurantId: selectedRestaurantId, reason },
        },
      });
      await refetchOrders();
      showNotification("Đã từ chối đơn từ xa", "warning");
    },
    [displayOrders, mutRejectIncomingOrder, refetchOrders, selectedRestaurantId, showNotification],
  );

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
    [displayOrders, mutConfirmIncomingOrder, refetchOrders, selectedRestaurantId],
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
        setSelectedOrder((prev) => mergeSelectedOrderMetadata(updatedOrder, prev));
        await refetchOrders();
      }
      return updatedOrder;
    },
    [mergeSelectedOrderMetadata, refetchOrders, reviewOrderItemVoid],
  );

  const handleRequestItemReturn = useCallback(
    async (payload) => {
      const updatedOrder = await requestOrderItemReturn(payload);
      if (updatedOrder) {
        setSelectedOrder((prev) => mergeSelectedOrderMetadata(updatedOrder, prev));
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
        setSelectedOrder((prev) => mergeSelectedOrderMetadata(updatedOrder, prev));
        await refetchOrders();
      }
      return updatedOrder;
    },
    [mergeSelectedOrderMetadata, refetchOrders, reviewOrderItemReturn],
  );

  return (
    <div className={`om-container ${focusMode ? "om-container--focus" : ""}`}>
      <div className="om-wrapper">
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

        {!focusMode && (
          <div className="om-stats-grid">
            <StatsCard
              icon={<ShoppingBag />}
              title="Đợt gọi món"
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

        <div className={`om-toolbar ${focusMode ? "om-toolbar--focus" : ""}`}>
          <div className="om-toolbar__inner">
            <div className="om-toolbar__filters">
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

              <div className="om-filter-group">
                <div className="om-select-wrapper">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="om-select-input"
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

        {focusMode && dishSummaries.length > 0 && (
          <DishSummaryPanel
            dishes={dishSummaries}
            activeKey={highlightDishKey}
            onDishClick={handleDishClick}
            onClearHighlight={handleClearHighlight}
            size={chipSize}
          />
        )}

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
        </div>

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
