// src/hooks/useOrderManagement.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useLazyQuery, gql } from "@apollo/client";

/* ============================================================
   1) GRAPHQL
   ============================================================ */

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
        createdAt
        updatedAt
      }
    }
  }
`;

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
    }
  }
`;

// Thanh toán
const PAY_ORDER = gql`
  mutation PayOrder($input: PayOrderInput!) {
    payOrder(input: $input) {
      order {
        id
      }
      invoice {
        id
        number
        status
        totals
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
        category
        occurredAt
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
  const [removedExistingItems, setRemovedExistingItems] = useState([]);

  // Lưu lại orderId sau preparePayment để confirmPayment dùng, tránh save lần 2
  const lastPreparedOrderIdRef = useRef(null);

  // apollo
  const [upsertTableOrder] = useMutation(UPSERT_TABLE_ORDER);
  const [mutPayOrder, { loading: payLoading }] = useMutation(PAY_ORDER);

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

  const mapGqlMethod = useCallback((m) => {
    if (m === "cash") return "CASH";
    if (m === "card") return "CARD";
    return "BANK_TRANSFER";
  }, []);

  /* ============================================================
     5) CRUD CLIENT
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

      const idx = (currentOrder || []).findIndex(
        (it) =>
          !it.isExisting &&
          (it.dishId || it.id) === (menuItem.dishId || menuItem.id) &&
          (it.method || it.cookingOption || "") === (cookingOption || "") &&
          (it.unit || "portion") === (unit || "portion")
      );

      if (idx !== -1) {
        const updated = [...currentOrder];
        const nextQty = Number(updated[idx].quantity || 0) + Number(quantity);
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
     6) SAVE / UPSERT (TRƯỚC confirmPayment để tránh TDZ)
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
              "Không thể lưu: danh sách món trống sau khi xóa. Nếu bạn muốn huỷ đơn, hãy dùng hủy order.",
            skipped,
          };
        }
      } else {
        // delta behavior: chỉ gửi món mới hoặc đã sửa
        (currentOrder || []).forEach((it, idx) => {
          if (it.isExisting && !it._edited && !it.isNew) return;
          const n = normalizeOutgoingItem(it, idx);
          if (n._invalid) skipped.push(n);
          else outgoing.push(n);
        });

        // PATCH: Không có thay đổi vẫn coi là thành công → dùng order hiện có
        if (!outgoing.length) {
          // đoán nhanh orderId từ item
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

          // fallback: query theo bàn để lấy order hiện có
          try {
            const res = await loadOrders({
              variables: {
                restaurantId,
                limit: 10,
                cursor: null,
              },
              fetchPolicy: "network-only",
            });

            const edges = res?.data?.ordersByRestaurant?.edges || [];
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
          } catch (e) {
            // bỏ qua
          }

          // tối thiểu vẫn success để cho phép bước thanh toán, orderId có thể null
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
      loadOrders,
    ]
  );

  /* ============================================================
     7) PAYMENT FLOW
     ============================================================ */

  // 7.1 Chuẩn bị trước khi mở modal: LƯU ĐƠN + trả orderId/items/totals
  const preparePayment = useCallback(
    async ({ restaurantId } = {}) => {
      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId." };
      }
      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món để thanh toán." };
      }

      // Lưu đơn — nếu không có thay đổi vẫn trả success với orderId hiện có
      const saved = await saveOrder({ persist: true, restaurantId });
      if (!saved?.success) return saved;

      const orderId = saved?.data?.id || saved?.data?._id || null;
      lastPreparedOrderIdRef.current = orderId ?? null;

      // Lấy totals mới nhất từ state (đã tính sẵn)
      return {
        success: true,
        data: {
          orderId,
          items: currentOrder,
          totals,
        },
      };
    },
    [saveOrder, currentOrder, totals]
  );

  // 7.2 Kiểm tra điều kiện thanh toán (để enable/disable nút Xác nhận)
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
      // card/transfer: không bắt buộc nhập paidAmount
      return { ok: true };
    },
    [totals.total]
  );

  // 7.3 XÁC NHẬN trong modal: thanh toán NGAY, KHÔNG lưu lại nữa
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

      // kiểm tra số tiền
      const valid = validatePayment({
        method,
        paidAmount,
        total: totals.total,
      });
      if (!valid.ok) return { success: false, message: valid.message };

      // dùng orderId đã chuẩn bị; nếu chưa có thì vẫn fallback save
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
      // thanh toán

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

        // refresh order (không bắt buộc)
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
      mapGqlMethod,
      loadOrderById,
    ]
  );

  // Back-compat: checkoutOrder (giữ lại nếu chỗ khác đang gọi)
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
     8) FETCH
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
     9) RETURN
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
    loadOrders,
    // payment API cho UI
    preparePayment, // dùng khi bấm "Thanh toán": lưu + trả orderId/items/totals; nếu lỗi báo ngay
    validatePayment, // kiểm tra điều kiện trước khi enable nút XÁC NHẬN
    confirmPayment, // dùng trong modal khi bấm XÁC NHẬN: thanh toán ngay (không lưu lại)
    // giữ lại để tương thích
    checkoutOrder,
    payLoading,
  };
}
