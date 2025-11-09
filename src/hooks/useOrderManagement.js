import { useState, useEffect, useCallback, useRef } from "react";
import {
  useMutation,
  useLazyQuery,
  useApolloClient,
  gql,
} from "@apollo/client";

/* ============================================================
   1) GRAPHQL
   ============================================================ */

// Upsert table order
const UPSERT_TABLE_ORDER = gql`
  mutation UpsertTableOrder($input: UpsertTableOrderInput!) {
    upsertTableOrder(input: $input) {
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

/** ✅ ONLY “current” orders (exclude cancelled & completed) */
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

/** ✅ FULL history (includes cancelled & completed) */
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

// Single order
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

// Pay
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
      invoice {
        id
        number
        status
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        paid
        issuedAt
      }
      transaction {
        id
        paidAmount
        method
        status
        paidAt
      }
      cashflow {
        id
        amount
        type

        occurredAt
      }
    }
  }
`;

/* === Status mutations by orderCode === */
const UPDATE_ORDER_STATUS_BY_CODE = gql`
  mutation UpdateOrderStatusByCode($input: UpdateOrderStatusByCodeInput!) {
    updateOrderStatusByCode(input: $input) {
      order {
        id
        orderCode
        currentStatus
        updatedAt
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        items {
          dishId
          name
          status
          price
          modifiersPrice
          quantity
          method
          note
        }
      }
    }
  }
`;

const UPDATE_ORDER_ITEM_STATUS_BY_CODE = gql`
  mutation UpdateOrderItemStatusByCode(
    $input: UpdateOrderItemStatusByCodeInput!
  ) {
    updateOrderItemStatusByCode(input: $input) {
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
        updatedAt
      }
    }
  }
`;

/* === NEW: update order.user by orderCode (attach customer) === */
const UPDATE_ORDER_CUSTOMER_BY_CODE = gql`
  mutation UpdateOrderCustomerByCode($input: UpdateOrderCustomerByCodeInput!) {
    updateOrderCustomerByCode(input: $input) {
      order {
        id
        orderCode
        tableCode
        restaurantId
        user {
          id
          fullName
        }
        updatedAt
      }
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

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    total: 0,
  });
  const [orderNote, setOrderNote] = useState("");
  const [removedExistingItems, setRemovedExistingItems] = useState([]);

  // Keep last prepared orderId for confirmPayment (avoid double save)
  const lastPreparedOrderIdRef = useRef(null);

  // apollo mutations
  const [upsertTableOrder] = useMutation(UPSERT_TABLE_ORDER);
  const [mutPayOrder, { loading: payLoading }] = useMutation(PAY_ORDER);
  const [mutUpdateOrderStatusByCode] = useMutation(UPDATE_ORDER_STATUS_BY_CODE);
  const [mutUpdateOrderItemStatusByCode] = useMutation(
    UPDATE_ORDER_ITEM_STATUS_BY_CODE
  );
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

  /* ============================================================
     3) TÍNH TỔNG
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
      method: it.method || "",
      note: it.description || it.note || "",
      quantity,
      modifiers: (it.modifiers || []).map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: Math.round(m.price || 0),
      })),
      status: it.status ?? "pending",
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
     5) STATUS HELPERS
     ============================================================ */
  const VALID_ITEM_STATUS = useRef(
    new Set(["pending", "preparing", "ready", "served", "cancelled"])
  );

  const changeOrderStatusByCode = useCallback(
    async ({ restaurantId, orderCode, status, note, afterSuccess }) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };
      if (!orderCode) return { success: false, message: "Thiếu orderCode." };

      try {
        const { data } = await mutUpdateOrderStatusByCode({
          variables: { input: { restaurantId, orderCode, status, note } },
        });

        const updated = data?.updateOrderStatusByCode?.order || null;

        if (updated) writeOrderIntoCache(updated);

        await afterSuccess?.(updated);
        return { success: true, data: updated };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Cập nhật trạng thái đơn thất bại.",
        };
      }
    },
    [mutUpdateOrderStatusByCode, writeOrderIntoCache]
  );

  const changeOrderItemStatusByCode = useCallback(
    async ({
      restaurantId,
      orderCode,
      itemKey,
      status,
      note,
      afterSuccess,
    }) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };
      if (!orderCode) return { success: false, message: "Thiếu orderCode." };
      if (!itemKey && itemKey !== 0)
        return { success: false, message: "Thiếu itemKey." };
      if (!VALID_ITEM_STATUS.current.has(status)) {
        return { success: false, message: "Trạng thái không hợp lệ." };
      }

      // optimistic for POS state
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
        const { data } = await mutUpdateOrderItemStatusByCode({
          variables: {
            input: {
              restaurantId,
              orderCode,
              itemKey: String(itemKey),
              status,
              note,
            },
          },
        });

        const serverOrder = data?.updateOrderItemStatusByCode?.order || null;

        if (serverOrder) {
          const normalized = (serverOrder.items || []).map((i) => ({
            ...i,
            lineSubtotal:
              (Number(i.price || 0) + Number(i.modifiersPrice || 0)) *
              Number(i.quantity || 1),
            isExisting: true,
            isNew: false,
            _lineId: `srv_${serverOrder.id}_${(i.dishId || i.name || "x")
              .toString()
              .slice(0, 6)}_${Math.random().toString(36).slice(2, 5)}`,
          }));

          if (setCurrentOrder) setCurrentOrder(normalized);
          if (setTableOrders && currentTable?.code) {
            setTableOrders((prev) => ({
              ...prev,
              [currentTable.code]: normalized,
            }));
          }

          writeOrderIntoCache(serverOrder);
        }

        await afterSuccess?.(serverOrder);
        return { success: true, data: serverOrder };
      } catch (err) {
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
      mutUpdateOrderItemStatusByCode,
      currentOrder,
      setCurrentOrder,
      setTableOrders,
      currentTable,
      writeOrderIntoCache,
    ]
  );

  /* Back-compat: old updateItemStatus -> call new mutation */
  const updateItemStatus = useCallback(
    async ({ itemKey, status, restaurantId, orderCode, afterSuccess }) => {
      let finalOrderCode = orderCode;
      if (!finalOrderCode && currentTable?.orderCode) {
        finalOrderCode = currentTable.orderCode;
      }
      if (!finalOrderCode) {
        return {
          success: false,
          message: "Thiếu orderCode để đổi trạng thái món.",
        };
      }

      return changeOrderItemStatusByCode({
        restaurantId,
        orderCode: finalOrderCode,
        itemKey,
        status,
        note: undefined,
        afterSuccess,
      });
    },
    [changeOrderItemStatusByCode, currentTable?.orderCode]
  );

  /* ============================================================
     6) CLIENT CRUD (add/update/remove/clear)
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
     7) SAVE / UPSERT
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

      const outgoing = [];
      const skipped = [];
      const useReplace =
        removedExistingItems && removedExistingItems.length > 0;

      if (useReplace) {
        (currentOrder || []).forEach((it, idx) => {
          const n = normalizeOutgoingItem(it, idx);
          if (n._invalid) skipped.push(n);
          else outgoing.push(n);
        });

        if (!outgoing.length) {
          return {
            success: false,
            message:
              "Không thể lưu: tất cả món không hợp lệ sau khi xoá/sửa (kiểm tra số lượng/đơn vị).",
            skipped,
          };
        }
      } else {
        (currentOrder || []).forEach((it, idx) => {
          if (it.isExisting && !it._edited && !it.isNew) return;
          const n = normalizeOutgoingItem(it, idx);
          if (n._invalid) skipped.push(n);
          else outgoing.push(n);
        });

        if (!outgoing.length) {
          const guessedId =
            currentOrder?.[0]?.orderId || currentOrder?.[0]?.id || null;

          if (guessedId) {
            return {
              success: true,
              message: "Không có thay đổi. Dùng order hiện có.",
              skipped,
              data: { id: guessedId },
            };
          }

          try {
            const res = await loadOrdersNow({
              variables: { restaurantId, limit: 10, cursor: null },
              fetchPolicy: "network-only",
            });

            const edges = res?.data?.ordersByRestaurantNow?.edges || [];
            const matched = edges
              .map((e) => e.node)
              .filter(
                (o) =>
                  (o.tableCode || "").toLowerCase() ===
                  (currentTable?.code || "").toLowerCase()
              );

            if (matched?.length) {
              return {
                success: true,
                message: "Không có thay đổi. Dùng order hiện có.",
                skipped,
                data: matched[0],
              };
            }
          } catch {
            // ignore
          }

          return {
            success: true,
            message:
              "Không có thay đổi để lưu. Tiếp tục thanh toán với order hiện có.",
            skipped,
            data: { id: null },
          };
        }
      }

      try {
        const res = await upsertTableOrder({
          variables: {
            input: {
              restaurantId,
              tableCode: currentTable.code,
              orderCode: currentTable.orderCode || null,
              items: outgoing,
              replaceItems: useReplace || undefined,
              note: orderNote,
              customer: extraCustomer, // có thể undefined nếu bàn reserved
              clientMeta: {
                savedAt: new Date().toISOString(),
                ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
              },
            },
          },
        });

        const serverOrder = res?.data?.upsertTableOrder?.order || null;

        if (serverOrder) {
          const normalized = (serverOrder.items || []).map((i) => ({
            ...i,
            lineSubtotal:
              (Number(i.price || 0) + Number(i.modifiersPrice || 0)) *
              Number(i.quantity || 1),
            isExisting: true,
            isNew: false,
            _lineId: `srv_${serverOrder.id}_${(i.dishId || i.name || "x")
              .toString()
              .slice(0, 6)}_${Math.random().toString(36).slice(2, 5)}`,
          }));
          setCurrentOrder(normalized);
          setTableOrders?.((prev) => ({
            ...prev,
            [currentTable.code]: normalized,
          }));
          setRemovedExistingItems([]);

          writeOrderIntoCache(serverOrder);
        }

        return {
          success: true,
          message: skipped.length
            ? `Đã lưu đơn. Bỏ qua ${skipped.length} món không hợp lệ (đơn vị/số lượng).`
            : "Đã lưu đơn lên server.",
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
      upsertTableOrder,
      setTableOrders,
      setCurrentOrder,
      removedExistingItems,
      setRemovedExistingItems,
      normalizeOutgoingItem,
      loadOrdersNow,
      writeOrderIntoCache,
    ]
  );

  /* ============================================================
     8) PAYMENT FLOW
     ============================================================ */

  const preparePayment = useCallback(
    async ({ restaurantId } = {}) => {
      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId." };
      }
      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món để thanh toán." };
      }

      const saved = await saveOrder({ persist: true, restaurantId });
      if (!saved?.success) return saved;

      const orderId = saved?.data?.id || saved?.data?._id || null;
      lastPreparedOrderIdRef.current = orderId ?? null;

      return {
        success: true,
        data: { orderId, items: currentOrder, totals },
      };
    },
    [saveOrder, currentOrder, totals]
  );

  const validatePayment = useCallback(
    ({ method = "cash", paidAmount = 0, total = totals.total } = {}) => {
      const t = Number(total || 0);
      if (!(t > 0))
        return { ok: false, message: "Tổng cần thanh toán không hợp lệ." };

      if (method === "cash") {
        const p = Number(paidAmount || 0);
        if (!(p >= t)) {
          return { ok: false, message: "Tiền mặt khách đưa phải ≥ tổng tiền." };
        }
      }
      return { ok: true };
    },
    [totals.total]
  );

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
      validatePayment,
      totals.total,
      saveOrder,
      mutPayOrder,
      loadOrderById,
      writeOrderIntoCache,
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
     9) FETCH
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
     10) ATTACH / UPDATE CUSTOMER (NEW)
     ============================================================ */

  // Dùng khi đã biết orderCode để tránh gọi OrdersByRestaurantNow
  const updateOrderCustomerByCode = useCallback(
    async ({ restaurantId, orderCode, customer }) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };
      if (!orderCode) return { success: false, message: "Thiếu orderCode." };

      const clean = {
        fullName: (customer?.fullName || customer?.name || "").trim(),
        phone: (customer?.phone || "").trim(),
        email: (customer?.email || "").trim().toLowerCase(),
      };

      try {
        const { data } = await mutUpdateOrderCustomerByCode({
          variables: { input: { restaurantId, orderCode, customer: clean } },
        });
        const srv = data?.updateOrderCustomerByCode?.order || null;
        if (srv) writeOrderIntoCache(srv);
        return { success: true, data: srv };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Cập nhật khách vào đơn thất bại.",
        };
      }
    },
    [mutUpdateOrderCustomerByCode, writeOrderIntoCache]
  );

  // Dùng khi chưa biết orderCode → có thể phát sinh 1 lần OrdersByRestaurantNow
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

      // Nếu đã có orderCode hiện tại
      let orderCode = currentTable?.orderCode || null;

      if (!orderCode && tableCode && restaurantId && fetchOrderByTable) {
        try {
          const r = await fetchOrderByTable(restaurantId, tableCode, 1, 0);
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
    ]
  );

  /* ============================================================
     11) RETURN
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

    // crud
    addToOrder,
    updateItemQty,
    removeItem,
    clearAll,
    saveOrder,

    // status by code
    changeOrderStatusByCode,
    changeOrderItemStatusByCode,

    // Back-compat API
    updateItemStatus,

    // handler factories
    makeItemStatusHandler: useCallback(
      ({ orderRef, setOrder, restaurantId, orderCode }) => {
        return async (itemKey, nextStatus, note) => {
          const res = await changeOrderItemStatusByCode({
            restaurantId,
            orderCode,
            itemKey,
            status: nextStatus,
            note,
            afterSuccess: (srv) => {
              if (srv && typeof setOrder === "function") setOrder(srv);
            },
          });
          return res;
        };
      },
      [changeOrderItemStatusByCode]
    ),
    makeOrderStatusHandler: useCallback(
      ({ orderRef, setOrder, restaurantId, orderCode }) => {
        return async (nextStatus, note) => {
          const res = await changeOrderStatusByCode({
            restaurantId,
            orderCode,
            status: nextStatus,
            note,
            afterSuccess: (srv) => {
              if (srv && typeof setOrder === "function") setOrder(srv);
            },
          });
          return res;
        };
      },
      [changeOrderStatusByCode]
    ),

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

    // payment API for UI
    preparePayment,
    validatePayment,
    confirmPayment,
    checkoutOrder,
    payLoading,

    // NEW
    updateOrderCustomerByCode,
    attachCustomerToOrder,
  };
}
