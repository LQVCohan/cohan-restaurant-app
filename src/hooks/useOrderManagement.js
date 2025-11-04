// src/hooks/useOrderManagement.js
import { useState, useEffect, useCallback } from "react";
import { useMutation, useLazyQuery, gql } from "@apollo/client";

/* ============================================================
   1) GRAPHQL
   ============================================================ */

// ✅ mutation POS chính
const UPSERT_TABLE_ORDER = gql`
  mutation UpsertTableOrder($input: UpsertTableOrderInput!) {
    upsertTableOrder(input: $input) {
      isNewOrder
      order {
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
          description
          quantity
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
  }
`;

// ❗ Lúc nãy bạn chỉ lấy 3 field → phải lấy FULL để về client đủ data
const ORDERS_BY_RESTAURANT = gql`
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
          items {
            dishId
            menuId
            categoryId
            name
            unit
            price
            modifiersPrice
            method
            description
            quantity
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
          user {
            id
            fullName
          }
          orderCode
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
        description
        quantity
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
      user {
        id
        fullName
        email
      }
    }
  }
`;

/* ============================================================
   2) HOOK
   ============================================================ */

export default function useOrderManagement(pos = null) {
  const { currentOrder, setCurrentOrder, currentTable, setTableOrders } =
    pos ?? {};

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    total: 0,
  });
  const [orderNote, setOrderNote] = useState("");
  // track existing items removed on client so save can request replacement
  // (server currently appends items; replaceItems=true forces replace)
  const [removedExistingItems, setRemovedExistingItems] = useState([]);

  // mutations / queries
  const [upsertTableOrder] = useMutation(UPSERT_TABLE_ORDER);

  const [loadOrderById, { data: orderByIdData }] = useLazyQuery(GET_ORDER, {
    fetchPolicy: "network-only",
  });

  const [
    loadOrders,
    { data: ordersData, loading: ordersLoading, error: ordersError },
  ] = useLazyQuery(ORDERS_BY_RESTAURANT, {
    fetchPolicy: "network-only",
  });

  /* ============================================================
     3) TÍNH TỔNG
     ============================================================ */
  useEffect(() => {
    const newTotals = (currentOrder || []).reduce(
      (acc, item) => {
        const line =
          item.lineSubtotal != null
            ? Number(item.lineSubtotal)
            : (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
              Number(item.quantity || 0);

        acc.subtotal += line;
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

  // tạo id dòng để xóa/chỉnh đúng item
  const makeLineId = useCallback(
    () =>
      `line_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,
    []
  );

  // chuẩn hóa 1 item TRƯỚC KHI GỬI LÊN SERVER
  const normalizeOutgoingItem = useCallback((it, idx) => {
    const dishId = it.dishId || it.id || it.dish_id || null;
    const menuId = it.menuId || it.menuItemId || it.menu_id || null;
    const categoryId = it.categoryId || it.category_id || null;

    if (!dishId || !menuId || !categoryId) {
      // đánh dấu để bỏ, vì server sẽ báo lỗi
      return {
        _invalid: true,
        _index: idx,
        original: it,
      };
    }

    return {
      dishId,
      menuId,
      categoryId,
      name: it.name,
      unit: it.unit || "portion",
      price: Math.round(it.price || 0),
      modifiersPrice: Math.round(it.modifiersPrice || 0),
      method: it.method || "",
      description: it.description || "",
      quantity: Number(it.quantity || 1),
      modifiers: (it.modifiers || []).map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: Math.round(m.price || 0),
      })),
    };
  }, []);

  /* ============================================================
     5) CRUD CLIENT
     ============================================================ */

  // thêm món từ menu/modal
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

      // cố gắng gộp nếu là món cùng cấu hình
      // IMPORTANT: only merge into unsaved/new items so the UI can show
      // saved items (isExisting) separately. New additions should appear
      // under the "Mới" group (isNew) and only be merged into saved
      // items after a successful save that returns the server order.
      const idx = currentOrder.findIndex(
        (it) =>
          !it.isExisting && // only merge into items that are not yet saved
          (it.dishId || it.id) === (menuItem.dishId || menuItem.id) &&
          (it.method || it.cookingOption || "") === (cookingOption || "") &&
          (it.unit || "portion") === (unit || "portion")
      );

      if (idx !== -1) {
        const updated = [...currentOrder];
        const nextQty = Number(updated[idx].quantity || 0) + Number(quantity);
        // preserve existing server identifiers; mark as edited so it will
        // be sent to server in the outgoing delta payload.
        updated[idx] = {
          ...updated[idx],
          quantity: nextQty,
          lineSubtotal:
            (itemPrice + Number(updated[idx].modifiersPrice || 0)) * nextQty,
          _edited: true,
          // keep isExisting/isNew flags as they were (if it was saved, it stays saved)
        };
        setCurrentOrder(updated);
      } else {
        const newItem = {
          _lineId: makeLineId(),
          dishId: menuItem.id,
          menuId: menuItem.menuId,
          categoryId: menuItem.categoryId,
          name: menuItem.name,
          unit: unit || (menuItem.byWeight ? "kg" : "portion"),
          price: Number(itemPrice),
          modifiersPrice: 0,
          method: cookingOption,
          description: note,
          quantity: Number(quantity || 1),
          lineSubtotal: Number(itemPrice) * Number(quantity || 1),
          isNew: true,
          isExisting: false,
        };
        setCurrentOrder((prev) => [...(prev || []), newItem]);
      }
    },
    [currentOrder, setCurrentOrder, makeLineId]
  );

  // cập nhật số lượng
  const updateItemQty = useCallback(
    (key, newQty) => {
      const q = Math.max(1, Number(newQty) || 1);
      setCurrentOrder((prev) =>
        (prev || []).map((it) => {
          if (it._lineId === key || it.dishId === key || it.id === key) {
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

  // xóa 1 item
  const removeItem = useCallback(
    (key) => {
      setCurrentOrder((prev) => {
        if (!prev?.length) return prev;

        // 1) xóa theo lineId (chuẩn nhất)
        const byLine = prev.findIndex((it) => it._lineId === key);
        if (byLine !== -1) {
          const removed = prev[byLine];
          // if removed item was existing on server, track it so we can
          // request a full replace on save to remove it on server.
          if (removed.isExisting) {
            setRemovedExistingItems((s) => [
              ...s,
              removed._lineId || removed.dishId || removed.id,
            ]);
          }
          return prev.filter((_, i) => i !== byLine);
        }

        // 2) xóa theo dishId (nếu món mới chưa có _lineId)
        const byDish = prev.findIndex((it) => it.dishId === key);
        if (byDish !== -1) return prev.filter((_, i) => i !== byDish);

        // 3) xóa theo id (phòng trường hợp item.id)
        const byId = prev.findIndex((it) => it.id === key);
        if (byId !== -1) return prev.filter((_, i) => i !== byId);

        // 4) fallback: không match key nào → thôi không xóa
        return prev;
      });
    },
    [setCurrentOrder]
  );

  // clear all items on the client for the current table while tracking
  // any existing (server-sourced) items so saveOrder can request a replace
  const clearAll = useCallback(() => {
    // collect identifiers of existing items
    const existingIds = (currentOrder || [])
      .filter((it) => it.isExisting)
      .map((it) => it._lineId || it.dishId || it.id);

    if (existingIds.length > 0) {
      setRemovedExistingItems((s) => [...s, ...existingIds]);
    }

    // clear client order and local tableOrders mapping
    setCurrentOrder([]);
    if (setTableOrders && currentTable?.code) {
      setTableOrders((prev) => ({ ...prev, [currentTable.code]: [] }));
    }
  }, [currentOrder, setCurrentOrder, setTableOrders, currentTable]);

  /* ============================================================
     6) SAVE / UPSERT
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

      // lưu xuống map local trước
      setTableOrders((prev) => ({
        ...prev,
        [currentTable.code]: currentOrder,
      }));

      if (!persist) {
        return {
          success: true,
          message: `Đã lưu tạm đơn vào bàn ${currentTable.code}`,
        };
      }

      // chuẩn hóa từng item để đảm bảo có đủ 3 trường
      const outgoing = [];
      const skipped = [];

      // If deletions of existing items occurred, we must send the full
      // desired items list and request a replace on the server so the
      // server will remove deleted lines. Otherwise we can continue with
      // delta behavior (send only new/edited items to append).
      const useReplace =
        removedExistingItems && removedExistingItems.length > 0;

      if (useReplace) {
        // Build full outgoing list from currentOrder (client's desired final state)
        (currentOrder || []).forEach((it, idx) => {
          const n = normalizeOutgoingItem(it, idx);
          if (n._invalid) skipped.push(n);
          else outgoing.push(n);
        });

        if (!outgoing.length) {
          // server schema requires at least one item when creating/updating an order.
          return {
            success: false,
            message:
              "Không thể lưu: danh sách món trống sau khi xóa. Nếu bạn muốn huỷ đơn, hãy dùng hủy order.",
            skipped,
          };
        }
      } else {
        // delta behavior: only send new or edited items to append
        (currentOrder || []).forEach((it, idx) => {
          if (it.isExisting && !it._edited && !it.isNew) return;
          const n = normalizeOutgoingItem(it, idx);
          if (n._invalid) skipped.push(n);
          else outgoing.push(n);
        });

        if (!outgoing.length) {
          return {
            success: false,
            message:
              "Không món nào hợp lệ để lưu (thiếu dishId/menuId/categoryId). Bạn cần chọn lại từ menu.",
            skipped,
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
              // ask server to replace items if we deleted existing ones
              replaceItems: useReplace || undefined,
              note: orderNote,
              customer: extraCustomer,
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
            _lineId: makeLineId(),
          }));
          setCurrentOrder(normalized);
          setTableOrders((prev) => ({
            ...prev,
            [currentTable.code]: normalized,
          }));
          // clear deletion tracking after successful save
          setRemovedExistingItems([]);
        }

        return {
          success: true,
          message: skipped.length
            ? `Đã lưu đơn, nhưng bỏ qua ${skipped.length} món cũ không đủ field.`
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
      makeLineId,
    ]
  );

  /* ============================================================
     7) FETCH
     ============================================================ */
  const fetchOrderByTable = useCallback(
    async (restaurantId, tableCode, limit = 10, cursor = null) => {
      if (!restaurantId || !tableCode) {
        return { success: false, message: "missing restaurantId/tableCode" };
      }

      const res = await loadOrders({
        variables: { restaurantId, limit, cursor },
      });

      const edges = res?.data?.ordersByRestaurant?.edges || [];
      const matched = edges
        .map((e) => e.node)
        .filter(
          (o) => (o.tableCode || "").toLowerCase() === tableCode.toLowerCase()
        );

      // ⚠️ QUAN TRỌNG: gắn cờ để RightPanel biết món nào là "đã lưu"
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
        pageInfo: res?.data?.ordersByRestaurant?.pageInfo,
      };
    },
    [loadOrders]
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
     8) RETURN
     ============================================================ */
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

    // fetch
    fetchOrderByTable,
    fetchOrderById,
    orders: ordersData?.ordersByRestaurant?.edges?.map((e) => e.node) || [],
    ordersLoading,
    ordersError,
    orderById: orderByIdData?.order ?? null,
  };
}
