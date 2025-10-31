// src/hooks/useOrderManagement.js
import { useState, useEffect, useCallback } from "react";
import { useMutation, useLazyQuery, gql } from "@apollo/client";

/* =========================================================
   GraphQL
   ========================================================= */

/**
 * Mutation POS: gộp / tạo / thêm món vào order của một bàn
 * (bên server bạn đã cho phép input có: restaurantId, tableCode, orderCode, items, note, customer, clientMeta)
 * Ở đây ta QUERY lại đúng tên field mà server hiện có: `customer` (không phải customerInfo)
 */
const UPSERT_TABLE_ORDER = gql`
  mutation UpsertTableOrder($input: UpsertTableOrderInput!) {
    upsertTableOrder(input: $input) {
      isNewOrder
      order {
        id
        orderCode
        restaurantId
        tableCode
        currentStatus
        items {
          dishId
          menuId
          categoryId
          name
          unit
          price
          quantity
          method
          description
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
        # 👇 server của bạn đang có "customer" chứ không phải "customerInfo"
        customer {
          id
          fullName
          phone
          email
        }
      }
    }
  }
`;

/**
 * Query list orders
 * Lưu ý: cũng đổi `customerInfo` -> `customer` để đồng bộ
 */
const ORDERS_QUERY = gql`
  query Orders($filter: OrderFilterInput, $limit: Int, $offset: Int) {
    orders(filter: $filter, limit: $limit, offset: $offset) {
      items {
        id
        orderCode
        restaurantId
        tableCode
        currentStatus
        createdAt
        items {
          dishId
          name
          price
          quantity
        }
        totals {
          grandTotal
        }
        customer {
          id
          fullName
          phone
        }
      }
      totalCount
    }
  }
`;

/**
 * Query 1 order theo id
 * Cũng đổi sang `customer`
 */
const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      orderCode
      restaurantId
      tableCode
      currentStatus
      items {
        dishId
        name
        price
        quantity
        method
        description
      }
      totals {
        subtotal
        discount
        tax
        service
        grandTotal
      }
      customer {
        id
        fullName
        phone
        email
      }
      note
      createdAt
      updatedAt
    }
  }
`;

/* =========================================================
   Hook
   ========================================================= */

export default function useOrderManagement(pos = null) {
  // những state được PosContext truyền xuống
  const {
    currentOrder,
    setCurrentOrder,
    currentTable,
    setTableOrders,
    restaurantId: ctxRestaurantId,
  } = pos ?? {};

  // mutation chính
  const [upsertTableOrder] = useMutation(UPSERT_TABLE_ORDER);

  // list query
  const [
    loadOrders,
    { data: ordersData, loading: ordersLoading, error: ordersError },
  ] = useLazyQuery(ORDERS_QUERY, { fetchPolicy: "network-only" });

  // query 1 order
  const [loadOrderById, { data: orderByIdData }] = useLazyQuery(GET_ORDER, {
    fetchPolicy: "network-only",
  });

  // tổng tiền cục bộ
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    total: 0,
  });

  const [orderNote, setOrderNote] = useState("");
  const [orderDiscount] = useState({ type: "percent", value: 0 });

  /* =========================================================
     Recalc totals khi currentOrder đổi
     ========================================================= */
  useEffect(() => {
    const newTotals = currentOrder.reduce(
      (acc, item) => {
        const line =
          item.total != null
            ? item.total
            : (item.quantity ?? 0) * (item.price ?? 0);
        acc.subtotal += line;
        return acc;
      },
      { subtotal: 0, discount: 0, tax: 0, service: 0 }
    );

    if (orderDiscount?.value) {
      if (orderDiscount.type === "percent") {
        newTotals.discount = Math.round(
          newTotals.subtotal * (orderDiscount.value / 100)
        );
      } else {
        newTotals.discount = Math.round(orderDiscount.value);
      }
    }

    const base = Math.max(0, newTotals.subtotal - newTotals.discount);
    newTotals.tax = Math.round(base * 0.1);
    newTotals.service = Math.round(base * 0.05);
    newTotals.total =
      newTotals.subtotal -
      newTotals.discount +
      newTotals.tax +
      newTotals.service;

    setTotals(newTotals);
  }, [currentOrder, orderDiscount]);

  /* =========================================================
     Thao tác trên currentOrder (client)
     ========================================================= */

  // thêm món
  const addToOrder = useCallback(
    ({
      menuItem,
      quantity = 1,
      cookingOption = null,
      unit = null,
      note = "",
      price = null,
      menuId,
      categoryId,
    }) => {
      if (!menuItem?.id && !menuItem?.dishId) return;

      const normalizedId = menuItem.dishId || menuItem.id;

      const existsIdx = currentOrder.findIndex(
        (it) =>
          (it.dishId || it.id) === normalizedId &&
          it.method === cookingOption &&
          it.unit === (unit || "portion")
      );

      const finalPrice =
        price ??
        menuItem.price ??
        menuItem._displayPrice ??
        Number(menuItem.basePrice ?? 0) ??
        0;

      if (existsIdx !== -1) {
        const cloned = [...currentOrder];
        const old = cloned[existsIdx];
        const q = (old.quantity || 0) + quantity;
        cloned[existsIdx] = {
          ...old,
          quantity: q,
          total: q * finalPrice,
          isNew: true,
        };
        setCurrentOrder(cloned);
      } else {
        const newItem = {
          id: normalizedId,
          dishId: normalizedId,
          menuId: menuId ?? menuItem.menuId ?? menuItem.menu?.id ?? null,
          categoryId:
            categoryId ?? menuItem.categoryId ?? menuItem.category?.id ?? null,
          name: menuItem.name,
          quantity,
          unit: unit || "portion",
          method: cookingOption,
          description: note,
          price: finalPrice,
          total: finalPrice * quantity,
          isNew: true,
          isExisting: false,
          modifiers: [],
        };
        setCurrentOrder((prev) => [...prev, newItem]);
      }
    },
    [currentOrder, setCurrentOrder]
  );

  // cập nhật số lượng
  const updateItemQty = useCallback(
    (itemId, newQuantity) => {
      const updated = currentOrder.map((it) =>
        (it.dishId || it.id) === itemId
          ? {
              ...it,
              quantity: newQuantity,
              total: (it.price || 0) * newQuantity,
              isNew: it.isExisting ? false : true,
            }
          : it
      );
      setCurrentOrder(updated);
    },
    [currentOrder, setCurrentOrder]
  );

  // xóa món
  const removeItem = useCallback(
    (itemId) => {
      setCurrentOrder((prev) =>
        prev.filter((it) => (it.dishId || it.id) !== itemId)
      );
    },
    [setCurrentOrder]
  );

  /* =========================================================
     SAVE / UPSERT lên server
     ========================================================= */

  const saveOrder = useCallback(
    async ({ persist = true, restaurantId } = {}) => {
      const finalRestaurantId = restaurantId || ctxRestaurantId;
      if (!finalRestaurantId) {
        return {
          success: false,
          message: "Thiếu restaurantId, không thể lưu order.",
        };
      }

      if (!currentTable?.code) {
        return { success: false, message: "Vui lòng chọn bàn trước khi lưu." };
      }

      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món nào trong đơn." };
      }

      // chỉ gửi món mới / chưa tồn tại trên server
      const deltaItems = currentOrder.filter(
        (it) => it.isNew || !it.isExisting
      );
      if (!deltaItems.length) {
        return { success: true, message: "Không có gì để lưu." };
      }

      // optimistic
      setTableOrders((prev) => ({
        ...prev,
        [currentTable.code]: currentOrder,
      }));

      if (!persist) {
        return {
          success: true,
          message: `Đã lưu tạm đơn tại bàn ${currentTable.code}.`,
        };
      }

      try {
        const res = await upsertTableOrder({
          variables: {
            input: {
              restaurantId: finalRestaurantId, // 👈 cái server bắt buộc
              tableCode: currentTable.code,
              orderCode: currentTable.orderCode ?? null,
              // 👇 nếu TableActionsModal đã lưu thông tin khách vào currentTable
              customer: currentTable.customer ?? null,
              items: deltaItems.map((it) => ({
                dishId: it.dishId || it.id,
                menuId: it.menuId,
                categoryId: it.categoryId,
                name: it.name,
                unit: it.unit || "portion",
                price: Math.round(it.price || 0),
                modifiersPrice: 0,
                method: it.method || it.cookingOption || "",
                description: it.description || "",
                quantity: Number(it.quantity || 1),
                modifiers: (it.modifiers || []).map((m) => ({
                  optionId: m.optionId,
                  optionName: m.optionName,
                  groupId: m.groupId,
                  price: Math.round(m.price || 0),
                })),
                // ❗ KHÔNG gửi lineSubtotal: server của bạn không định nghĩa field này trong input
              })),
              note: orderNote || "",
              clientMeta: {
                savedAt: new Date().toISOString(),
              },
            },
          },
        });

        const serverOrder = res?.data?.upsertTableOrder?.order;
        if (serverOrder) {
          // sync lại items từ server
          setCurrentOrder(
            (serverOrder.items || []).map((i) => ({
              ...i,
              id: i.dishId,
              total: i.price * i.quantity,
              isExisting: true,
              isNew: false,
            }))
          );
        }

        return {
          success: true,
          message: "Đã lưu đơn lên server.",
          data: serverOrder,
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [
      currentOrder,
      currentTable,
      ctxRestaurantId,
      upsertTableOrder,
      setTableOrders,
      setCurrentOrder,
      orderNote,
    ]
  );

  /* =========================================================
     FETCH
     ========================================================= */

  const fetchOrderByTable = useCallback(
    async (tableCode, options = { limit: 10, offset: 0 }) => {
      try {
        const res = await loadOrders({
          variables: {
            filter: { tableCode },
            limit: options.limit,
            offset: options.offset,
          },
        });
        const list = res?.data?.orders?.items ?? [];
        return {
          success: true,
          data: list,
          totalCount: res?.data?.orders?.totalCount ?? list.length,
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [loadOrders]
  );

  const fetchOrderById = useCallback(
    async (id) => {
      if (!id) return { success: false, message: "missing id" };
      try {
        const res = await loadOrderById({ variables: { id } });
        return { success: true, data: res?.data?.order ?? null };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [loadOrderById]
  );

  /* =========================================================
     RETURN
     ========================================================= */

  return {
    currentOrder,
    totals,
    orderNote,
    setOrderNote,

    addToOrder,
    updateItemQty,
    removeItem,
    saveOrder,

    fetchOrderByTable,
    fetchOrderById,

    orders: ordersData?.orders?.items ?? [],
    ordersLoading,
    ordersError,
    orderById: orderByIdData?.order ?? null,
  };
}
