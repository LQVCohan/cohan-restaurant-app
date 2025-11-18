import { useState, useEffect, useCallback, useRef } from "react";
import {
  useMutation,
  useLazyQuery,
  useApolloClient,
  gql,
} from "@apollo/client";
import useSocketOrder from "./useSocketOrder";

/* ============================================================
   1) GRAPHQL
   ============================================================ */

/** ✅ CREATE OR APPEND TABLE ORDER (tạo đợt mới với orderCode giữ nguyên nếu có) */
const CREATE_OR_APPEND_TABLE_ORDER = gql`
  mutation CreateOrAppendTableOrder($input: CreateOrAppendTableOrderInput!) {
    createOrAppendTableOrder(input: $input) {
      isNewOrder
      order {
        id
        orderCode
        tableCode
        currentStatus
        restaurantId
        user {
          id
          fullName
        }
        items {
          dishId
          menuId
          categoryId
          name
          unit
          price
          modifiersPrice
          method
          note
          quantity
          status
        }
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        createdAt
        updatedAt
      }
    }
  }
`;

/** 🔎 Gom theo đợt (orderCode) của 1 bàn */
const ORDERS_GROUPED_BY_TABLE = gql`
  query OrdersGroupedByTable($restaurantId: ID!, $tableCode: String!) {
    ordersGroupedByTable(restaurantId: $restaurantId, tableCode: $tableCode) {
      orderCode
      tableCode
      latestStatus
      count
      orders {
        id
        orderCode
        tableCode
        currentStatus
        restaurantId
        note
        user {
          id
          fullName
          email
          phone
        }
        items {
          dishId
          menuId
          categoryId
          name
          unit
          price
          modifiersPrice
          method
          note
          quantity
          status
          modifiers {
            optionId
            optionName
            groupId
            price
          }
        }
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        orderType
        createdAt
        updatedAt
      }
    }
  }
`;

/** ACTIVE orders (exclude cancelled/completed) – giữ để tương thích màn khác */
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
          tableCode
          currentStatus
          restaurantId
          note
          user {
            id
            fullName
            email
            phone
          }
          items {
            dishId
            menuId
            categoryId
            name
            unit
            price
            modifiersPrice
            method
            note
            quantity
            status
          }
          totals {
            subtotal
            discount
            tax
            service
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

/** ALL orders (including cancelled/completed) – giữ để tương thích */
const ORDERS_BY_RESTAURANT_ALL = gql`
  query OrdersByRestaurant($restaurantId: ID!, $limit: Int, $cursor: ID) {
    ordersByRestaurant(
      restaurantId: $restaurantId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          orderCode
          tableCode
          currentStatus
          restaurantId
          user {
            id
            fullName
          }
          items {
            dishId
            menuId
            categoryId
            name
            unit
            price
            modifiersPrice
            method
            note
            quantity
            status
          }
          totals {
            subtotal
            discount
            tax
            service
            grandTotal
          }
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

/** Single order – giữ để tương thích */
const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      orderCode
      tableCode
      currentStatus
      items {
        dishId
        menuId
        categoryId
        name
        unit
        price
        modifiersPrice
        method
        note
        quantity
        status
      }
      totals {
        subtotal
        discount
        tax
        service
        grandTotal
      }
      note
      createdAt
      updatedAt
    }
  }
`;

/** 💳 Thanh toán 1 order (legacy) */
const PAY_ORDER = gql`
  mutation PayOrder($input: PayOrderInput!) {
    payOrder(input: $input) {
      order {
        id
        orderCode
        tableCode
        currentStatus
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        updatedAt
      }
    }
  }
`;

/** 💳 Thanh toán trọn đợt theo orderCode (mới) */
const PAY_ORDERS_BY_CODE = gql`
  mutation PayOrdersByCode($input: PayOrdersByCodeInput!) {
    payOrdersByCode(input: $input) {
      order {
        id
        orderCode
        tableCode
        currentStatus
      }
      invoice {
        id
        number
        issuedAt
        totals {
          grandTotal
        }
      }
      transaction {
        id
        paidAmount
        method
        status
      }
      cashflow {
        id
        amount
        type
      }
    }
  }
`;

/** ✅ Cập nhật trạng thái 1 order theo ID */
const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      orderCode
      tableCode
      restaurantId
      currentStatus
      totals {
        subtotal
        discount
        tax
        service
        grandTotal
      }
      updatedAt
    }
  }
`;

/** ✅ Cập nhật trạng thái 1 item trong 1 order theo ID */
const UPDATE_ORDER_ITEM_STATUS = gql`
  mutation UpdateOrderItemStatus($input: UpdateOrderItemStatusInput!) {
    updateOrderItemStatus(input: $input) {
      order {
        id
        orderCode
        tableCode
        restaurantId
        currentStatus
        items {
          dishId
          name
          status
          price
          modifiersPrice
          quantity
        }
        updatedAt
      }
    }
  }
`;

/** Gắn/đổi khách cho toàn đợt theo orderCode */
const UPDATE_ORDER_CUSTOMER_BY_CODE = gql`
  mutation UpdateOrderCustomerByCode($input: UpdateOrderCustomerByCodeInput!) {
    updateOrderCustomerByCode(input: $input) {
      success
      modifiedCount
    }
  }
`;

/* ============================================================
   2) HOOK
   ============================================================ */

export default function useOrderManagement(pos = null) {
  const apollo = useApolloClient();

  const {
    currentOrder,
    setCurrentOrder,
    currentTable,
    setTableOrders,
    restaurantId,
  } = pos ?? {};

  /** Nhóm đợt theo bàn */
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);

  /** Tổng tiền hiển thị ở POS (theo currentOrder ở UI) */
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    total: 0,
  });
  const [orderNote, setOrderNote] = useState("");

  // Keep last prepared orderId for legacy confirmPayment
  const lastPreparedOrderIdRef = useRef(null);

  // apollo mutations
  const [createOrAppendOrder] = useMutation(CREATE_OR_APPEND_TABLE_ORDER);
  const [mutPayOrder, { loading: payLoadingLegacy }] = useMutation(PAY_ORDER);
  const [mutPayByCode, { loading: payLoadingByCode }] =
    useMutation(PAY_ORDERS_BY_CODE);
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [mutUpdateOrderItemStatus] = useMutation(UPDATE_ORDER_ITEM_STATUS);
  const [mutUpdateOrderCustomerByCode] = useMutation(
    UPDATE_ORDER_CUSTOMER_BY_CODE
  );

  // queries
  const [loadOrderById, { data: orderByIdData }] = useLazyQuery(GET_ORDER, {
    fetchPolicy: "network-only",
  });
  const [
    loadOrdersNow,
    { data: ordersNowData, loading: ordersNowLoading, error: ordersNowError },
  ] = useLazyQuery(ORDERS_BY_RESTAURANT_NOW, { fetchPolicy: "network-only" });
  const [
    loadOrdersAll,
    { data: ordersAllData, loading: ordersAllLoading, error: ordersAllError },
  ] = useLazyQuery(ORDERS_BY_RESTAURANT_ALL, { fetchPolicy: "network-only" });
  const [loadGroupsQuery] = useLazyQuery(ORDERS_GROUPED_BY_TABLE, {
    fetchPolicy: "network-only",
  });

  /* ============================================================
     SOCKET REALTIME EVENTS
     ============================================================ */
  const loadGroupsForTable = useCallback(
    async ({ restaurantId, tableCode }) => {
      if (!restaurantId || !tableCode) return [];

      const { data } = await loadGroupsQuery({
        variables: { restaurantId, tableCode },
      });
      const gs = data?.ordersGroupedByTable || [];
      setGroups(gs);

      // chọn đợt mới nhất
      const latest =
        [...gs].sort((a, b) => {
          const ta = new Date(
            a.orders?.[a.orders.length - 1]?.createdAt || 0
          ).getTime();
          const tb = new Date(
            b.orders?.[b.orders.length - 1]?.createdAt || 0
          ).getTime();
          return tb - ta;
        })[0] || null;

      setActiveGroup(latest);

      // Hydrate currentOrder ở UI bằng gộp món
      if (latest) {
        const merged = mergeGroupItems(latest);
        const uiItems = merged.items.map((i) => ({
          ...i,
          lineSubtotal:
            (Number(i.price || 0) + Number(i.modifiersPrice || 0)) *
            Number(i.quantity || 0),
          isNew: !i.isExisting,
          _lineId: `grp_${latest.orderCode}_${(i.dishId || i.name || "x")
            .toString()
            .slice(0, 6)}_${Math.random().toString(36).slice(2, 5)}`,
        }));
        setCurrentOrder?.(uiItems);
        if (setTableOrders) {
          setTableOrders((prev) => ({ ...prev, [tableCode]: uiItems }));
        }
      } else {
        setCurrentOrder?.([]);
        if (setTableOrders) {
          setTableOrders((prev) => ({ ...prev, [tableCode]: [] }));
        }
      }
      return gs;
    },
    [loadGroupsQuery, setCurrentOrder, setTableOrders]
  );

  useSocketOrder(restaurantId, {
    onAny: async (evt) => {
      const { type, order } = evt || {};
      if (!order) return;

      // Merge into Apollo cache (best-effort)
      try {
        apollo.cache.modify({
          id: apollo.cache.identify({ __typename: "Order", id: order.id }),
          fields: {
            currentStatus: () => order.currentStatus,
            updatedAt: () => order.updatedAt,
            items: () => order.items,
            totals: () => order.totals,
          },
        });
      } catch {}

      // Nếu đang xem theo bàn → reload group để cập nhật gộp món
      if (currentTable?.code && restaurantId) {
        try {
          await loadGroupsForTable({
            restaurantId,
            tableCode: currentTable.code,
          });
        } catch {}
      }

      // Giữ hành vi dọn OrdersNow khi order không còn active
      if (["ORDER_CANCELLED", "ORDER_COMPLETED"].includes(type)) {
        try {
          const now = apollo.readQuery({
            query: ORDERS_BY_RESTAURANT_NOW,
            variables: { restaurantId, limit: 100 },
          });
          if (now?.ordersByRestaurantNow) {
            apollo.writeQuery({
              query: ORDERS_BY_RESTAURANT_NOW,
              variables: { restaurantId, limit: 100 },
              data: {
                ordersByRestaurantNow: {
                  ...now.ordersByRestaurantNow,
                  edges: now.ordersByRestaurantNow.edges.filter(
                    (e) => e.node.id !== order.id
                  ),
                },
              },
            });
          }
        } catch {}
      }
    },
  });

  /* ============================================================
     3) TÍNH TỔNG (theo currentOrder đang hiển thị ở UI)
     ============================================================ */
  useEffect(() => {
    const newTotals = (currentOrder || []).reduce(
      (acc, item) => {
        const q = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const mod = Number(item.modifiersPrice || 0);
        const line =
          item.lineSubtotal != null
            ? Number(item.lineSubtotal)
            : (price + mod) * q;

        acc.subtotal += Number.isFinite(line) ? line : 0;
        return acc;
      },
      { subtotal: 0, discount: 0, tax: 0, service: 0 }
    );

    const base = Math.max(0, newTotals.subtotal - newTotals.discount);
    newTotals.tax = Math.round(base * 0.1);
    newTotals.service = Math.round(base * 0.05);
    newTotals.total =
      newTotals.subtotal -
      newTotals.discount +
      newTotals.tax +
      newTotals.service;

    setTotals(newTotals);
  }, [currentOrder]);

  /* ============================================================
     4) HELPERS
     ============================================================ */

  const makeLineId = useCallback(
    () =>
      `line_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,
    []
  );

  const normalizeOutgoingItem = useCallback((it, idx) => {
    const dishId = it.dishId || it.id || it.dish_id || null;
    const menuId = it.menuId || it.menuItemId || it.menu_id || null;
    const categoryId = it.categoryId || it.category_id || null;

    if (!dishId || !menuId || !categoryId) {
      return {
        _invalid: true,
        _index: idx,
        original: it,
        reason: "missing_ids",
      };
    }

    const unit = it.unit || "portion";
    const rawQty = it.quantity != null ? it.quantity : 1;

    let quantity;
    if (unit === "kg") {
      const f = parseFloat(rawQty);
      if (!Number.isFinite(f) || f <= 0) {
        return {
          _invalid: true,
          _index: idx,
          original: it,
          reason: "qty_invalid_kg",
        };
      }
      quantity = Math.round(f * 10) / 10;
    } else {
      const n = Math.round(Number(rawQty) || 0);
      if (!Number.isFinite(n) || n <= 0) {
        return {
          _invalid: true,
          _index: idx,
          original: it,
          reason: "qty_invalid_portion",
        };
      }
      quantity = n;
    }

    return {
      dishId,
      menuId,
      categoryId,
      name: it.name,
      unit,
      price: Math.round(it.price || 0),
      modifiersPrice: Math.round(it.modifiersPrice || 0),
      method: it.method || it.cookingOption || "",
      note: it.description || it.note || "",
      quantity,
      modifiers: (it.modifiers || []).map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: Math.round(m.price || 0),
      })),
    };
  }, []);

  const writeOrderIntoCache = useCallback(
    (order) => {
      if (!order?.id) return;
      apollo.cache.writeFragment({
        id: apollo.cache.identify({ __typename: "Order", id: order.id }),
        fragment: gql`
          fragment _OrderPatch on Order {
            id
            orderCode
            tableCode
            currentStatus
            restaurantId
            updatedAt
            totals {
              subtotal
              discount
              tax
              service
              grandTotal
            }
            user {
              id
              fullName
            }
            items {
              dishId
              menuId
              categoryId
              name
              unit
              price
              modifiersPrice
              method
              note
              quantity
              status
            }
          }
        `,
        data: { ...order },
      });

      const bumpInConn = (conn) => {
        if (!conn?.edges) return conn;
        return {
          ...conn,
          edges: conn.edges.map((e) =>
            e?.node?.id === order.id
              ? { ...e, node: { ...e.node, ...order } }
              : e
          ),
        };
      };

      try {
        const now = apollo.readQuery({
          query: ORDERS_BY_RESTAURANT_NOW,
          variables: { restaurantId: order.restaurantId, limit: 100 },
        });
        if (now?.ordersByRestaurantNow) {
          apollo.writeQuery({
            query: ORDERS_BY_RESTAURANT_NOW,
            variables: { restaurantId: order.restaurantId, limit: 100 },
            data: {
              ordersByRestaurantNow: bumpInConn(now.ordersByRestaurantNow),
            },
          });
        }
      } catch {}

      try {
        const all = apollo.readQuery({
          query: ORDERS_BY_RESTAURANT_ALL,
          variables: { restaurantId: order.restaurantId, limit: 100 },
        });
        if (all?.ordersByRestaurant) {
          apollo.writeQuery({
            query: ORDERS_BY_RESTAURANT_ALL,
            variables: { restaurantId: order.restaurantId, limit: 100 },
            data: { ordersByRestaurant: bumpInConn(all.ordersByRestaurant) },
          });
        }
      } catch {}
    },
    [apollo]
  );

  /* ============================================================
     5) GỘP MÓN THEO ĐỢT
     ============================================================ */

  const itemSignature = (it) => {
    const mods =
      (it.modifiers || [])
        .map((m) => `${m.groupId || ""}:${m.optionId || m.id || ""}`)
        .sort()
        .join("|") || "";
    const unit = it.unit || "portion";
    const method = it.method || it.cookingOption || "";
    return `${it.dishId || it.id || it.name}-${unit}-${method}-${mods}`;
  };

  /**
   * Gộp items từ nhiều orders (cùng orderCode)
   * - Mark isExisting = true nếu món xuất hiện ở các order TRƯỚC order mới nhất
   */
  const mergeGroupItems = (group) => {
    if (!group?.orders?.length)
      return {
        items: [],
        totals: { subtotal: 0, discount: 0, tax: 0, service: 0, grandTotal: 0 },
      };

    const orders = [...group.orders].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const latestOrderId = orders[orders.length - 1].id;

    const map = new Map();
    const totals = {
      subtotal: 0,
      discount: 0,
      tax: 0,
      service: 0,
      grandTotal: 0,
    };

    for (const ord of orders) {
      const t = ord.totals || {};
      totals.subtotal += Number(t.subtotal || 0);
      totals.discount += Number(t.discount || 0);
      totals.tax += Number(t.tax || 0);
      totals.service += Number(t.service || 0);
      totals.grandTotal += Number(t.grandTotal || 0);

      for (const it of ord.items || []) {
        const key = itemSignature(it);
        const prev = map.get(key) || {
          ...it,
          quantity: 0,
          isExisting: true,
        };
        prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
        if (ord.id === latestOrderId) prev.isExisting = false;
        map.set(key, prev);
      }
    }

    for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
    return { items: Array.from(map.values()), totals };
  };

  /** Tổng gộp của group đang active (dùng cho thanh toán theo đợt) */
  const mergedCurrent = activeGroup
    ? mergeGroupItems(activeGroup)
    : {
        items: [],
        totals: { subtotal: 0, discount: 0, tax: 0, service: 0, grandTotal: 0 },
      };

  /* ============================================================
     7) STATUS HELPERS (ID-based)
     ============================================================ */

  const VALID_ITEM_STATUS = useRef(
    new Set(["pending", "preparing", "ready", "served", "cancelled"])
  );

  const changeOrderStatus = useCallback(
    async ({ restaurantId, orderId, status, note, afterSuccess }) => {
      if (!orderId)
        return { success: false, message: "Thiếu orderId để đổi trạng thái." };

      try {
        const { data } = await mutUpdateOrderStatus({
          variables: {
            input: {
              id: orderId,
              restaurantId: restaurantId || undefined,
              status,
              note,
            },
          },
        });

        const updated = data?.updateOrderStatus || null;
        if (updated) {
          writeOrderIntoCache(updated);

          // nếu đang xem theo bàn, reload group để phản chiếu
          if (currentTable?.code && restaurantId) {
            await loadGroupsForTable({
              restaurantId,
              tableCode: currentTable.code,
            });
          }
        }

        await afterSuccess?.(updated);
        return { success: true, data: updated };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Cập nhật trạng thái đơn thất bại.",
        };
      }
    },
    [
      mutUpdateOrderStatus,
      writeOrderIntoCache,
      currentTable?.code,
      loadGroupsForTable,
    ]
  );

  const changeOrderItemStatus = useCallback(
    async ({ restaurantId, orderId, itemKey, status, note, afterSuccess }) => {
      if (!orderId)
        return { success: false, message: "Thiếu orderId để đổi trạng thái." };
      if (!itemKey && itemKey !== 0)
        return { success: false, message: "Thiếu itemKey." };
      if (!VALID_ITEM_STATUS.current.has(status)) {
        return { success: false, message: "Trạng thái không hợp lệ." };
      }

      // optimistic trong POS UI
      let idx = -1;
      let prevStatus = null;
      if (Array.isArray(currentOrder) && currentOrder.length) {
        idx = currentOrder.findIndex(
          (it, i) =>
            it._lineId === itemKey ||
            it.dishId === itemKey ||
            it.id === itemKey ||
            i === itemKey
        );
        if (idx >= 0) {
          prevStatus = currentOrder[idx]?.status ?? "pending";
          setCurrentOrder((prev) =>
            (prev || []).map((it, i) =>
              i === idx ? { ...it, status, _edited: true } : it
            )
          );
          if (setTableOrders && currentTable?.code) {
            setTableOrders((prev) => ({
              ...prev,
              [currentTable.code]: (prev?.[currentTable.code] || []).map(
                (it, i) => (i === idx ? { ...it, status, _edited: true } : it)
              ),
            }));
          }
        }
      }

      try {
        const { data } = await mutUpdateOrderItemStatus({
          variables: {
            input: {
              orderId,
              restaurantId: restaurantId || undefined,
              itemKey: String(itemKey),
              status,
              note,
            },
          },
        });

        const serverOrder = data?.updateOrderItemStatus?.order || null;
        if (serverOrder) {
          writeOrderIntoCache(serverOrder);
        }

        // reload group nếu đang theo bàn
        if (currentTable?.code && restaurantId) {
          await loadGroupsForTable({
            restaurantId,
            tableCode: currentTable.code,
          });
        }

        await afterSuccess?.(serverOrder);
        return {
          success: true,
          data: serverOrder,
        };
      } catch (err) {
        // revert optimistic
        if (idx >= 0 && prevStatus != null) {
          setCurrentOrder((prev) =>
            (prev || []).map((it, i) =>
              i === idx ? { ...it, status: prevStatus, _edited: false } : it
            )
          );
          if (setTableOrders && currentTable?.code) {
            setTableOrders((prev) => ({
              ...prev,
              [currentTable.code]: (prev?.[currentTable.code] || []).map(
                (it, i) =>
                  i === idx ? { ...it, status: prevStatus, _edited: false } : it
              ),
            }));
          }
        }
        return {
          success: false,
          message: err?.message || "Đổi trạng thái món thất bại.",
        };
      }
    },
    [
      mutUpdateOrderItemStatus,
      currentOrder,
      setCurrentOrder,
      setTableOrders,
      currentTable,
      loadGroupsForTable,
      writeOrderIntoCache,
    ]
  );

  /* Back-compat: old updateItemStatus -> call ID-based mutation */
  const updateItemStatus = useCallback(
    async ({ itemKey, status, restaurantId, orderId, afterSuccess }) => {
      let finalOrderId = orderId || null;

      // Nếu chưa truyền orderId mà activeGroup chỉ có 1 order → đoán
      if (!finalOrderId && activeGroup?.orders?.length === 1) {
        finalOrderId = activeGroup.orders[0].id;
      }

      if (!finalOrderId) {
        return {
          success: false,
          message: "Thiếu orderId để đổi trạng thái món.",
        };
      }

      return changeOrderItemStatus({
        restaurantId,
        orderId: finalOrderId,
        itemKey,
        status,
        note: undefined,
        afterSuccess,
      });
    },
    [changeOrderItemStatus, activeGroup]
  );

  /* ============================================================
     8) CLIENT CRUD (add/update/remove/clear)
     ============================================================ */

  const addToOrder = useCallback(
    ({
      menuItem,
      quantity = 1,
      cookingOption = null,
      unit = null,
      note = "",
      price = null,
    }) => {
      if (!menuItem) return;
      const itemPrice =
        price ??
        menuItem._displayPrice ??
        menuItem.price ??
        menuItem.basePrice ??
        0;
      const chosenUnit = unit || (menuItem.byWeight ? "kg" : "portion");

      let q;
      if (chosenUnit === "kg") {
        const f = parseFloat(quantity);
        q = Number.isFinite(f) && f > 0 ? Math.round(f * 10) / 10 : 0.5;
      } else {
        const n = Math.round(Number(quantity) || 0);
        q = Math.max(1, n);
      }

      const idx = (currentOrder || []).findIndex(
        (it) =>
          !it.isExisting &&
          (it.dishId || it.id) === (menuItem.dishId || menuItem.id) &&
          (it.method || it.cookingOption || "") === (cookingOption || "") &&
          (it.unit || "portion") === (chosenUnit || "portion")
      );

      if (idx !== -1) {
        const updated = [...currentOrder];
        const prev = Number(updated[idx].quantity || 0) || 0;
        const nextQty =
          chosenUnit === "kg"
            ? Math.round((prev + q) * 10) / 10
            : Math.max(1, Math.round(prev + q));

        updated[idx] = {
          ...updated[idx],
          quantity: nextQty,
          lineSubtotal:
            (itemPrice + Number(updated[idx].modifiersPrice || 0)) * nextQty,
          _edited: true,
        };
        setCurrentOrder(updated);
      } else {
        const newItem = {
          _lineId: makeLineId(),
          dishId: menuItem.id,
          menuId: menuItem.menuId,
          categoryId: menuItem.categoryId,
          name: menuItem.name,
          unit: chosenUnit,
          price: Number(itemPrice),
          modifiersPrice: 0,
          method: cookingOption,
          note: note,
          quantity: q,
          lineSubtotal: Number(itemPrice) * q,
          isNew: true,
          isExisting: false,
        };
        setCurrentOrder((prev) => [...(prev || []), newItem]);
      }
    },
    [currentOrder, setCurrentOrder, makeLineId]
  );

  const updateItemQty = useCallback(
    (key, newQty) => {
      setCurrentOrder((prev) =>
        (prev || []).map((it) => {
          if (it._lineId === key || it.dishId === key || it.id === key) {
            const unit = it.unit || "portion";
            let q;
            if (unit === "kg") {
              const f = parseFloat(newQty);
              q = Number.isFinite(f) && f > 0 ? Math.round(f * 10) / 10 : 0.1;
            } else {
              const n = Math.round(Number(newQty) || 0);
              q = Math.max(1, n);
            }
            return {
              ...it,
              quantity: q,
              lineSubtotal:
                (Number(it.price || 0) + Number(it.modifiersPrice || 0)) * q,
              _edited: true,
            };
          }
          return it;
        })
      );
    },
    [setCurrentOrder]
  );

  const removeItem = useCallback(
    (key) => {
      setCurrentOrder((prev) => {
        if (!prev?.length) return prev;

        const byLine = prev.findIndex((it) => it._lineId === key);
        if (byLine !== -1) {
          const removed = prev[byLine];
          if (removed.isExisting) {
            setRemovedExistingItems((s) => [
              ...s,
              removed._lineId || removed.dishId || removed.id,
            ]);
          }
          return prev.filter((_, i) => i !== byLine);
        }

        const byDish = prev.findIndex((it) => it.dishId === key);
        if (byDish !== -1) return prev.filter((_, i) => i !== byDish);

        const byId = prev.findIndex((it) => it.id === key);
        if (byId !== -1) return prev.filter((_, i) => i !== byId);

        return prev;
      });
    },
    [setCurrentOrder]
  );

  const clearAll = useCallback(() => {
    const existingIds = (currentOrder || [])
      .filter((it) => it.isExisting)
      .map((it) => it._lineId || it.dishId || it.id);

    if (existingIds.length > 0) {
      setRemovedExistingItems((s) => [...s, ...existingIds]);
    }

    setCurrentOrder([]);
    if (setTableOrders && currentTable?.code) {
      setTableOrders((prev) => ({ ...prev, [currentTable.code]: [] }));
    }
  }, [currentOrder, setCurrentOrder, setTableOrders, currentTable]);

  /* ============================================================
     9) SAVE / UPSERT (tạo đợt mới, chỉ gửi món mới/đã sửa)
     ============================================================ */

  const saveOrder = useCallback(
    async ({ persist = true, restaurantId, extraCustomer = null } = {}) => {
      if (!currentTable?.code) {
        return { success: false, message: "Vui lòng chọn bàn trước khi lưu." };
      }
      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món ăn nào trong đơn." };
      }
      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId khi lưu order." };
      }

      setTableOrders?.((prev) => ({
        ...prev,
        [currentTable.code]: currentOrder,
      }));

      if (!persist) {
        return {
          success: true,
          message: `Đã lưu tạm đơn vào bàn ${currentTable.code}`,
        };
      }

      // Chỉ gửi món MỚI hoặc đã chỉnh sửa (đợt mới)
      const outgoing = [];
      const skipped = [];
      (currentOrder || []).forEach((it, idx) => {
        if (it.isExisting && !it._edited && !it.isNew) return; // bỏ món cũ không đổi
        const n = normalizeOutgoingItem(it, idx);
        if (n._invalid) skipped.push(n);
        else outgoing.push(n);
      });

      if (!outgoing.length) {
        return {
          success: true,
          message: "Không có thay đổi để lưu.",
          skipped,
          data: { id: null },
        };
      }

      try {
        const res = await createOrAppendOrder({
          variables: {
            input: {
              restaurantId,
              tableCode: currentTable.code,
              orderCode:
                activeGroup?.orderCode || currentTable.orderCode || null,
              items: outgoing,
              note: orderNote,
              customer: extraCustomer,
              clientMeta: {
                savedAt: new Date().toISOString(),
                ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
              },
            },
          },
        });

        const serverOrder = res?.data?.createOrAppendTableOrder?.order || null;

        // Sau khi tạo đợt mới → reload groups để gộp hiển thị
        await loadGroupsForTable({
          restaurantId,
          tableCode: currentTable.code,
        });

        if (serverOrder) writeOrderIntoCache(serverOrder);

        return {
          success: true,
          message: skipped.length
            ? `Đã lưu đợt mới. Bỏ qua ${skipped.length} món không hợp lệ (đơn vị/số lượng).`
            : "Đã lưu đợt mới lên server.",
          skipped,
          data: serverOrder,
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [
      currentOrder,
      currentTable,
      orderNote,
      createOrAppendOrder,
      setTableOrders,
      normalizeOutgoingItem,
      activeGroup?.orderCode,
      loadGroupsForTable,
      writeOrderIntoCache,
    ]
  );

  /* ============================================================
     10) PAYMENT FLOW
     ============================================================ */

  // Chuẩn bị thanh toán: nếu đang theo đợt, dùng tổng gộp theo group
  const preparePayment = useCallback(
    async ({ restaurantId } = {}) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };

      // Nếu đã có group đang active (đã có orderCode) → không cần tạo/đoán orderId
      if (activeGroup?.orderCode) {
        return {
          success: true,
          data: {
            orderCode: activeGroup.orderCode,
            tableCode: activeGroup.tableCode,
            items: mergedCurrent.items,
            totals: mergedCurrent.totals,
          },
        };
      }

      // Fallback legacy: lưu và thanh toán theo 1 order
      if (!currentOrder?.length)
        return { success: false, message: "Chưa có món để thanh toán." };

      const saved = await saveOrder({ persist: true, restaurantId });
      if (!saved?.success) return saved;

      const orderId = saved?.data?.id || saved?.data?._id || null;
      lastPreparedOrderIdRef.current = orderId ?? null;

      return {
        success: true,
        data: { orderId, items: currentOrder, totals },
      };
    },
    [activeGroup?.orderCode, mergedCurrent, currentOrder, totals, saveOrder]
  );

  const validatePayment = useCallback(
    ({ method = "cash", paidAmount = 0, total } = {}) => {
      const t = Number(total ?? totals.total ?? 0);
      if (!(t > 0))
        return { ok: false, message: "Tổng cần thanh toán không hợp lệ." };
      if (method === "cash") {
        const p = Number(paidAmount || 0);
        if (!(p >= t))
          return { ok: false, message: "Tiền mặt khách đưa phải ≥ tổng tiền." };
      }
      return { ok: true };
    },
    [totals.total]
  );

  // Thanh toán: ưu tiên theo orderCode (đợt), nếu chưa có thì fallback orderId (legacy)
  const confirmPayment = useCallback(
    async ({
      restaurantId,
      method = "cash",
      paidAmount = 0,
      note = "",
      externalRef = null,
    } = {}) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };

      // CASE 1: Có orderCode → payOrdersByCode
      if (activeGroup?.orderCode) {
        const grand = Number(mergedCurrent.totals.grandTotal || 0);
        const valid = validatePayment({ method, paidAmount, total: grand });
        if (!valid.ok) return { success: false, message: valid.message };

        const paid = method === "cash" ? Number(paidAmount || 0) : grand;
        const idempotency =
          externalRef ||
          `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        try {
          const { data } = await mutPayByCode({
            variables: {
              input: {
                restaurantId,
                orderCode: activeGroup.orderCode,
                paidAmount: paid,
                method,
                note,
                externalRef: idempotency,
              },
            },
          });

          // Reload group sau khi thanh toán (bàn có thể trống)
          if (currentTable?.code) {
            await loadGroupsForTable({
              restaurantId,
              tableCode: currentTable.code,
            });
          }

          return { success: true, data: data?.payOrdersByCode };
        } catch (err) {
          return {
            success: false,
            message: err?.message || "Thanh toán theo đợt thất bại.",
          };
        }
      }

      // CASE 2: Legacy — theo orderId
      const valid = validatePayment({
        method,
        paidAmount,
        total: totals.total,
      });
      if (!valid.ok) return { success: false, message: valid.message };

      let orderId = lastPreparedOrderIdRef.current;
      if (!orderId) {
        const saved = await saveOrder({ persist: true, restaurantId });
        if (!saved?.success) return saved;
        orderId = saved?.data?.id || saved?.data?._id || null;
        lastPreparedOrderIdRef.current = orderId ?? null;
      }
      if (!orderId) {
        return {
          success: false,
          message: "Không lấy được orderId để thanh toán.",
        };
      }

      const amountToCharge = Number(totals.total || 0);
      const paid = method === "cash" ? Number(paidAmount || 0) : amountToCharge;
      const idempotency =
        externalRef ||
        `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const { data } = await mutPayOrder({
          variables: {
            input: {
              orderId,
              restaurantId,
              paidAmount: paid,
              method,
              note,
              externalRef: idempotency,
            },
          },
        });

        const paidOrder = data?.payOrder?.order || null;
        if (paidOrder) writeOrderIntoCache(paidOrder);
        try {
          await loadOrderById({ variables: { id: orderId } });
        } catch {}
        return { success: true, data: data?.payOrder };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Thanh toán thất bại.",
        };
      }
    },
    [
      activeGroup?.orderCode,
      mergedCurrent,
      validatePayment,
      totals.total,
      saveOrder,
      mutPayOrder,
      mutPayByCode,
      loadOrderById,
      writeOrderIntoCache,
      currentTable?.code,
      loadGroupsForTable,
    ]
  );

  const checkoutOrder = useCallback(
    async ({
      restaurantId,
      method = "cash",
      note = "",
      externalRef = null,
    } = {}) => {
      const prep = await preparePayment({ restaurantId });
      if (!prep?.success) return prep;

      // Nếu đã có orderCode (đợt) → dùng tổng gộp của group
      if (prep?.data?.orderCode) {
        const grand = Number(prep.data.totals?.grandTotal || 0);
        return confirmPayment({
          restaurantId,
          method,
          paidAmount: method === "cash" ? grand : 0,
          note,
          externalRef,
        });
      }

      // Fallback legacy
      return confirmPayment({
        restaurantId,
        method,
        paidAmount: method === "cash" ? totals.total : 0,
        note,
        externalRef,
      });
    },
    [preparePayment, confirmPayment, totals.total]
  );

  /* ============================================================
     11) FETCH tiện ích (giữ lại cho tương thích)
     ============================================================ */

  const fetchOrderByTable = useCallback(
    async (restaurantId, tableCode, limit = 10, cursor = null) => {
      if (!restaurantId || !tableCode) {
        return { success: false, message: "missing restaurantId/tableCode" };
      }
      const res = await loadOrdersNow({
        variables: { restaurantId, limit, cursor },
      });
      const edges = res?.data?.ordersByRestaurantNow?.edges || [];
      const matched = edges
        .map((e) => e.node)
        .filter(
          (o) => (o.tableCode || "").toLowerCase() === tableCode.toLowerCase()
        );

      const normalized = matched.map((ord) => ({
        ...ord,
        items: (ord.items || []).map((it) => ({
          ...it,
          lineSubtotal:
            (Number(it.price || 0) + Number(it.modifiersPrice || 0)) *
            Number(it.quantity || 0),
          isExisting: true,
          isNew: false,
          _lineId: `srv_${ord.id}_${(it.dishId || it.name || "x")
            .toString()
            .slice(0, 6)}_${Math.random().toString(36).slice(2, 5)}`,
        })),
      }));
      return {
        success: true,
        data: normalized,
        pageInfo: res?.data?.ordersByRestaurantNow?.pageInfo,
      };
    },
    [loadOrdersNow]
  );

  const fetchOrderById = useCallback(
    async (id) => {
      if (!id) return { success: false, message: "Missing order ID" };
      try {
        const res = await loadOrderById({ variables: { id } });
        const order = res?.data?.order ?? null;
        return { success: true, data: order };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [loadOrderById]
  );

  /* ============================================================
     12) CUSTOMER helpers
     ============================================================ */

  // Dùng khi đã biết orderCode
  const updateOrderCustomerByCode = useCallback(
    async ({ restaurantId, orderCode, customer }) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };
      if (!orderCode) return { success: false, message: "Thiếu orderCode." };

      const clean = {
        fullName: (customer?.fullName || "").trim(),
        phone: (customer?.phone || "").trim(),
        email: (customer?.email || "").trim().toLowerCase(),
      };

      try {
        const { data } = await mutUpdateOrderCustomerByCode({
          variables: { input: { restaurantId, orderCode, customer: clean } },
        });
        const ok = data?.updateOrderCustomerByCode?.success;
        // reload group để phản ánh khách hàng
        if (ok && currentTable?.code) {
          await loadGroupsForTable({
            restaurantId,
            tableCode: currentTable.code,
          });
        }
        return { success: !!ok, data: data?.updateOrderCustomerByCode };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Cập nhật khách vào đơn thất bại.",
        };
      }
    },
    [mutUpdateOrderCustomerByCode, currentTable?.code, loadGroupsForTable]
  );

  // Dùng khi chưa biết orderCode → thử tìm theo bàn
  const attachCustomerToOrder = useCallback(
    async (...args) => {
      let tableCode = null;
      let customer = null;

      if (args.length === 2) {
        tableCode = args[0];
        customer = args[1];
      } else {
        customer = args[0];
        tableCode = currentTable?.code || null;
      }

      const clean = {
        fullName: (customer?.fullName || customer?.name || "").trim(),
        phone: (customer?.phone || "").trim(),
        email: (customer?.email || "").trim().toLowerCase(),
      };

      if (tableCode && setTableOrders) {
        setTableOrders((prev) => ({
          ...prev,
          [tableCode]: { ...(prev?.[tableCode] || {}), customer: clean },
        }));
      }

      let orderCode = activeGroup?.orderCode || currentTable?.orderCode || null;

      if (!orderCode && tableCode && restaurantId && fetchOrderByTable) {
        try {
          const r = await fetchOrderByTable(restaurantId, tableCode);
          orderCode = r?.data?.[0]?.orderCode || null;
        } catch {}
      }

      if (orderCode && restaurantId) {
        return updateOrderCustomerByCode({
          restaurantId,
          orderCode,
          customer: clean,
        });
      }

      return {
        success: true,
        message:
          "Đã lưu thông tin khách tạm thời, sẽ đẩy lên server khi có order.",
      };
    },
    [
      currentTable?.orderCode,
      currentTable?.code,
      restaurantId,
      setTableOrders,
      fetchOrderByTable,
      updateOrderCustomerByCode,
      activeGroup?.orderCode,
    ]
  );

  /* ============================================================
     13) RETURN
     ============================================================ */

  const ordersNow =
    ordersNowData?.ordersByRestaurantNow?.edges?.map((e) => e.node) || [];
  const ordersAll =
    ordersAllData?.ordersByRestaurant?.edges?.map((e) => e.node) || [];

  // Back-compat aliases
  const loadOrders = loadOrdersNow;
  const orders = ordersNow;
  const ordersLoading = ordersNowLoading;
  const ordersError = ordersNowError;

  return {
    // state
    currentOrder,
    totals,
    orderNote,
    setOrderNote,

    // batch groups
    groups,
    activeGroup,
    setActiveGroup,
    mergedCurrent, // { items, totals } đã gộp theo đợt
    loadGroupsForTable,

    // crud
    addToOrder,
    updateItemQty,
    removeItem,
    clearAll,
    saveOrder,

    // status by ID
    changeOrderStatus,
    changeOrderItemStatus,

    // Back-compat API (giờ cũng dùng ID)
    updateItemStatus,

    // fetch
    fetchOrderByTable,
    fetchOrderById,

    // NOW vs ALL
    loadOrdersNow,
    loadOrdersAll,
    ordersNow,
    ordersAll,
    ordersLoading,
    ordersAllLoading,
    ordersError,
    ordersAllError,

    // single order cache & loader
    orderById: orderByIdData?.order ?? null,
    loadOrders,
    orders,

    // payment API for UI (ưu tiên theo đợt)
    preparePayment,
    validatePayment,
    confirmPayment,
    checkoutOrder,
    payLoading: payLoadingLegacy || payLoadingByCode,

    // customer
    updateOrderCustomerByCode,
    attachCustomerToOrder,
  };
}
