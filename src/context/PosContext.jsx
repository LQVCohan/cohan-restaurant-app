/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";

import useMenuManagement from "../hooks/useMenuManagement";
import useFloorManagement from "../hooks/useFloorManagement";
import useTableManagement from "../hooks/useTableManagement";
import useOrderManagement from "../hooks/useOrderManagement";
import { useNotification } from "../hooks/useNotification";
import useSocketOrder from "@/hooks/useSocketOrder";
import { PRINT_STATIONS } from "@/utils/printStations";

const OFF_PREMISE_TYPES = new Set(["delivery", "takeaway"]);
const hasMeaningfulOffPremiseDraft = (payload) => {
  const items = Array.isArray(payload?.currentOrder)
    ? payload.currentOrder
    : [];
  return items.length > 0;
};
export const isValidOffPremiseSessionForType = ({
  type,
  currentOrderType,
  currentTable,
  currentOrderCode,
  force = false,
}) => {
  if (force) return false;
  if (!OFF_PREMISE_TYPES.has(type)) return false;
  const expectedPrefix = type === "delivery" ? "SHIP-" : "TAKE-";
  return (
    currentOrderType === type &&
    currentTable?.isVirtual === true &&
    currentTable?.type === type &&
    typeof currentOrderCode === "string" &&
    currentOrderCode.startsWith(expectedPrefix)
  );
};
const Q_POS_PAYMENT_REQUESTS = gql`
  query PosPaymentRequests($restaurantId: ID!, $limit: Int) {
    ordersByRestaurantNow(restaurantId: $restaurantId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          tableCode
          restaurantId
          orderType
          currentStatus
          payment {
            status
            requestedAt
            requestedBy
            paidAt
            paidBy
          }
          totals {
            grandTotal
          }
          customerInfo {
            name
            phone
            email
            note
            partySize
            timeTo
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
        }
      }
    }
  }
`;
const Q_PRINT_SETTINGS = gql`
  query PrintSettings($restaurantId: ID!) {
    printSettings(restaurantId: $restaurantId) {
      id
      restaurantId
      printers
      stations
    }
  }
`;

const M_UPSERT_PRINT_SETTINGS = gql`
  mutation UpsertPrintSettings($input: UpsertPrintSettingInput!) {
    upsertPrintSettings(input: $input) {
      id
      restaurantId
      printers
      stations
    }
  }
`;

const PosContext = createContext(undefined);

const sanitizeStationsByPrinters = (stations, printersList) => {
  const printerIds = new Set(
    (Array.isArray(printersList) ? printersList : [])
      .map((p) => p?.id)
      .filter(Boolean),
  );
  const fallback = PRINT_STATIONS.reduce((acc, st) => {
    acc[st.id] = [];
    return acc;
  }, {});
  Object.entries(stations || {}).forEach(([stationId, ids]) => {
    fallback[stationId] = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : []).filter((id) => printerIds.has(id)),
      ),
    );
  });
  return fallback;
};

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within a <PosProvider>.");
  return ctx;
}

export default function PosProvider({
  children,
  restaurantId,
  initialFloorId = null,
  initialFloorLevel = null,
}) {
  const { showNotification } = useNotification();

  // --- BASE STATES ---
  const [currentFloor, setCurrentFloor] = useState(1);
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrderType, setCurrentOrderType] = useState("dine_in");
  const [tableOrders, setTableOrders] = useState({});
  const [currentOrder, setCurrentOrder] = useState([]);

  // ✅ NEW: currentOrderCode tách khỏi currentTable.code
  const [currentOrderCode, setCurrentOrderCode] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRequests, setPaymentRequests] = useState([]);
  const mapOrderToPaymentRequest = useCallback((order) => {
    const orderId = order?.id || order?._id;

    return {
      orderId,
      orderCode: order?.orderCode || null,
      tableId: order?.tableId || null,
      tableCode: order?.tableCode || null,
      orderType: order?.orderType || "dine_in",
      payment: order?.payment || null,
      totals: order?.totals || null,
      requestedAt: order?.payment?.requestedAt || null,
      customer: order?.customerInfo || order?.user || null,
      shipping: order?.shipping || null,
    };
  }, []);
  const [printers, setPrinters] = useState({});
  const [selectedPrintType, setSelectedPrintType] = useState("kitchen");
  const [printQueue, setPrintQueue] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [printStations, setPrintStations] = useState({});
  const printSettingsHydratingRef = useRef(false);
  const printSettingsDebounceRef = useRef(null);
  const previousRestaurantIdRef = useRef(restaurantId || null);
  const [loadPosPaymentRequests] = useLazyQuery(Q_POS_PAYMENT_REQUESTS, {
    fetchPolicy: "network-only",
    onCompleted: (data) => {
      const orders = (data?.ordersByRestaurantNow?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean);

      const requests = orders
        .filter((order) => order?.payment?.status === "payment_requested")
        .map(mapOrderToPaymentRequest)
        .filter((req) => req.orderId);

      setPaymentRequests(requests);
    },
  });
  useEffect(() => {
    if (!restaurantId) return;

    loadPosPaymentRequests({
      variables: {
        restaurantId,
        limit: 100,
      },
    }).catch(() => {});
  }, [restaurantId, loadPosPaymentRequests]);
  const [loadPrintSettings] = useLazyQuery(Q_PRINT_SETTINGS, {
    fetchPolicy: "network-only",
    onCompleted: (data) => {
      const settings = data?.printSettings;
      const printersList = Array.isArray(settings?.printers)
        ? settings.printers
        : [];
      const printerMap = printersList.reduce((acc, printer) => {
        if (!printer?.id) return acc;
        acc[printer.id] = printer;
        return acc;
      }, {});
      const safeStations = sanitizeStationsByPrinters(
        settings?.stations,
        printersList,
      );
      printSettingsHydratingRef.current = true;
      setPrinters(printerMap);
      setPrintStations(safeStations);
      setTimeout(() => {
        printSettingsHydratingRef.current = false;
      }, 0);
    },
  });

  const [upsertPrintSettings] = useMutation(M_UPSERT_PRINT_SETTINGS);
  const clearTableSessionState = useCallback(
    (table) => {
      const tableId = table?.id || table?._id || null;
      const tableCode = table?.code || null;

      skipDraftAutosaveRef.current = true;
      lastDraftKeyRef.current = null;

      setCurrentOrder([]);
      setCurrentOrderCode(null);
      setCurrentOrderId(null);
      setCurrentTable(null);

      setTableOrders((prev) => {
        const next = { ...(prev || {}) };

        if (tableId) {
          delete next[tableId];
          delete next[String(tableId)];
        }

        if (tableCode) {
          delete next[tableCode];
          delete next[String(tableCode).toUpperCase()];
        }

        return next;
      });

      try {
        if (tableId) {
          localStorage.removeItem(`pos_draft_table_${restaurantId}_${tableId}`);
        }
        if (tableCode) {
          localStorage.removeItem(
            `pos_draft_table_${restaurantId}_${tableCode}`,
          );
          localStorage.removeItem(
            `pos_draft_table_${restaurantId}_${String(tableCode).toUpperCase()}`,
          );
        }
      } catch {}
    },
    [restaurantId],
  );
  useEffect(() => {
    if (!restaurantId) return;
    loadPrintSettings({ variables: { restaurantId } });
  }, [restaurantId, loadPrintSettings]);

  useEffect(() => {
    if (!restaurantId) return;
    if (printSettingsHydratingRef.current) return;
    if (printSettingsDebounceRef.current) {
      clearTimeout(printSettingsDebounceRef.current);
    }
    const list = Object.values(printers || {});
    const payload = {
      restaurantId,
      printers: list,
      stations: sanitizeStationsByPrinters(printStations, list),
    };
    printSettingsDebounceRef.current = setTimeout(() => {
      upsertPrintSettings({ variables: { input: payload } }).catch(() => {});
    }, 400);
  }, [restaurantId, printers, printStations]);
  const getDefaultShippingInfo = useCallback(
    (type) => ({
      fullName: "",
      phone: "",
      email: "",
      address: "",
      note: "",
      deliveryMethod: type === "takeaway" ? "pickup_at_store" : "ship_now",
      deliveryTime: "",
      scheduleDate: "",
      scheduleTime: "",
    }),
    [],
  );
  // 🔹 Shipping + Customer cho off-premise (delivery/takeaway)
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    deliveryMethod: "ship_now",
    deliveryTime: "",
    scheduleDate: "",
    scheduleTime: "",
  });

  const [deliveryCustomer, setDeliveryCustomer] = useState(null);
  const skipDraftAutosaveRef = useRef(false);
  const lastDraftKeyRef = useRef(null);
  const hasCustomerLike = useCallback((customer, shipping) => {
    return Boolean(
      customer?.id ||
      customer?.name ||
      customer?.fullName ||
      customer?.phone ||
      customer?.email ||
      shipping?.fullName ||
      shipping?.phone ||
      shipping?.email ||
      shipping?.address,
    );
  }, []);
  // --- FLOORS ---
  const {
    floors,
    floorsLoading,
    floorsError,
    refetchFloors,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
  } = useFloorManagement({ restaurantId, initialFloorId, initialFloorLevel });

  const activeFloorId = useMemo(
    () => (activeLevel != null ? getIdFromLevel(activeLevel) : null),
    [activeLevel, getIdFromLevel],
  );

  const setActiveFloorId = useCallback(
    (idOrNull) => {
      if (!idOrNull) return setActiveLevel(null);
      const lvl = getLevelFromId(idOrNull);
      setActiveLevel(lvl ?? null);
    },
    [getLevelFromId, setActiveLevel],
  );

  const getTimeSlotForNow = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 22) return "dinner";
    return "late_night";
  }, []);

  const [autoTimeSlot, setAutoTimeSlot] = useState(getTimeSlotForNow);

  useEffect(() => {
    const timer = setInterval(
      () => {
        setAutoTimeSlot(getTimeSlotForNow());
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [getTimeSlotForNow]);

  // --- MENU ---
  const {
    menus,
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
    itemsWithPrice,
  } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: autoTimeSlot,
    pageSize: 100,
  });

  // --- TABLES ---
  const {
    tables: allTables,
    refetchTables,
    updateTable,
    setTableStatus,
    mergeTables,
    splitTables,
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // --- SOCKET ---
  useSocketOrder(restaurantId, {
    onCreated: (order) => {
      showNotification(`🆕 Đơn mới: ${order.orderCode}`, "info");
      refetchTables?.();
    },
    onUpdated: (order) => {
      const orderId = order?.id || order?._id;
      const paymentStatus = order?.payment?.status;
      const requestedAt = order?.payment?.requestedAt;

      const isPaidOrCompleted =
        paymentStatus === "paid" || order?.currentStatus === "completed";

      if (isPaidOrCompleted && orderId) {
        setPaymentRequests((prev) =>
          prev.filter((r) => String(r.orderId) !== String(orderId)),
        );
        return;
      }

      const isPaymentRequested = paymentStatus === "payment_requested";

      if (isPaymentRequested && orderId) {
        const nextRequest = mapOrderToPaymentRequest(order);

        let shouldNotify = false;

        setPaymentRequests((prev) => {
          const idx = prev.findIndex(
            (r) => String(r.orderId) === String(orderId),
          );

          if (idx === -1) {
            shouldNotify = true;
            return [nextRequest, ...prev];
          }

          const existing = prev[idx];

          if ((existing?.requestedAt || null) !== (requestedAt || null)) {
            shouldNotify = true;
          }

          const copy = [...prev];
          copy[idx] = { ...existing, ...nextRequest };
          return copy;
        });

        if (shouldNotify) {
          showNotification(
            `💳 Khách gọi thanh toán: ${
              order?.tableCode || order?.orderCode || orderId
            }`,
            "warning",
          );
        }

        refetchTables?.();
        return;
      }

      showNotification(`♻️ Cập nhật đơn ${order.orderCode}`, "success");
    },
    onStatusChanged: (order) => {
      showNotification(
        `🔁 ${order.orderCode} → ${order.currentStatus}`,
        "info",
      );
    },
    onCancelled: (order) => {
      showNotification(`❌ Đơn ${order.orderCode} đã bị hủy`, "warning");
      refetchTables?.();
    },
  });

  const clearPaymentRequest = useCallback((orderId) => {
    if (!orderId) return;
    setPaymentRequests((prev) => prev.filter((r) => r.orderId !== orderId));
  }, []);

  // --- TABLE FILTERS ---
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const tables = useMemo(() => {
    let list = allTables || [];
    if (activeLevel != null) {
      list = list.filter((t) => Number(t.floorLevel) === Number(activeLevel));
    }
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (typeFilter && typeFilter !== "all") {
      list = list.filter(
        (t) => (t.type || "").toLowerCase() === typeFilter.toLowerCase(),
      );
    }

    const rawQ = tableSearch ?? "";
    const hasTrailingSpace = /\s$/.test(rawQ);
    const qNoTrail = rawQ.replace(/\s+$/, "").toLowerCase();

    if (rawQ.length > 0) {
      list = list.filter((t) => {
        const code = (t.code || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        const type = (t.type || "").toLowerCase();
        const tags = Array.isArray(t.tags)
          ? t.tags.join(" ").toLowerCase()
          : "";

        if (hasTrailingSpace) return code === qNoTrail;
        if (qNoTrail && code.startsWith(qNoTrail)) return true;
        return (
          status.includes(qNoTrail) ||
          type.includes(qNoTrail) ||
          tags.includes(qNoTrail)
        );
      });
    }
    return list;
  }, [allTables, activeLevel, statusFilter, typeFilter, tableSearch]);

  // --- ORDER MANAGEMENT HOOK ---
  const {
    addToOrder,
    updateItemQty,
    removeItem,
    clearAll,
    saveOrder: rawSaveOrder,
    fetchOrderByTable,
    fetchOrderById,
    orderById,
    totals,
    orderNote,
    setOrderNote,
    updateOrderCustomerByCode,
    loadGroupsForTable,
    loadOrdersNow,
    ordersNow,
    ordersLoading,
    preparePayment,
    checkoutOrder,
  } = useOrderManagement({
    currentOrder,
    setCurrentOrder,
    tableOrders,
    currentTable,
    setTableOrders,
    restaurantId,
    currentOrderType,
    deliveryCustomer,
    shippingInfo,
    currentOrderCode,
    setCurrentOrderCode,
    currentOrderId,
    setCurrentOrderId,
  });

  useEffect(() => {
    const previousRestaurantId = previousRestaurantIdRef.current;
    if (String(previousRestaurantId || "") === String(restaurantId || "")) return;

    previousRestaurantIdRef.current = restaurantId || null;
    skipDraftAutosaveRef.current = true;
    lastDraftKeyRef.current = null;
    if (printSettingsDebounceRef.current) clearTimeout(printSettingsDebounceRef.current);
    printSettingsHydratingRef.current = true;

    setCurrentOrder([]);
    setCurrentOrderCode(null);
    setCurrentOrderId(null);
    setCurrentTable(null);
    setCurrentOrderType("dine_in");
    setTableOrders({});
    setPaymentRequests([]);
    setMenuItems([]);
    setCurrentCategory("all");
    setSearchTerm("");
    setPaymentMethod("cash");
    setDeliveryCustomer(null);
    setOrderNote?.("");
    setShippingInfo(getDefaultShippingInfo("delivery"));
    setPrinters({});
    setPrintStations({});
    setPrintQueue([]);
    setSelectedPrinter(null);
    setActiveFloorId(null);
    setTableSearch("");
    setStatusFilter("all");
    setTypeFilter("all");

    setTimeout(() => {
      printSettingsHydratingRef.current = false;
    }, 0);
  }, [restaurantId, getDefaultShippingInfo, setActiveFloorId, setOrderNote]);

  // --- [UTILITY] GENERATE VIRTUAL CODE ---
  const generateVirtualCode = useCallback((prefix) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const randomPart = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    return `${prefix}-${yyyy}${mm}${dd}-${randomPart}`;
  }, []);

  const getOffPremiseDraftKey = useCallback(
    (type) => {
      if (!restaurantId) return null;
      if (type !== "delivery" && type !== "takeaway") return null;
      return `pos_offpremise_draft:${restaurantId}:${type}`;
    },
    [restaurantId],
  );

  const clearOffPremiseDraft = useCallback(
    (type) => {
      const key = getOffPremiseDraftKey(type);
      if (!key) return;
      try {
        localStorage.removeItem(key);
      } catch {}
    },
    [getOffPremiseDraftKey],
  );

  const saveCurrentOffPremiseDraft = useCallback(() => {
    if (currentOrderType !== "delivery" && currentOrderType !== "takeaway")
      return;
    const key = getOffPremiseDraftKey(currentOrderType);
    if (!key) return;
    const draftItems = getUnsavedOffPremiseDraftItems(currentOrder);

    if (!draftItems.length) {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }

    const payload = {
      version: 1,
      savedAt: Date.now(),
      orderType: currentOrderType,
      currentOrderCode,
      currentOrder: draftItems,
      deliveryCustomer,
      shippingInfo,
      orderNote,
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }, [
    currentOrderType,
    getOffPremiseDraftKey,
    currentOrderCode,
    currentOrder,
    deliveryCustomer,
    shippingInfo,
    orderNote,
  ]);

  const ensureOffPremiseSession = useCallback(
    (type, options = {}) => {
      if (type !== "delivery" && type !== "takeaway") return null;

      const isValidExistingSession = isValidOffPremiseSessionForType({
        type,
        currentOrderType,
        currentTable,
        currentOrderCode,
        force: options.force,
      });

      if (isValidExistingSession) return currentOrderCode;

      const nextCode = generateVirtualCode(
        type === "delivery" ? "SHIP" : "TAKE",
      );
      setCurrentOrderType(type);
      setCurrentOrderCode(nextCode);
      setCurrentTable({
        id: null,
        code: type === "delivery" ? "DELIVERY" : "TAKEAWAY",
        name: type === "delivery" ? "Delivery" : "Takeaway",
        status: "occupied",
        type,
        restaurantId,
        isVirtual: true,
      });
      return nextCode;
    },
    [
      currentOrderCode,
      currentOrderType,
      currentTable,
      generateVirtualCode,
      restaurantId,
    ],
  );
  const createNewOffPremiseOrder = useCallback(
    (type, options = {}) => {
      if (type !== "delivery" && type !== "takeaway") return null;

      const preserveCustomer = options.preserveCustomer !== false;
      const nextCode = generateVirtualCode(
        type === "delivery" ? "SHIP" : "TAKE",
      );

      clearOffPremiseDraft?.(type);

      setCurrentOrderType(type);
      setCurrentOrderCode(nextCode);
      setCurrentOrderId(null);
      setCurrentOrder([]);
      setTableOrders({});
      setOrderNote?.("");

      setCurrentTable({
        id: null,
        code: type === "delivery" ? "DELIVERY" : "TAKEAWAY",
        name: type === "delivery" ? "Delivery" : "Takeaway",
        status: "occupied",
        type,
        restaurantId,
        isVirtual: true,
      });

      if (!preserveCustomer) {
        setDeliveryCustomer(null);
        setShippingInfo(getDefaultShippingInfo(type));
      } else {
        setShippingInfo((prev) => ({
          ...getDefaultShippingInfo(type),
          ...(prev || {}),
          deliveryMethod: type === "takeaway" ? "pickup_at_store" : "ship_now",
        }));
      }

      return nextCode;
    },
    [
      generateVirtualCode,
      clearOffPremiseDraft,
      restaurantId,
      getDefaultShippingInfo,
      setOrderNote,
    ],
  );
  const restoreOffPremiseDraft = useCallback(
    (type) => {
      const key = getOffPremiseDraftKey(type);
      if (!key) return false;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const p = JSON.parse(raw);
        if (!hasMeaningfulOffPremiseDraft(p)) {
          localStorage.removeItem(key);
          return false;
        }
        setCurrentOrderType(type);
        const nextCode =
          p?.currentOrderCode ||
          generateVirtualCode(type === "delivery" ? "SHIP" : "TAKE");

        setCurrentOrderCode(nextCode);
        setCurrentOrder(Array.isArray(p?.currentOrder) ? p.currentOrder : []);
        setDeliveryCustomer(p?.deliveryCustomer || null);
        setShippingInfo({
          ...getDefaultShippingInfo(type),
          ...(p?.shippingInfo || {}),
        });
        setOrderNote?.(p?.orderNote || "");
        setCurrentTable({
          id: null,
          code: type === "delivery" ? "DELIVERY" : "TAKEAWAY",
          name: type === "delivery" ? "Delivery" : "Takeaway",
          status: "occupied",
          type,
          restaurantId,
          isVirtual: true,
        });
        return true;
      } catch {
        return false;
      }
    },
    [
      getOffPremiseDraftKey,
      restaurantId,
      setOrderNote,
      generateVirtualCode,
      getDefaultShippingInfo,
    ],
  );

  const switchOffPremiseMode = useCallback(
    (type) => {
      if (type !== "delivery" && type !== "takeaway") return;
      if (currentOrderType === type) return;

      const previousCustomer = deliveryCustomer;
      const previousShipping = shippingInfo;
      const previousOrder = currentOrder;
      const previousNote = orderNote;

      saveCurrentOffPremiseDraft();

      const restored = restoreOffPremiseDraft(type);

      if (!restored) {
        ensureOffPremiseSession(type, { force: true });

        setCurrentOrder([]);
        setCurrentOrderId(null);
        setTableOrders({});
        setDeliveryCustomer(previousCustomer || null);
        setShippingInfo({
          ...getDefaultShippingInfo(type),
          ...(hasCustomerLike(previousCustomer, previousShipping)
            ? previousShipping
            : {}),
          deliveryMethod: type === "takeaway" ? "pickup_at_store" : "ship_now",
        });
        setOrderNote?.("");
      }
    },
    [
      currentOrderType,
      deliveryCustomer,
      shippingInfo,
      currentOrder,
      orderNote,
      saveCurrentOffPremiseDraft,
      restoreOffPremiseDraft,
      ensureOffPremiseSession,
      getDefaultShippingInfo,
      hasCustomerLike,
      setOrderNote,
    ],
  );
  const isUnsavedOrderItem = (item) => {
    if (!item) return false;
    if (item.isNew) return true;
    if (!item.isExisting && Number(item.quantity || 0) > 0) return true;
    return false;
  };

  const getUnsavedOffPremiseDraftItems = (items) =>
    (Array.isArray(items) ? items : []).filter(isUnsavedOrderItem);

  const hasMeaningfulOffPremiseDraft = (payload) => {
    return getUnsavedOffPremiseDraftItems(payload?.currentOrder).length > 0;
  };
  const getDraftKeyForTable = useCallback(
    (tableId) => {
      if (!tableId) return null;
      return `pos_draft_table_${restaurantId}_${tableId}`;
    },
    [restaurantId],
  );

  // ===== Draft key (autosave FE) =====
  const getDraftKey = useCallback(() => {
    if (
      currentOrderType === "dine_in" &&
      (currentTable?.id || currentTable?.code)
    ) {
      const tableKey = currentTable?.id || currentTable?.code;
      return `pos_draft_table_${restaurantId}_${tableKey}`;
    }

    return null;
  }, [currentOrderType, currentTable?.id, currentTable?.code, restaurantId]);

  // ===== Auto-save only isNew (FE) =====
  useEffect(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;
    if (key !== lastDraftKeyRef.current) {
      lastDraftKeyRef.current = key;
      skipDraftAutosaveRef.current = false;
      return;
    }
    if (skipDraftAutosaveRef.current) {
      skipDraftAutosaveRef.current = false;
      return;
    }
    try {
      const draftItems = (currentOrder || []).filter((i) => i?.isNew);
      if (draftItems.length === 0) {
        localStorage.removeItem(key);
        return;
      }
      const payload = {
        version: 1,
        savedAt: Date.now(),
        currentOrderType,
        currentOrderCode,
        tableId,
        tableCode: currentTable?.code || null,
        items: draftItems,
        shippingInfo:
          currentOrderType === "delivery" ? shippingInfo : undefined,
        deliveryCustomer:
          currentOrderType === "delivery" || currentOrderType === "takeaway"
            ? deliveryCustomer
            : undefined,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }, [
    currentOrder,
    currentOrderType,
    currentOrderCode,
    currentTable?.id,
    currentTable?.code,
    shippingInfo,
    deliveryCustomer,
    getDraftKey,
    getDraftKeyForTable,
  ]);

  // ===== Restore draft when context changes =====
  useEffect(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const collected = Array.isArray(payload?.items) ? payload.items : [];
      if (collected.length) {
        setCurrentOrder((prev) => {
          const prevExisting = (prev || []).filter((i) => i?.isExisting);
          return [...prevExisting, ...collected];
        });
      }
      if (
        (currentOrderType === "delivery" || currentOrderType === "takeaway") &&
        payload?.deliveryCustomer
      ) {
        setDeliveryCustomer(payload.deliveryCustomer);
      }

      if (currentOrderType === "delivery" && payload?.shippingInfo) {
        setShippingInfo((s) => ({ ...s, ...payload.shippingInfo }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentOrderCode,
    currentOrderType,
    currentTable?.id,
    currentTable?.code,
    getDraftKey,
    getDraftKeyForTable,
  ]);

  const clearDraftStorage = useCallback(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [currentOrderType, currentTable?.id, getDraftKey, getDraftKeyForTable]);

  // --- [NEW] START DELIVERY ORDER ---
  const startDeliveryOrder = useCallback(
    (options = {}) => {
      ensureOffPremiseSession("delivery");

      setCurrentTable({
        id: null,
        code: "DELIVERY",
        name: "Delivery",
        status: "occupied",
        type: "delivery",
        restaurantId,
        isVirtual: true,
      });

      if (options.reset === true) {
        setCurrentOrder([]);
        setShippingInfo(getDefaultShippingInfo("delivery"));
        setDeliveryCustomer(null);
        setOrderNote?.("");
        return;
      }

      setShippingInfo((prev) => ({
        ...getDefaultShippingInfo("delivery"),
        ...(prev || {}),
        deliveryMethod: prev?.deliveryMethod || "ship_now",
      }));
    },
    [
      ensureOffPremiseSession,
      restaurantId,
      getDefaultShippingInfo,
      setOrderNote,
    ],
  );

  // --- [NEW] START TAKEAWAY ORDER ---
  const startTakeawayOrder = useCallback(
    (options = {}) => {
      ensureOffPremiseSession("takeaway");

      setCurrentTable({
        id: null,
        code: "TAKEAWAY",
        name: "Takeaway",
        status: "occupied",
        type: "takeaway",
        restaurantId,
        isVirtual: true,
      });

      if (options.reset === true) {
        setCurrentOrder([]);
        setShippingInfo(getDefaultShippingInfo("takeaway"));
        setDeliveryCustomer(null);
        setOrderNote?.("");
        return;
      }

      setShippingInfo((prev) => ({
        ...getDefaultShippingInfo("takeaway"),
        ...(prev || {}),
        deliveryMethod: "pickup_at_store",
      }));
    },
    [
      ensureOffPremiseSession,
      restaurantId,
      getDefaultShippingInfo,
      setOrderNote,
    ],
  );
  const resetPosOrderSession = useCallback(
    (nextType = "dine_in") => {
      skipDraftAutosaveRef.current = true;
      lastDraftKeyRef.current = null;

      setCurrentOrderType(nextType);
      setCurrentOrderCode(null);
      setCurrentOrderId(null);
      setCurrentTable(null);
      setCurrentOrder([]);
      setTableOrders({});
      setDeliveryCustomer(null);
      setOrderNote?.("");

      setShippingInfo({
        fullName: "",
        phone: "",
        email: "",
        address: "",
        note: "",
        deliveryMethod:
          nextType === "takeaway" ? "pickup_at_store" : "ship_now",
        deliveryTime: "",
        scheduleDate: "",
        scheduleTime: "",
      });
    },
    [setOrderNote],
  );
  // ===== helper: detect isNew items =====
  const hasNewDraftItems = useCallback(() => {
    return (currentOrder || []).some((i) => i?.isNew);
  }, [currentOrder]);

  // --- SELECT TABLE LOGIC (DINE-IN) ---
  const selectTableForOrder = useCallback(
    async (code, capacity, options = {}) => {
      const table =
        (allTables || []).find(
          (t) => (t.code || "").toLowerCase() === code.toLowerCase(),
        ) || null;
      if (!table) return;

      const statusTable = table?.status || "available";

      if (statusTable === "offline") {
        showNotification(`Bàn ${code} đang ngoại tuyến.`, "error");
        return;
      }
      if (statusTable === "cleaning") {
        showNotification(`Bàn ${code} đang dọn dẹp.`, "warning");
        return;
      }

      const switchingToDifferentTable =
        currentOrderType === "dine_in" &&
        currentTable?.code &&
        currentTable.code !== code;

      if (switchingToDifferentTable || !currentTable?.code) {
        skipDraftAutosaveRef.current = true;
      }

      // giữ món mới để append lại sau khi load BE group
      const draftNew = (currentOrder || []).filter((i) => i?.isNew);
      const preserveDraftItems =
        options?.preserveDraftItems !== false &&
        switchingToDifferentTable &&
        currentTable?.code &&
        draftNew.length > 0;

      if (preserveDraftItems) {
        const tableId = currentTable?.id || null;
        const oldKey = getDraftKeyForTable(tableId);
        if (oldKey) {
          try {
            localStorage.setItem(
              oldKey,
              JSON.stringify({
                version: 1,
                savedAt: Date.now(),
                currentOrderType,
                currentOrderCode,
                tableId,
                tableCode: currentTable.code,
                items: draftNew,
              }),
            );
          } catch {}
        }
        skipDraftAutosaveRef.current = true;
        setCurrentOrder((prev) => (prev || []).filter((i) => i?.isExisting));
      }

      let groupsForTable = [];
      try {
        groupsForTable =
          (await loadGroupsForTable({ restaurantId, tableCode: code })) || [];
      } catch (e) {
        console.warn(e);
      }

      const hasOrders =
        Array.isArray(groupsForTable) && groupsForTable.length > 0;

      // chọn bàn + orderCode từ BE nếu có
      const serverOrderCode = hasOrders ? groupsForTable[0]?.orderCode : null;

      setCurrentTable({
        id: table?.id,
        code,
        capacity,
        status: hasOrders ? "occupied" : statusTable,
        restaurantId,
        isVirtual: false,
      });

      setCurrentOrderType("dine_in");
      setCurrentOrderCode(serverOrderCode || null);

      // sau khi loadGroupsForTable hook đã setCurrentOrder thành items existing,
      // ta append món isNew lại (nếu có)
      if (draftNew.length && !preserveDraftItems) {
        setCurrentOrder((prev) => {
          const prevArr = Array.isArray(prev) ? prev : [];
          const existingPart = prevArr.filter((i) => i?.isExisting);
          return [...existingPart, ...draftNew];
        });
      }

      if (hasOrders) {
        if (
          (statusTable === "available" || statusTable === "reserved") &&
          table?.id
        ) {
          try {
            await setTableStatus({ id: table.id, status: "occupied" });
          } catch {}
        }
        return;
      }

      if (!hasOrders && statusTable === "available") {
        showNotification(`Đã chọn bàn ${code}.`, "success");
        return;
      }

      showNotification(`Bàn ${code} đang được đặt.`, "info");
    },
    [
      allTables,
      currentOrderType,
      currentTable?.code,
      currentTable?.id,
      currentOrder,
      restaurantId,
      showNotification,
      getDraftKeyForTable,
      currentOrderCode,
      loadGroupsForTable,
      setTableStatus,
    ],
  );

  const loadPaymentRequestToPOS = useCallback(
    async (request) => {
      if (!request)
        return { success: false, message: "Thiếu request thanh toán." };
      const tableCode = request?.tableCode || null;
      const isDineIn = (request?.orderType || "dine_in") === "dine_in";

      if (isDineIn && tableCode) {
        await selectTableForOrder(tableCode, request?.table?.capacity || 0, {
          preserveDraftItems: false,
        });
        return { success: true };
      }

      const orderId = request?.orderId;
      if (!orderId)
        return { success: false, message: "Thiếu orderId để tải đơn." };
      const fetched = await fetchOrderById?.({ id: orderId, restaurantId });
      const order = fetched?.order || fetched || null;
      if (!order)
        return { success: false, message: "Không tải được đơn thanh toán." };

      setCurrentOrderType(order.orderType || request?.orderType || "takeaway");
      setCurrentOrderCode(order.orderCode || request?.orderCode || null);
      setCurrentOrderId(order.id || request?.orderId || null);
      if (order.orderType === "delivery" || order.orderType === "takeaway") {
        setCurrentTable({
          id: null,
          code: order.orderType === "delivery" ? "DELIVERY" : "TAKEAWAY",
          name: order.orderType === "delivery" ? "Delivery" : "Takeaway",
          status: "occupied",
          type: order.orderType,
          restaurantId,
          isVirtual: true,
        });
      }
      const mappedItems = (order.items || []).map((it, idx) => ({
        ...it,
        orderId: order.id,
        orderCode: order.orderCode,
        _lineId: it._id || `${it.dishId || "dish"}-${idx}`,
        isExisting: true,
        isNew: false,
      }));
      setCurrentOrder(mappedItems);
      return { success: true, order };
    },
    [fetchOrderById, restaurantId, selectTableForOrder],
  );

  const filteredMenu = useMemo(() => {
    const q = (searchTerm || "").toLowerCase().trim();
    const byCat = (i) =>
      currentCategory === "all" || (i.category || "main") === currentCategory;
    const bySearch = (i) =>
      !q ||
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q);
    return (itemsWithPrice || []).filter((i) => byCat(i) && bySearch(i));
  }, [itemsWithPrice, currentCategory, searchTerm]);

  // ===== save wrapper: validate FE rules =====
  const saveOrderSafe = useCallback(
    async (opts = {}) => {
      // không lưu order rỗng
      if (!Array.isArray(currentOrder) || currentOrder.length === 0) {
        return { success: false, message: "Chưa có món ăn nào trong đơn." };
      }

      // dine-in bắt buộc chọn bàn
      if (currentOrderType === "dine_in" && !currentTable?.code) {
        return { success: false, message: "Vui lòng chọn bàn trước khi lưu." };
      }

      // delivery: bắt buộc có địa chỉ (giữ nguyên rule)
      if (currentOrderType === "delivery") {
        const addr = (shippingInfo?.address || "").trim();
        if (!addr) {
          return { success: false, message: "Đơn giao đi cần địa chỉ." };
        }
      }

      const res = await rawSaveOrder({
        ...opts,
        restaurantId,
      });

      // nếu server trả orderCode thì sync lại currentOrderCode (không đụng tableCode)
      const savedOrderCode =
        res?.data?.orderCode || res?.data?.order?.orderCode;
      if (res?.success && savedOrderCode) {
        setCurrentOrderCode(savedOrderCode);
      }

      if (
        res?.success &&
        currentOrderType === "dine_in" &&
        currentTable?.id &&
        !currentTable?.isVirtual
      ) {
        try {
          await setTableStatus({ id: currentTable.id, status: "occupied" });
        } catch {}
        setCurrentTable((prev) =>
          prev ? { ...prev, status: "occupied" } : prev,
        );
      }

      // nếu lưu xong (thành công) và bạn muốn clear draft FE:
      // (mình KHÔNG auto clear ở đây để tránh mất draft khi BE chưa hoàn thiện)
      // clearDraftStorage();

      return res;
    },
    [
      rawSaveOrder,
      restaurantId,
      currentOrder,
      currentOrderType,
      currentTable?.code,
      currentTable?.id,
      currentTable?.isVirtual,
      shippingInfo?.address,
      setCurrentTable,
      setTableStatus,
      setCurrentOrderCode,
    ],
  );

  const value = useMemo(
    () => ({
      restaurantId,
      resetPosOrderSession,
      switchOffPremiseMode,
      ensureOffPremiseSession,
      createNewOffPremiseOrder,
      clearOffPremiseDraft,
      saveCurrentOffPremiseDraft,
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      setActiveLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      setActiveFloorId,

      tables,
      refetchTables,
      updateTable,
      fetchTableByCode,
      clearTableSessionState,
      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      setTableStatus,
      mergeTables,
      splitTables,

      currentFloor,
      setCurrentFloor,

      currentTable,
      setCurrentTable,

      currentOrderType,
      setCurrentOrderType,

      // ✅ expose orderCode
      currentOrderCode,
      setCurrentOrderCode,

      currentOrderId,
      setCurrentOrderId,

      currentOrder,
      setCurrentOrder,

      tableOrders,
      setTableOrders,

      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,

      shippingInfo,
      setShippingInfo,
      deliveryCustomer,
      setDeliveryCustomer,

      addToOrder,
      updateItemQty,
      removeItem,

      saveOrder: saveOrderSafe,
      clearOrder: clearAll || (() => setCurrentOrder([])),

      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,

      fetchOrderByTable,
      fetchOrderById,
      orderById,
      loadOrdersNow,
      ordersNow,
      ordersLoading,

      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
      filteredMenu,

      paymentMethod,
      setPaymentMethod,
      printers,
      setPrinters,
      printStations,
      setPrintStations,
      selectedPrintType,
      setSelectedPrintType,
      printQueue,
      setPrintQueue,
      selectedPrinter,
      setSelectedPrinter,

      finalTotals: totals,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      preparePayment,
      checkoutOrder,
      paymentRequests,
      clearPaymentRequest,
      loadPaymentRequestToPOS,

      // FE helpers
      hasNewDraftItems,
      clearDraftStorage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurantId,
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      setActiveFloorId,

      tables,
      refetchTables,
      updateTable,
      fetchTableByCode,
      createNewOffPremiseOrder,
      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      setTableStatus,
      mergeTables,
      splitTables,

      currentFloor,
      setCurrentFloor,
      currentTable,
      setCurrentTable,
      currentOrderType,
      setCurrentOrderType,

      currentOrderCode,
      setCurrentOrderCode,

      currentOrder,
      setCurrentOrder,

      tableOrders,
      setTableOrders,

      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,

      shippingInfo,
      setShippingInfo,
      deliveryCustomer,
      setDeliveryCustomer,

      addToOrder,
      updateItemQty,
      removeItem,

      saveOrderSafe,
      clearAll,

      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,

      fetchOrderByTable,
      fetchOrderById,
      orderById,
      loadOrdersNow,
      ordersNow,
      ordersLoading,

      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
      filteredMenu,

      paymentMethod,
      setPaymentMethod,
      printers,
      setPrinters,
      printStations,
      setPrintStations,
      selectedPrintType,
      setSelectedPrintType,
      printQueue,
      setPrintQueue,
      selectedPrinter,
      setSelectedPrinter,

      totals,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      preparePayment,
      checkoutOrder,
      paymentRequests,
      clearPaymentRequest,
      loadPaymentRequestToPOS,

      hasNewDraftItems,
      clearDraftStorage,
      currentOrderId,
      setCurrentOrderId,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
