import React, {
  useState,
  useMemo,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import {
  Search,
  Grid,
  Coffee,
  MessageSquare,
  UserCircle,
  ShoppingCart,
  Bell,
  Star,
  X,
  AlertCircle,
} from "lucide-react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import useSocketOrder from "@/hooks/useSocketOrder";
import "./StaffOrdering.scss";
import NotificationBell from "./NotificationBell";

import TableMap from "./components/TableMap";
import MenuOrdering from "./components/MenuOrdering";
import CartBottomSheet from "./components/CartBottomSheet";
import ContactsView from "./components/ContactsView";
import NotificationsView from "./components/NotificationsView";
import StaffProfile from "./components/StaffProfile";
import { AuthContext } from "../../context/AuthContext";
import StaffProofCaptureModal from "./components/StaffProofCaptureModal";
import { buildProofState, requiresProofImage } from "@/utils/orderProofRules";
import useCommunication from "@/hooks/useCommunication";
const REQUEST_ORDER_ITEM_VOID = gql`
  mutation StaffRequestOrderItemVoid($input: RequestOrderItemVoidInput!) {
    requestOrderItemVoid(input: $input) {
      id
      orderCode
      currentStatus
    }
  }
`;
const ADJUST_ORDER_ITEM_QUANTITY = gql`
  mutation StaffAdjustOrderItemQuantity($input: AdjustOrderItemQuantityInput!) {
    adjustOrderItemQuantity(input: $input) {
      id
      orderCode
      currentStatus
      items {
        _id
        dishId
        menuId
        categoryId
        name
        note
        priority
        quantity
        status
        unitPrice
        basePrice
        servingKey
        unit
        weightGrams
        proofImages
        servingVariant {
          key
          name
          mode
          sellUnit
          sellQty
        }
      }
      totals {
        subtotal
        discount
        tax
        service
        grandTotal
      }
    }
  }
`;
const TABLES_QUERY = gql`
  query StaffTables($restaurantId: ID!, $limit: Int) {
    tables(restaurantId: $restaurantId, limit: $limit) {
      id
      code
      floorLevel
      status
      capacity
    }
  }
`;

const MENU_ITEMS_QUERY = gql`
  query StaffMenuItems($restaurantId: ID!, $limit: Int) {
    menuItems(restaurantId: $restaurantId, limit: $limit) {
      id
      menuId
      categoryId
      name
      basePrice
      defaultServingKey
      status
      thumbImage
      servingVariants {
        key
        name
        mode
        price
        sellUnit
        sellQty
      }
    }
  }
`;

// NOTE:
// Giữ lại hằng query này để tránh lỗi runtime trong môi trường HMR/cache
// khi bundle cũ vẫn còn tham chiếu STAFF_ACCOUNT_OVERVIEW.
// Không dùng để render statistics bar nữa.
const STAFF_ACCOUNT_OVERVIEW = gql`
  query StaffAccountOverviewSafe($staffId: ID) {
    staffAccountOverview(staffId: $staffId) {
      staffId
    }
  }
`;

const SEARCH_CUSTOMERS = gql`
  query StaffCustomerSearch($search: String, $includeGuests: Boolean) {
    customers(search: $search, includeGuests: $includeGuests) {
      id
      fullName
      phone
      email
      loyaltyRank
      customerType
      totalOrders
      totalSpending
      noteInternal
    }
  }
`;

const GET_TABLE_CUSTOMER = gql`
  query StaffTableCustomer($restaurantId: ID!, $tableCode: String!) {
    tableCustomer(restaurantId: $restaurantId, tableCode: $tableCode) {
      id
      tableCode
      customerName
      customerPhone
      customerEmail
      customerUserId
      note
      dietaryNotes
      customerPreferences
      updatedAt
    }
  }
`;

const UPSERT_TABLE_CUSTOMER = gql`
  mutation StaffUpsertTableCustomer($input: UpsertTableCustomerInput!) {
    upsertTableCustomer(input: $input) {
      id
      tableCode
      customerName
      customerPhone
      customerEmail
      customerUserId
      note
      dietaryNotes
      customerPreferences
      updatedAt
    }
  }
`;

const DELETE_TABLE_CUSTOMER = gql`
  mutation StaffDeleteTableCustomer($restaurantId: ID!, $tableCode: String) {
    deleteTableCustomer(restaurantId: $restaurantId, tableCode: $tableCode)
  }
`;

const ORDERS_GROUPED_BY_TABLE = gql`
  query StaffOrdersGroupedByTable($restaurantId: ID!, $tableCode: String) {
    ordersGroupedByTable(restaurantId: $restaurantId, tableCode: $tableCode) {
      orderCode
      tableCode
      orders {
        id
        orderCode
        currentStatus
        items {
          _id
          dishId
          menuId
          categoryId
          name
          note
          priority
          quantity
          status
          unitPrice
          basePrice
          servingKey
          unit
          weightGrams
          proofImages
          servingVariant {
            key
            name
            mode
            sellUnit
            sellQty
          }
          originalQuantity
          cancelledQuantity
          voidRequests {
            requestId
            quantity
            reason
            status
            requestedAt
            reviewedAt
            reviewNote
          }
        }
      }
    }
  }
`;

const CREATE_ORDER_FOR_TABLE = gql`
  mutation StaffCreateOrderForTable($input: CreateOrderForTableInput!) {
    createOrderForTable(input: $input) {
      isNewOrder
      order {
        id
        orderCode
      }
    }
  }
`;

const CREATE_STAFF_REMOTE_ORDER = gql`
  mutation StaffCreateStaffRemoteOrder($input: CreateStaffRemoteOrderInput!) {
    createStaffRemoteOrder(input: $input) {
      idempotentHit
      order {
        id
        orderCode
        currentStatus
        orderType
        clientMeta
      }
    }
  }
`;
const REQUEST_PAYMENT_FOR_TABLE = gql`
  mutation StaffRequestPaymentForTable($input: RequestPaymentForTableInput!) {
    requestPaymentForTable(input: $input) {
      ok
      message
    }
  }
`;
const REQUEST_PAYMENT_FOR_ORDER = gql`
  mutation StaffRequestPaymentForOrder($input: RequestPaymentForOrderInput!) {
    requestPaymentForOrder(input: $input) {
      ok
      message
    }
  }
`;
const REMIND_ORDER_ITEM = gql`
  mutation StaffRemindOrderItem($input: RemindOrderItemInput!) {
    remindOrderItem(input: $input) {
      ok
      message
    }
  }
`;

const mapTableStatusToUi = (status) => {
  if (["available"].includes(status)) return "empty";
  if (["occupied"].includes(status)) return "checkout";
  return "serving";
};

const mapItemPriorityFromServeOrder = (serveOrder) => {
  if (serveOrder?.includes("Khai vị")) return "HIGH";
  if (serveOrder?.includes("Tráng miệng")) return "LOW";
  return "MEDIUM";
};

const toCustomerLabel = (row) => ({
  id: row?.id,
  name: row?.fullName || "Khách lẻ",
  phone: row?.phone || "",
  email: row?.email || "",
  rank: row?.loyaltyRank || row?.customerType || "THƯỜNG",
  totalOrders: Number(row?.totalOrders || 0),
  totalSpending: Number(row?.totalSpending || 0),
  noteInternal: row?.noteInternal || "",
});

const buildCartFromServerOrders = (orders = []) => {
  const result = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      const proofState = buildProofState(item);
      result.push({
        id: String(item._id || `${order.id}_${item.dishId || item.name}`),
        orderId: order.id,
        itemId: item.dishId,
        dishId: item.dishId,
        menuId: item.menuId,
        categoryId: item.categoryId,
        name: item.name,
        prep: item.note || "Mặc định",
        serveOrder:
          item.priority === "HIGH"
            ? "Khai vị (Mang ra trước)"
            : item.priority === "LOW"
              ? "Tráng miệng (Mang ra sau)"
              : "Mang ra cùng lúc",
        priority: item.priority || "MEDIUM",
        quantity: Number(item.quantity || 1),
        price: Number(item.unitPrice || item.basePrice || 0),
        status: item.status || "pending",
        persisted: true,
        servingKey: item.servingKey || null,
        unit: item.unit || item.servingVariant?.sellUnit || "portion",
        weightGrams: item.weightGrams ?? null,
        servingVariant: item.servingVariant || null,
        ...proofState,
        orderItemId: String(item._id || ""),
        orderStatus: order.currentStatus,
        orderCode: order.orderCode,
        originalQuantity: item.originalQuantity ?? null,
        cancelledQuantity: Number(item.cancelledQuantity || 0),
        voidRequests: item.voidRequests || [],
      });
    }
  }
  return result;
};

export default function StaffOrdering() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const restaurantId =
    user?.restaurantForStaff ||
    user?.primaryRestaurant?.id ||
    restaurants?.[0]?.id ||
    null;

  const [activeTab, setActiveTab] = useState("tables");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartByTable, setCartByTable] = useState({});
  const [orderCodeByTable, setOrderCodeByTable] = useState({});
  const [tableCustomerMap, setTableCustomerMap] = useState({});
  const [showCustomerNoteModal, setShowCustomerNoteModal] = useState(false);
  const [proofCaptureItem, setProofCaptureItem] = useState(null);
  const [focusChatThreadId, setFocusChatThreadId] = useState(null);
  const [orderMode, setOrderMode] = useState("dine_in");
  const [remoteOrderInfo, setRemoteOrderInfo] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    customerNote: "",
    orderType: "delivery",
    channel: "phone",
    requestedAt: "",
  });

  const searchTimerRef = useRef(null);
  const remoteSubmitKeyRef = useRef(null);
  const [requestOrderItemVoid] = useMutation(REQUEST_ORDER_ITEM_VOID);
  const [createOrderForTable, { loading: savingOrder }] = useMutation(
    CREATE_ORDER_FOR_TABLE,
  );
  const [createStaffRemoteOrder, { loading: savingRemoteOrder }] = useMutation(
    CREATE_STAFF_REMOTE_ORDER,
  );
  const [upsertTableCustomer] = useMutation(UPSERT_TABLE_CUSTOMER);
  const [requestPaymentForTable] = useMutation(REQUEST_PAYMENT_FOR_TABLE);
  const [requestPaymentForOrder] = useMutation(REQUEST_PAYMENT_FOR_ORDER);
  const [remindOrderItem] = useMutation(REMIND_ORDER_ITEM);
  const [deleteTableCustomer] = useMutation(DELETE_TABLE_CUSTOMER);
  const [adjustOrderItemQuantity] = useMutation(ADJUST_ORDER_ITEM_QUANTITY);
  const [loadOrdersForTable] = useLazyQuery(ORDERS_GROUPED_BY_TABLE, {
    fetchPolicy: "network-only",
  });
  const [loadTableCustomer] = useLazyQuery(GET_TABLE_CUSTOMER, {
    fetchPolicy: "network-only",
  });
  const [loadCustomers, customerSearchState] = useLazyQuery(SEARCH_CUSTOMERS, {
    fetchPolicy: "network-only",
  });
  const handleRequestItemVoid = async (item, payload) => {
    if (!item?.orderId || !(item?.orderItemId || item?.id)) {
      alert("Thiếu thông tin món để gửi yêu cầu hủy.");
      return;
    }

    const beforeKitchenStatuses = ["pending", "confirmed", "customer_attached"];

    if (beforeKitchenStatuses.includes(item.orderStatus)) {
      alert(
        "Đơn chưa vào bếp. Hãy dùng nút giảm số lượng thay vì yêu cầu hủy.",
      );
      return;
    }

    try {
      await requestOrderItemVoid({
        variables: {
          input: {
            orderId: item.orderId,
            orderItemId: item.orderItemId || item.id,
            quantity: Number(payload.quantity),
            reason: payload.reason,
          },
        },
      });

      await reloadSelectedTableOrders();
      alert("Đã gửi yêu cầu hủy/giảm món đến POS.");
    } catch (error) {
      alert(error?.message || "Không thể gửi yêu cầu hủy món.");
    }
  };
  const { data: tablesData, loading: tablesLoading } = useQuery(TABLES_QUERY, {
    variables: { restaurantId, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const { data: menuData, loading: menuLoading } = useQuery(MENU_ITEMS_QUERY, {
    variables: { restaurantId, limit: 300 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const { data: _overviewData } = useQuery(STAFF_ACCOUNT_OVERVIEW, {
    variables: { staffId: user?.id || null },
    skip: !user?.id,
    fetchPolicy: "network-only",
  });
  const { openThread } = useCommunication({ restaurantId });

  useEffect(() => {
    if (!tablesData?.tables) return;
    const mapped = tablesData.tables.map((t) => ({
      id: t.id,
      tableCode: t.code,
      name: t.code,
      floor: `Tầng ${t.floorLevel || 1}`,
      status: mapTableStatusToUi(t.status),
      guests: Number(t.capacity || 0),
      customer: null,
    }));
    setTables(mapped);
  }, [tablesData]);

  const floors = useMemo(() => {
    const set = new Set((tables || []).map((t) => t.floor).filter(Boolean));
    return set.size ? Array.from(set) : ["Tầng 1"];
  }, [tables]);

  const menuItems = useMemo(() => {
    const rows = menuData?.menuItems || [];
    return rows.map((m) => {
      const variants = Array.isArray(m.servingVariants)
        ? m.servingVariants
        : [];
      const firstVariant = variants[0] || null;
      const defaultVariant =
        variants.find((v) => v?.key === m.defaultServingKey) || firstVariant;

      const isSellable = !["unavailable", "out_of_stock", "hidden"].includes(
        String(m.status || "").toLowerCase(),
      );

      return {
        id: m.id,
        dishId: m.id,
        menuId: m.menuId,
        categoryId: m.categoryId,
        name: m.name,
        price: Number(defaultVariant?.price ?? m.basePrice ?? 0),
        stock: isSellable ? 99 : 0,
        category: m.categoryId
          ? `Danh mục ${String(m.categoryId).slice(-4)}`
          : "Khác",
        prep: variants.length
          ? variants.map((v) => v.name).filter(Boolean)
          : ["Mặc định"],
        servingKey: m.defaultServingKey || defaultVariant?.key || "portion",
        servingVariants: variants,
        defaultVariant: defaultVariant || null,
        thumbImage: m.thumbImage || null,
      };
    });
  }, [menuData]);

  const dynamicCategories = useMemo(() => {
    const set = new Set(["Tất cả"]);
    menuItems.forEach((m) => set.add(m.category || "Khác"));
    return Array.from(set);
  }, [menuItems]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId],
  );

  const cart = selectedTable ? cartByTable[selectedTable.id] || [] : [];
  const remoteCart = cartByTable.remote_order || [];
  const activeCart = orderMode === "remote" ? remoteCart : cart;
  const cartContextTable =
    orderMode === "remote"
      ? { id: "remote_order", name: "Order từ xa", customer: null }
      : selectedTable;

  const customerResults = useMemo(
    () =>
      (customerSearchState?.data?.customers || []).map((c) =>
        toCustomerLabel(c),
      ),
    [customerSearchState?.data?.customers],
  );

  const hydrateTableCustomer = useCallback(
    async (table) => {
      if (!table?.tableCode || !restaurantId) return;
      try {
        const { data } = await loadTableCustomer({
          variables: {
            restaurantId,
            tableCode: table.tableCode,
          },
        });
        const tc = data?.tableCustomer || null;
        if (!tc) return;

        const customer = {
          id: tc.customerUserId || `${table.id}_linked`,
          name: tc.customerName || "Khách liên kết",
          phone: tc.customerPhone || "",
          email: tc.customerEmail || "",
          rank: "THÀNH VIÊN",
          noteInternal:
            tc.note || tc.dietaryNotes || tc.customerPreferences || "",
        };

        setTableCustomerMap((prev) => ({ ...prev, [table.id]: tc }));
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? { ...t, customer } : t)),
        );
      } catch {
        // Ignore hydration error, keep UI stable
      }
    },
    [loadTableCustomer, restaurantId],
  );

  useEffect(() => {
    if (!selectedTable || !restaurantId) return;
    const hasDraft =
      Array.isArray(cartByTable[selectedTable.id]) &&
      cartByTable[selectedTable.id].some((x) => !x.persisted);
    if (hasDraft) return;

    hydrateTableCustomer(selectedTable);

    loadOrdersForTable({
      variables: {
        restaurantId,
        tableCode: selectedTable.tableCode || selectedTable.name,
      },
    })
      .then(({ data }) => {
        const groups = data?.ordersGroupedByTable || [];
        const latest = groups[0] || null;
        setOrderCodeByTable((prev) => ({
          ...prev,
          [selectedTable.id]:
            latest?.orderCode || prev[selectedTable.id] || null,
        }));
        setCartByTable((prev) => ({
          ...prev,
          [selectedTable.id]: buildCartFromServerOrders(latest?.orders || []),
        }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTable?.id,
    selectedTable?.tableCode,
    selectedTable?.name,
    restaurantId,
    hydrateTableCustomer,
  ]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const keyword = searchQuery.trim();
    if (!keyword || keyword.length < 2 || !showSearchResults) return;
    searchTimerRef.current = setTimeout(() => {
      setSearchTerm(keyword);
      loadCustomers({ variables: { search: keyword, includeGuests: true } });
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, loadCustomers, showSearchResults]);
  const reloadSelectedTableOrders = async () => {
    if (!selectedTable || !restaurantId) return;

    const { data } = await loadOrdersForTable({
      variables: {
        restaurantId,
        tableCode: selectedTable.tableCode || selectedTable.name,
      },
    });

    const groups = data?.ordersGroupedByTable || [];
    const latest = groups[0] || null;

    setOrderCodeByTable((prev) => ({
      ...prev,
      [selectedTable.id]: latest?.orderCode || prev[selectedTable.id] || null,
    }));

    setCartByTable((prev) => ({
      ...prev,
      [selectedTable.id]: buildCartFromServerOrders(latest?.orders || []),
    }));
  };
  useSocketOrder(restaurantId, {
    onUpdated: (order) => {
      const isPaid =
        order?.payment?.status === "paid" ||
        order?.currentStatus === "completed";

      if (!isPaid) return;

      const tableCode = order?.tableCode;
      if (!tableCode) return;

      const matchedTable = (tables || []).find(
        (t) =>
          String(t.tableCode || t.name || "").toLowerCase() ===
          String(tableCode).toLowerCase(),
      );

      if (!matchedTable?.id) return;

      setCartByTable((prev) => ({
        ...prev,
        [matchedTable.id]: [],
      }));

      setOrderCodeByTable((prev) => ({
        ...prev,
        [matchedTable.id]: null,
      }));

      setTables((prev) =>
        prev.map((t) =>
          t.id === matchedTable.id
            ? {
                ...t,
                status: "empty",
                customer: null,
              }
            : t,
        ),
      );

      if (selectedTableId === matchedTable.id) {
        setIsCartOpen(false);
      }
    },

    onStatusChanged: (order) => {
      const isPaid =
        order?.payment?.status === "paid" ||
        order?.currentStatus === "completed";

      if (!isPaid) return;

      const tableCode = order?.tableCode;
      if (!tableCode) return;

      const matchedTable = (tables || []).find(
        (t) =>
          String(t.tableCode || t.name || "").toLowerCase() ===
          String(tableCode).toLowerCase(),
      );

      if (!matchedTable?.id) return;

      setCartByTable((prev) => ({
        ...prev,
        [matchedTable.id]: [],
      }));

      setOrderCodeByTable((prev) => ({
        ...prev,
        [matchedTable.id]: null,
      }));

      setTables((prev) =>
        prev.map((t) =>
          t.id === matchedTable.id
            ? {
                ...t,
                status: "empty",
                customer: null,
              }
            : t,
        ),
      );

      if (selectedTableId === matchedTable.id) {
        setIsCartOpen(false);
      }
    },
  });
  const handleAdjustPersistedItemQuantity = async (item, delta) => {
    if (!item?.orderId || !(item?.orderItemId || item?.id)) {
      alert("Thiếu thông tin món đã lưu để điều chỉnh.");
      return;
    }

    const nextQuantity = Number(item.quantity || 1) + Number(delta || 0);

    if (nextQuantity <= 0) {
      alert(
        "Muốn xóa hết món đã gửi thì dùng yêu cầu hủy món, không trừ về 0.",
      );
      return;
    }

    const editableStatuses = ["pending", "confirmed", "customer_attached"];
    if (!editableStatuses.includes(item.orderStatus)) {
      alert("Bếp đã nhận món. Cần dùng yêu cầu hủy/giảm món có lý do.");
      return;
    }

    try {
      await adjustOrderItemQuantity({
        variables: {
          input: {
            orderId: item.orderId,
            orderItemId: item.orderItemId || item.id,
            quantity: nextQuantity,
            reason: "Nhân viên điều chỉnh số lượng trước khi bếp nhận",
          },
        },
      });

      await reloadSelectedTableOrders();
    } catch (error) {
      alert(error?.message || "Không thể điều chỉnh số lượng món.");
    }
  };
  const handleAssignCustomer = async (customer) => {
    if (!selectedTableId || !selectedTable || !restaurantId) {
      alert("Vui lòng chọn 1 bàn trước khi gán khách!");
      return;
    }

    const input = {
      restaurantId,
      tableCode: selectedTable.tableCode || selectedTable.name,
      customerUserId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || null,
      customerEmail: customer.email || null,
      note: customer.noteInternal || null,
      dietaryNotes: customer.noteInternal || null,
      customerPreferences: customer.noteInternal || null,
    };

    try {
      const { data } = await upsertTableCustomer({ variables: { input } });
      const saved = data?.upsertTableCustomer;
      setTableCustomerMap((prev) => ({
        ...prev,
        [selectedTable.id]: saved || input,
      }));
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? {
                ...t,
                customer,
                status: t.status === "empty" ? "serving" : t.status,
              }
            : t,
        ),
      );
      setSearchQuery("");
      setShowSearchResults(false);
    } catch (error) {
      alert(error?.message || "Không thể liên kết khách cho bàn này.");
    }
  };

  const handleRemoveCustomer = async () => {
    if (!selectedTable || !restaurantId) return;
    if (!window.confirm("Bỏ gán khách hàng khỏi bàn này?")) return;

    try {
      await deleteTableCustomer({
        variables: {
          restaurantId,
          tableCode: selectedTable.tableCode || selectedTable.name,
        },
      });
      setTableCustomerMap((prev) => {
        const next = { ...prev };
        delete next[selectedTable.id];
        return next;
      });
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId ? { ...t, customer: null } : t,
        ),
      );
    } catch (error) {
      alert(error?.message || "Không thể xóa liên kết khách ở bàn này.");
    }
  };

  const setCartForSelectedTable = (updater) => {
    if (!selectedTable?.id) return;
    setCartByTable((prev) => {
      const prevCart = prev[selectedTable.id] || [];
      const nextCart =
        typeof updater === "function" ? updater(prevCart) : updater;
      return { ...prev, [selectedTable.id]: nextCart };
    });
  };

  const handleAddToCart = (item, optionsOrPrep, legacyServeOrder) => {
    if (item.stock <= 0) return alert("Món này đã hết hàng!");

    const addOptions =
      typeof optionsOrPrep === "object" && optionsOrPrep !== null
        ? optionsOrPrep
        : {
            prep: optionsOrPrep,
            serveOrder: legacyServeOrder,
            variant: null,
          };

    const prep = addOptions.prep || "Mặc định";
    const serveOrder = addOptions.serveOrder || "Mang ra cùng lúc";
    const selectedVariant =
      addOptions.variant ||
      item.defaultVariant ||
      item.servingVariants?.find((v) => v?.key === item.servingKey) ||
      item.servingVariants?.[0] ||
      null;

    const targetTableId =
      orderMode === "remote" ? "remote_order" : selectedTable?.id;
    if (!targetTableId) return alert("Vui lòng chọn bàn trước khi thêm món");

    const nextPriority = mapItemPriorityFromServeOrder(serveOrder);
    const signature = `${item.id}__${selectedVariant?.key || item.servingKey || "portion"}__${prep || ""}__${serveOrder || ""}`;

    setCartByTable((prevMap) => {
      const prev = prevMap[targetTableId] || [];
      const idx = prev.findIndex(
        (x) =>
          x.signature === signature && x.status === "pending" && !x.persisted,
      );
      const nextCart =
        idx >= 0
          ? prev.map((x, i) =>
              i === idx
                ? {
                    ...x,
                    quantity: Number(x.quantity || 1) + 1,
                    priority: nextPriority,
                  }
                : x,
            )
          : (() => {
              const defaultVariant = selectedVariant;

              const unit =
                defaultVariant?.mode === "BY_WEIGHT"
                  ? defaultVariant?.sellUnit || "kg"
                  : defaultVariant?.sellUnit || "portion";
              const newItem = {
                id: "C" + Date.now(),
                signature,
                itemId: item.id,
                dishId: item.dishId || item.id,
                menuId: item.menuId,
                categoryId: item.categoryId,
                servingKey: defaultVariant?.key || item.servingKey || "portion",
                servingVariant: defaultVariant,
                price: Number(defaultVariant?.price ?? item.price ?? 0),
                unit,
                weightGrams: null,
                name: item.name,
                prep: prep || "Mặc định",
                serveOrder,
                priority: nextPriority,
                quantity: 1,

                status: "pending",
                proofImages: [],
                persisted: false,
              };
              const proofState = buildProofState(newItem);
              return [{ ...newItem, ...proofState }, ...prev];
            })();
      return { ...prevMap, [targetTableId]: nextCart };
    });
  };
  const handleOpenProofCapture = (item) => {
    setProofCaptureItem(item);
  };

  const handleSaveProofImages = (itemId, proofImages) => {
    const targetTableId =
      orderMode === "remote" ? "remote_order" : selectedTable?.id;
    if (!targetTableId) return;
    setCartByTable((prevMap) => {
      const prev = prevMap[targetTableId] || [];
      const next = prev.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, ...buildProofState({ ...it, proofImages }) };
      });
      return { ...prevMap, [targetTableId]: next };
    });
    setProofCaptureItem(null);
  };

  const findWeightProofMissing = (items = []) =>
    items.filter((item) => {
      const isWeight =
        String(item?.servingVariant?.mode || "").toUpperCase() === "BY_WEIGHT";
      if (!isWeight) return false;
      const grams = Number(item?.weightGrams);
      const missingWeight = !Number.isFinite(grams) || grams <= 0;
      const images = Array.isArray(item?.proofImages) ? item.proofImages : [];
      const missingImages = images.length < 1;
      return missingWeight || missingImages;
    });

  const handleSendKitchen = async () => {
    if (orderMode === "remote") {
      const pendingItems = remoteCart.filter(
        (x) => x.status === "pending" && !x.persisted,
      );
      if (!pendingItems.length) {
        alert("Không có món mới để gửi POS.");
        return;
      }
      if (
        !remoteOrderInfo.customerName.trim() ||
        !remoteOrderInfo.phone.trim()
      ) {
        alert("Vui lòng nhập tên khách và số điện thoại.");
        return;
      }
      if (
        remoteOrderInfo.orderType === "delivery" &&
        !remoteOrderInfo.address.trim()
      ) {
        alert("Đơn giao hàng cần địa chỉ giao.");
        return;
      }
      const missingWeightProof = findWeightProofMissing(pendingItems);
      if (missingWeightProof.length > 0) {
        const labels = missingWeightProof
          .slice(0, 5)
          .map((x) => {
            const grams = Number(x?.weightGrams);
            const weightMissing = !Number.isFinite(grams) || grams <= 0;
            const imgMissing =
              !Array.isArray(x?.proofImages) || x.proofImages.length < 1;
            return `${x.name} (${[weightMissing ? "thiếu cân nặng" : null, imgMissing ? "thiếu ảnh" : null].filter(Boolean).join(", ")})`;
          })
          .join("; ");
        alert(`Món KG chưa đủ thông tin: ${labels}`);
        return;
      }
      const payloadItems = pendingItems.map((item) => {
        const isWeight =
          String(item?.servingVariant?.mode || "").toUpperCase() ===
          "BY_WEIGHT";

        return {
          dishId: item.dishId,
          menuId: item.menuId,
          categoryId: item.categoryId,
          name: item.name,
          unit: item.unit || (isWeight ? "kg" : "portion"),
          basePrice: Number(item.price || 0),
          servingKey: item.servingKey || item.servingVariant?.key || "portion",
          servingVariant: item.servingVariant
            ? {
                key: item.servingVariant.key,
                name: item.servingVariant.name,
                mode: item.servingVariant.mode,
                sellUnit: item.servingVariant.sellUnit,
                sellQty: item.servingVariant.sellQty ?? null,
                price: Number(item.servingVariant.price ?? item.price ?? 0),
              }
            : null,
          quantity: Number(item.quantity || 1),
          weightGrams: isWeight
            ? Number(item.weightGrams)
            : (item.weightGrams ?? null),
          proofImages: item.proofImages || [],
          note: [item.prep, item.serveOrder].filter(Boolean).join(" • "),
          priority: item.priority || "MEDIUM",
        };
      });
      try {
        if (!remoteSubmitKeyRef.current) {
          remoteSubmitKeyRef.current = `staff-remote-${restaurantId}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
        }

        await createStaffRemoteOrder({
          variables: {
            input: {
              restaurantId,
              orderType: remoteOrderInfo.orderType,
              note: `[${remoteOrderInfo.channel}] ${remoteOrderInfo.customerNote || ""}`.trim(),
              customer: {
                fullName: remoteOrderInfo.customerName.trim(),
                phone: remoteOrderInfo.phone.trim(),
                email: remoteOrderInfo.email.trim() || null,
              },
              shipping: {
                fullName: remoteOrderInfo.customerName.trim(),
                phone: remoteOrderInfo.phone.trim(),
                email: remoteOrderInfo.email.trim() || null,
                address: remoteOrderInfo.address.trim() || null,
                note: remoteOrderInfo.customerNote.trim() || null,
                deliveryMethod: remoteOrderInfo.orderType,
                deliveryTime: remoteOrderInfo.requestedAt || null,
              },
              items: payloadItems,
              channel: remoteOrderInfo.channel,
              idempotencyKey: remoteSubmitKeyRef.current,
              clientMeta: {
                source: "staff_remote",
                channel: remoteOrderInfo.channel,
                receivedByStaffId: user?.id || null,
                requestedAt: remoteOrderInfo.requestedAt || null,
              },
            },
          },
        });
        setCartByTable((prev) => ({ ...prev, remote_order: [] }));
        remoteSubmitKeyRef.current = null;
        alert("Đã gửi POS xác nhận.");
      } catch (err) {
        alert(err?.message || "Gửi đơn từ xa thất bại");
      }
      return;
    }
    if (!selectedTable?.id || !restaurantId) {
      alert("Thiếu thông tin nhà hàng hoặc bàn.");
      return;
    }

    const currentCart = cartByTable[selectedTable.id] || [];
    const pendingItems = currentCart.filter(
      (x) => x.status === "pending" && !x.persisted,
    );
    if (!pendingItems.length) {
      alert("Không có món mới để gửi bếp.");
      return;
    }

    const missingProof = pendingItems.filter(
      (item) =>
        requiresProofImage(item) &&
        (!Array.isArray(item.proofImages) || item.proofImages.length === 0),
    );

    if (missingProof.length > 0) {
      const names = missingProof
        .slice(0, 3)
        .map((x) => x.name)
        .join(", ");
      alert(`Các món bắt buộc ảnh minh chứng nhưng chưa có ảnh: ${names}`);
      return;
    }
    const missingWeightProof = findWeightProofMissing(pendingItems);
    if (missingWeightProof.length > 0) {
      const labels = missingWeightProof
        .slice(0, 5)
        .map((x) => {
          const grams = Number(x?.weightGrams);
          const weightMissing = !Number.isFinite(grams) || grams <= 0;
          const imgMissing =
            !Array.isArray(x?.proofImages) || x.proofImages.length < 1;
          return `${x.name} (${[weightMissing ? "thiếu cân nặng" : null, imgMissing ? "thiếu ảnh" : null].filter(Boolean).join(", ")})`;
        })
        .join("; ");
      alert(`Món KG chưa đủ thông tin: ${labels}`);
      return;
    }

    const payloadItems = pendingItems.map((item) => {
      const isWeight =
        String(item?.servingVariant?.mode || "").toUpperCase() === "BY_WEIGHT";
      const quantity = Number(item.quantity || 1);
      const weightGrams = isWeight ? Number(item.weightGrams) : null;
      return {
        dishId: item.dishId,
        menuId: item.menuId,
        categoryId: item.categoryId,
        name: item.name,
        unit: item.unit || (isWeight ? "kg" : "portion"),
        basePrice: Number(item.price || 0),
        servingKey: item.servingKey || "portion",
        servingVariant: item.servingVariant
          ? {
              key: item.servingVariant.key,
              name: item.servingVariant.name,
              mode: item.servingVariant.mode,
              sellUnit: item.servingVariant.sellUnit,
              sellQty: item.servingVariant.sellQty ?? null,
              price: Number(item.servingVariant.price ?? item.price ?? 0),
            }
          : null,
        quantity,
        weightGrams,
        proofImages: item.proofImages || [],
        note: [item.prep, item.serveOrder].filter(Boolean).join(" • "),
        priority: item.priority || "MEDIUM",
      };
    });

    try {
      const { data } = await createOrderForTable({
        variables: {
          input: {
            restaurantId,
            tableCode: selectedTable.tableCode || selectedTable.name,
            orderCode: orderCodeByTable[selectedTable.id] || null,
            items: payloadItems,
          },
        },
      });

      const orderCode = data?.createOrderForTable?.order?.orderCode || null;
      if (orderCode) {
        setOrderCodeByTable((prev) => ({
          ...prev,
          [selectedTable.id]: orderCode,
        }));
      }

      const refreshed = await loadOrdersForTable({
        variables: {
          restaurantId,
          tableCode: selectedTable.tableCode || selectedTable.name,
        },
        fetchPolicy: "network-only",
      });
      const groups = refreshed?.data?.ordersGroupedByTable || [];
      const latest = groups[0] || null;
      setCartByTable((prev) => ({
        ...prev,
        [selectedTable.id]: buildCartFromServerOrders(latest?.orders || []),
      }));
      alert("Đã gửi bếp và lưu order vào hệ thống.");
    } catch (err) {
      alert(err?.message || "Gửi bếp thất bại");
    }
  };

  const handleTableAction = (action) => {
    if (!selectedTable) return;
    if (action === "move")
      alert(`Đang chuyển bàn cho ${selectedTable.name}...`);
    if (action === "merge") alert(`Đang gộp bàn cho ${selectedTable.name}...`);
    if (action === "checkout") setIsCartOpen(true);
  };
  const handleCheckout = async () => {
    try {
      if (orderMode === "remote") {
        const orderIds = [
          ...new Set((remoteCart || []).map((x) => x.orderId).filter(Boolean)),
        ];
        if (!orderIds.length)
          return alert("Chưa có order đã gửi để yêu cầu thanh toán.");
        const { data } = await requestPaymentForOrder({
          variables: { input: { restaurantId, orderIds } },
        });
        alert("Đã gửi yêu cầu thanh toán đến POS.");
        return;
      }
      if (!selectedTable?.tableCode && !selectedTable?.name)
        return alert("Vui lòng chọn bàn.");
      const { data } = await requestPaymentForTable({
        variables: {
          input: {
            restaurantId,
            tableCode: selectedTable.tableCode || selectedTable.name,
          },
        },
      });
      alert("Đã gửi yêu cầu thanh toán đến POS.");
    } catch (e) {
      alert(e?.message || "Yêu cầu thanh toán thất bại.");
    }
  };
  const handleRemindItem = async (item) => {
    try {
      const orderId = item?.orderId;
      const orderItemId = item?.id;
      if (!orderId || !orderItemId)
        return alert("Không xác định được order/item để nhắc.");
      const { data } = await remindOrderItem({
        variables: { input: { restaurantId, orderId, orderItemId } },
      });
      alert(data?.remindOrderItem?.message || "Đã gửi nhắc món.");
    } catch (e) {
      alert(e?.message || "Nhắc món thất bại.");
    }
  };

  const pendingCount = activeCart.filter((c) => c.status === "pending").length;
  const linkedTableCustomer = selectedTable
    ? tableCustomerMap[selectedTable.id]
    : null;
  return (
    <div className="staff-pos-layout">
      <header className="staff-pos-header">
        <div
          className={`search-container ${showSearchResults ? "active" : ""}`}
        >
          <div className="search-input-wrapper">
            <Search size={20} className="icon-search" />
            <input
              type="text"
              placeholder="Tìm khách quen (Tên/SĐT)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
            />
            {searchQuery && (
              <button className="btn-clear" onClick={() => setSearchQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>

          {showSearchResults && (
            <div className="search-results-dropdown">
              <div className="dropdown-title">Khách hàng thành viên</div>
              {customerSearchState.loading && (
                <div className="search-state">Đang tải gợi ý...</div>
              )}
              {!customerSearchState.loading &&
                searchTerm.length >= 2 &&
                customerResults.length === 0 && (
                  <div className="search-state">
                    Không tìm thấy khách phù hợp.
                  </div>
                )}
              <div className="results-list">
                {customerResults.map((cus) => (
                  <div
                    key={cus.id}
                    className="search-result-item"
                    onClick={() => handleAssignCustomer(cus)}
                  >
                    <div className="cus-avatar">
                      <UserCircle size={24} />
                    </div>
                    <div className="cus-info">
                      <span className="cus-name">{cus.name}</span>
                      <span className="cus-phone">
                        {cus.phone || "Không có SĐT"}
                      </span>
                    </div>
                    <div className="cus-rank-badge">
                      <Star size={10} className="icon-star" /> {cus.rank}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="header-actions">
          <NotificationBell
            onViewAll={() => setActiveTab("notifications")}
            restaurantId={restaurantId}
            onOpenThread={(threadId) => {
              setFocusChatThreadId(threadId);
              setActiveTab("contacts");
            }}
          />
        </div>
      </header>

      {showSearchResults && (
        <div
          className="search-overlay"
          onClick={() => setShowSearchResults(false)}
        ></div>
      )}

      <main className="staff-pos-main">
        {(tablesLoading || menuLoading) && (
          <div className="staff-inline-state">Đang tải dữ liệu nhà hàng...</div>
        )}
        {!tablesLoading &&
          !menuLoading &&
          restaurantId &&
          tables.length === 0 && (
            <div className="staff-inline-state">
              Nhà hàng chưa có bàn để thao tác.
            </div>
          )}

        {activeTab === "tables" && (
          <TableMap
            tables={tables}
            floors={floors}
            onSelect={(t) => setSelectedTableId(t.id)}
            selectedTable={selectedTable}
            onTableAction={handleTableAction}
          />
        )}
        {activeTab === "menu" && (
          <>
            <div className="staff-order-mode-switch">
              <button
                className={orderMode === "dine_in" ? "active" : ""}
                onClick={() => setOrderMode("dine_in")}
              >
                Order tại bàn
              </button>
              <button
                className={orderMode === "remote" ? "active" : ""}
                onClick={() => setOrderMode("remote")}
              >
                Order từ xa
              </button>
            </div>
            {orderMode === "remote" && (
              <div className="staff-remote-order-form">
                <input
                  placeholder="Tên khách"
                  value={remoteOrderInfo.customerName}
                  onChange={(e) =>
                    setRemoteOrderInfo((p) => ({
                      ...p,
                      customerName: e.target.value,
                    }))
                  }
                />
                <input
                  placeholder="Số điện thoại"
                  value={remoteOrderInfo.phone}
                  onChange={(e) =>
                    setRemoteOrderInfo((p) => ({ ...p, phone: e.target.value }))
                  }
                />
                <input
                  placeholder="Email (nếu có)"
                  value={remoteOrderInfo.email}
                  onChange={(e) =>
                    setRemoteOrderInfo((p) => ({ ...p, email: e.target.value }))
                  }
                />
                <input
                  placeholder="Địa chỉ giao hàng"
                  value={remoteOrderInfo.address}
                  onChange={(e) =>
                    setRemoteOrderInfo((p) => ({
                      ...p,
                      address: e.target.value,
                    }))
                  }
                />
                <textarea
                  placeholder="Ghi chú khách"
                  value={remoteOrderInfo.customerNote}
                  onChange={(e) =>
                    setRemoteOrderInfo((p) => ({
                      ...p,
                      customerNote: e.target.value,
                    }))
                  }
                />
                <div className="remote-inline-fields">
                  <select
                    value={remoteOrderInfo.orderType}
                    onChange={(e) =>
                      setRemoteOrderInfo((p) => ({
                        ...p,
                        orderType: e.target.value,
                      }))
                    }
                  >
                    <option value="delivery">delivery</option>
                    <option value="takeaway">takeaway</option>
                  </select>
                  <select
                    value={remoteOrderInfo.channel}
                    onChange={(e) =>
                      setRemoteOrderInfo((p) => ({
                        ...p,
                        channel: e.target.value,
                      }))
                    }
                  >
                    <option value="phone">phone</option>
                    <option value="chat">chat</option>
                    <option value="web">web</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={remoteOrderInfo.requestedAt}
                    onChange={(e) =>
                      setRemoteOrderInfo((p) => ({
                        ...p,
                        requestedAt: e.target.value,
                      }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn-open-remote-chat"
                  onClick={async () => {
                    if (!restaurantId || !remoteOrderInfo.customerName.trim()) {
                      alert("Nhập tên khách trước khi mở chat.");
                      return;
                    }
                    const { data } = await openThread({
                      variables: {
                        input: {
                          restaurantId,
                          channel: "order",
                          subject: `Remote order - ${remoteOrderInfo.customerName.trim()}`,
                        },
                      },
                    });
                    const threadId = data?.openChatThread?.id;
                    if (threadId) {
                      setFocusChatThreadId(threadId);
                      setActiveTab("contacts");
                    }
                  }}
                >
                  Nhắn khách
                </button>
              </div>
            )}
            <MenuOrdering
              onAdd={handleAddToCart}
              searchQuery={searchQuery}
              selectedTable={cartContextTable}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              onRemoveCustomer={handleRemoveCustomer}
              menuItems={menuItems}
              categories={dynamicCategories}
            />
          </>
        )}
        {activeTab === "contacts" && (
          <ContactsView
            restaurantId={restaurantId}
            focusThreadId={focusChatThreadId}
            onFocusHandled={() => setFocusChatThreadId(null)}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationsView
            restaurantId={restaurantId}
            onOpenThread={(threadId) => {
              setFocusChatThreadId(threadId);
              setActiveTab("contacts");
            }}
          />
        )}
        {activeTab === "profile" && <StaffProfile />}
      </main>

      {(activeTab === "menu" || activeTab === "tables") && cartContextTable && (
        <div className="floating-cart-wrapper">
          <button
            className="btn-floating-cart"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="cart-left">
              <div className="icon-cart-wrap">
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="cart-badge">{cart.length}</span>
                )}
              </div>
              <div className="cart-text">
                <span className="table-info">
                  {cartContextTable.name}{" "}
                  {cartContextTable.customer &&
                    `• ${cartContextTable.customer.name}`}
                </span>
                <span className="status-info">
                  {pendingCount > 0
                    ? `${pendingCount} món đang chờ`
                    : "Xem Order / Tính tiền"}
                </span>
              </div>
            </div>
            <div className="cart-right">
              <span className="total-text">Xem</span>
            </div>
          </button>

          {linkedTableCustomer && orderMode !== "remote" && (
            <button
              type="button"
              className="btn-customer-note"
              onClick={() => setShowCustomerNoteModal(true)}
            >
              <AlertCircle size={14} /> Lưu ý khách
            </button>
          )}
        </div>
      )}

      <nav className="staff-pos-bottom-nav">
        <button
          className={`nav-item ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          <div className="nav-icon-wrap">
            <Grid size={22} />
          </div>
          <span>Bàn</span>
        </button>
        <button
          className={`nav-item ${activeTab === "menu" ? "active" : ""}`}
          onClick={() => setActiveTab("menu")}
        >
          <div className="nav-icon-wrap">
            <Coffee size={22} />
          </div>
          <span>Menu</span>
        </button>
        <button
          className={`nav-item ${activeTab === "contacts" ? "active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <div className="nav-icon-wrap">
            <MessageSquare size={22} />
          </div>
          <span>Liên lạc</span>
        </button>
        <button
          className={`nav-item ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          <div className="nav-icon-wrap">
            <Bell size={22} />
          </div>
          <span>Thông báo</span>
        </button>
        <button
          className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <div className="nav-icon-wrap">
            <UserCircle size={22} />
          </div>
          <span>Cá nhân</span>
        </button>
      </nav>

      {isCartOpen && (
        <CartBottomSheet
          cart={activeCart}
          setCart={
            orderMode === "remote"
              ? (updater) => {
                  setCartByTable((prev) => {
                    const prevCart = prev.remote_order || [];
                    const nextCart =
                      typeof updater === "function"
                        ? updater(prevCart)
                        : updater;
                    return { ...prev, remote_order: nextCart };
                  });
                }
              : setCartForSelectedTable
          }
          onClose={() => setIsCartOpen(false)}
          table={cartContextTable}
          onSendKitchen={handleSendKitchen}
          onOpenProofCapture={handleOpenProofCapture}
          onCheckout={handleCheckout}
          onRemindItem={handleRemindItem}
          checkoutEnabled={Boolean(
            restaurantId && (orderMode === "remote" || selectedTable),
          )}
          sending={orderMode === "remote" ? savingRemoteOrder : savingOrder}
          sendActionLabel={
            orderMode === "remote" ? "Gửi POS xác nhận" : "Gửi Bếp"
          }
          onAdjustPersistedItemQuantity={handleAdjustPersistedItemQuantity}
          onRequestItemVoid={handleRequestItemVoid}
        />
      )}

      <StaffProofCaptureModal
        open={!!proofCaptureItem}
        item={proofCaptureItem}
        onClose={() => setProofCaptureItem(null)}
        onSave={(proofImages) =>
          proofCaptureItem &&
          handleSaveProofImages(proofCaptureItem.id, proofImages)
        }
      />

      {showCustomerNoteModal && linkedTableCustomer && (
        <div
          className="customer-note-modal"
          onClick={() => setShowCustomerNoteModal(false)}
        >
          <div
            className="customer-note-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Lưu ý ăn uống của khách</h3>
            <p>
              <strong>Khách:</strong> {linkedTableCustomer.customerName || "—"}
            </p>
            <p>
              <strong>SĐT:</strong> {linkedTableCustomer.customerPhone || "—"}
            </p>
            <p>
              <strong>Dietary notes:</strong>{" "}
              {linkedTableCustomer.dietaryNotes ||
                linkedTableCustomer.note ||
                "Chưa có"}
            </p>
            <p>
              <strong>Thói quen ăn uống:</strong>{" "}
              {linkedTableCustomer.customerPreferences ||
                linkedTableCustomer.note ||
                "Chưa có"}
            </p>
            <button
              type="button"
              onClick={() => setShowCustomerNoteModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
