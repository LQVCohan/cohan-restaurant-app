// src/hooks/useOrderManagement.js
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  useMutation,
  useLazyQuery,
  useApolloClient,
  gql,
} from "@apollo/client";
import useSocketOrder from "./useSocketOrder";
import { deriveSelectedCustomerPayload } from "@/utils/posCustomerIdentity";
import { buildDiscountPricingInput } from "@/utils/discountPreviewPayload";
/* ============================================================
   1) GRAPHQL
   ============================================================ */

/** ✅ CREATE ORDER FOR TABLE (dine-in) */
const CREATE_ORDER_FOR_TABLE = gql`
  mutation CreateOrderForTable($input: CreateOrderForTableInput!) {
    createOrderForTable(input: $input) {
      isNewOrder
      order {
        id
        orderCode
        tableCode
        currentStatus
        restaurantId
        priority
        user {
          id
          fullName
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
          weightGrams
          status
          image
          proofImages
          modifiers {
            groupId
            groupName
            optionId
            optionName
          }
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
        orderType
        createdAt
        updatedAt
      }
    }
  }
`;

/** ✅ CREATE OFF-PREMISE ORDER (delivery / takeaway) */
const CREATE_OFF_PREMISE_ORDER = gql`
  mutation CreateOffPremiseOrder($input: CreateOffPremiseOrderInput!) {
    createOffPremiseOrder(input: $input) {
      order {
        id
        orderCode
        restaurantId
        orderType
        tableCode
        currentStatus
        priority
        note
        shipping {
          fullName
          phone
          email
          address
          note
          deliveryMethod
          deliveryTime
          scheduleDate
          scheduleTime
        }
        customerInfo {
          name
          phone
          email
          note
          partySize
          timeTo
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
          weightGrams
          status
          image
          proofImages
          modifiers {
            groupId
            groupName
            optionId
            optionName
          }
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

        createdAt
        updatedAt
      }
    }
  }
`;

/** 🔎 Gom theo đợt (orderCode) của 1 bàn dine-in */
const ORDERS_GROUPED_BY_TABLE = gql`
  query OrdersGroupedByTable(
    $restaurantId: ID!
    $tableId: ID
    $tableCode: String
  ) {
    ordersGroupedByTable(
      restaurantId: $restaurantId
      tableId: $tableId
      tableCode: $tableCode
    ) {
      orderCode
      tableCode
      tableId
      latestStatus
      count
      orders {
        id
        orderCode
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
          weightGrams
          status
          image
          proofImages
          modifiers {
            groupId
            groupName
            optionId
            optionName
          }
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

        orderType
        createdAt
        updatedAt
      }
    }
  }
`;

const ACTIVE_TABLE_SESSION_ORDERS = gql`
  query ActiveTableSessionOrders($restaurantId: ID!, $tableId: ID!) {
    activeTableSessionOrders(restaurantId: $restaurantId, tableId: $tableId) {
      tableId
      tableCode
      session {
        id
        orderCode
      }
      orders {
        id
        orderCode
        tableCode
        currentStatus
        createdAt
        items {
          _id
          dishId
          menuId
          categoryId
          name
          unit
          basePrice
          servingKey
          modifiersPrice
          unitPrice
          lineSubtotal
          note
          priority
          quantity
          weightGrams
          status
          image
          proofImages
          modifiers {
            groupId
            groupName
            optionId
            optionName
          }
        }
      }
    }
  }
`;
/** ACTIVE orders (exclude cancelled/completed) – cho màn khác dùng */
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
            kitchenEnteredAt
            preparingAt
            readyAt
            actualPrepMinutes
            targetPrepMinutes
            timeLevel
            unaccepted
            unacceptedAfterMinutes
            unacceptedReason
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

/** ALL orders (including cancelled/completed) – cho màn khác dùng */
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
          priority
          user {
            id
            fullName
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

/** Single order */
const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      orderCode
      tableCode
      currentStatus
      priority
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
        returnedQuantity
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
        image
        proofImages
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
      note
      createdAt
      updatedAt
    }
  }
`;

/** 💳 Thanh toán các order theo tableId */
const PAY_ORDERS_BY_TABLE_ID = gql`
  mutation PayOrdersByTableId($input: PayOrdersByTableIdInput!) {
    payOrdersByTableId(input: $input) {
      warning
      pendingOrderCodes
      invoice {
        id
        number
        totals {
          subtotal
          discount
          discountReason
          voucherCode
          promotionId
          service
          tax
          shippingFee
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

/** 💳 Thanh toán theo danh sách orderIds (delivery/takeaway) */
const PAY_ORDERS_BY_ORDER_IDS = gql`
  mutation PayOrdersByOrderIds($input: PayOrdersByOrderIdsInput!) {
    payOrdersByOrderIds(input: $input) {
      warning
      pendingOrderCodes
      invoice {
        id
        number
        totals {
          subtotal
          discount
          discountReason
          voucherCode
          promotionId
          service
          tax
          shippingFee
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
const CREATE_ORDER_PAYMENT = gql`
  mutation CreateOrderPayment($input: CreateOrderPaymentInput!) {
    createOrderPayment(input: $input) {
      id
      provider
      reference
      amount
      status
      callbackStatus
      payUrl
      qrCodeUrl
      deeplink
      expiresAt
      cancelledAt
      cancelReason
      metadata
    }
  }
`;
const CANCEL_PAYMENT_SESSION = gql`
  mutation CancelPaymentSession($input: CancelPaymentSessionInput!) {
    cancelPaymentSession(input: $input) {
      id
      status
      callbackStatus
      provider
      reference
      amount
      expiresAt
      cancelledAt
      cancelReason
      metadata
    }
  }
`;
const GET_PAYMENT_SESSION = gql`
  query PaymentSession($id: ID!) {
    paymentSession(id: $id) {
      id
      status
      callbackStatus
      provider
      providerTransactionId
      reference
      amount
      expiresAt
      cancelledAt
      cancelReason
      payUrl
      qrCodeUrl
      deeplink
      metadata
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
      priority
      currentStatus
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
        returnedQuantity
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
        image
        proofImages
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
          image
          proofImages
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
        updatedAt
      }
    }
  }
`;

const REVIEW_ORDER_ITEM_VOID = gql`
  mutation ReviewOrderItemVoid($input: ReviewOrderItemVoidInput!) {
    reviewOrderItemVoid(input: $input) {
      id
      orderCode
      tableCode
      currentStatus
      restaurantId
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
        returnedQuantity
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
        image
        proofImages
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
      statusTimeline {
        status
        at
        note
        byUserId
      }
      updatedAt
    }
  }
`;
const REQUEST_ORDER_ITEM_RETURN = gql`
  mutation RequestOrderItemReturn($input: RequestOrderItemReturnInput!) {
    requestOrderItemReturn(input: $input) {
      id
      orderCode
      tableCode
      currentStatus
      restaurantId
      priority
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
        image
        proofImages
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
      statusTimeline {
        status
        at
        note
        byUserId
      }
      updatedAt
    }
  }
`;
const REVIEW_ORDER_ITEM_RETURN = gql`
  mutation ReviewOrderItemReturn($input: ReviewOrderItemReturnInput!) {
    reviewOrderItemReturn(input: $input) {
      id
      orderCode
      tableCode
      currentStatus
      restaurantId
      priority
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
        image
        proofImages
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
      statusTimeline {
        status
        at
        note
        byUserId
      }
      updatedAt
    }
  }
`;

/** ✅ Cập nhật ưu tiên 1 item trong 1 order theo ID */
const UPDATE_ORDER_ITEM_PRIORITY = gql`
  mutation UpdateOrderItemPriority($input: UpdateOrderItemPriorityInput!) {
    updateOrderItemPriority(input: $input) {
      order {
        id
        orderCode
        tableCode
        restaurantId
        priority
        items {
          _id
          dishId
          name
          priority
          status
        }
        updatedAt
      }
    }
  }
`;

/** Gắn/đổi khách cho toàn đợt theo orderCode (dine-in) */
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
    currentOrderCode,
    setCurrentOrderCode,
    currentOrderId,
    setCurrentOrderId,
    // 🔹 từ PosContext
    currentOrderType, // "dine_in" | "delivery" | "takeaway"
    deliveryCustomer,
    shippingInfo,
  } = pos ?? {};

  /** Nhóm đợt theo bàn (dine-in) */
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);

  /** Tổng tiền hiển thị ở POS (theo currentOrder ở UI) */
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    discountReason: "",
    voucherCode: "",
    promotionId: "",
    tax: 0,
    service: 0,
    shippingFee: 0,
    total: 0,
  });
  const [orderNote, setOrderNote] = useState("");

  // Keep last prepared orderId cho flow legacy
  const lastPreparedOrderIdRef = useRef(null);

  // apollo mutations
  const [createOrderForTable] = useMutation(CREATE_ORDER_FOR_TABLE);
  const [createOffPremiseOrder] = useMutation(CREATE_OFF_PREMISE_ORDER);
  const [mutPayByTable, { loading: payLoadingByTable }] = useMutation(
    PAY_ORDERS_BY_TABLE_ID,
  );
  const [mutPayByOrderIds, { loading: payLoadingByOrderIds }] = useMutation(
    PAY_ORDERS_BY_ORDER_IDS,
  );
  const [mutUpdateOrderStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [mutUpdateOrderItemStatus] = useMutation(UPDATE_ORDER_ITEM_STATUS);
  const [mutUpdateOrderItemPriority] = useMutation(UPDATE_ORDER_ITEM_PRIORITY);
  const [mutReviewOrderItemVoid] = useMutation(REVIEW_ORDER_ITEM_VOID);
  const [mutRequestOrderItemReturn] = useMutation(REQUEST_ORDER_ITEM_RETURN);
  const [mutReviewOrderItemReturn] = useMutation(REVIEW_ORDER_ITEM_RETURN);
  const [mutUpdateOrderCustomerByCode] = useMutation(
    UPDATE_ORDER_CUSTOMER_BY_CODE,
  );
  const [mutCreateOrderPayment] = useMutation(CREATE_ORDER_PAYMENT);
  const [mutCancelPaymentSession] = useMutation(CANCEL_PAYMENT_SESSION);

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
  const [loadActiveTableSessionOrdersQuery] = useLazyQuery(
    ACTIVE_TABLE_SESSION_ORDERS,
    { fetchPolicy: "network-only" },
  );

  /* ============================================================
     4) HELPERS
     ============================================================ */

  const getItemUnitPrice = useCallback(
    (it) =>
      Number(
        it?.unitPrice ??
          it?.price ??
          it?.servingVariant?.price ??
          it?.basePrice ??
          0,
      ),
    [],
  );

  const getItemMethod = useCallback(
    (it) =>
      (it?.method ||
        it?.cookingOption ||
        it?.servingVariant?.name ||
        it?.variantName ||
        it?.servingKey ||
        "") ??
      "",
    [],
  );

  const mapServerItemToUi = useCallback(
    (it) => {
      const price = getItemUnitPrice(it);
      const modifiersPrice = Number(it?.modifiersPrice ?? 0);
      const quantity = Number(it?.quantity ?? 0);
      const lineSubtotal =
        it?.lineSubtotal != null
          ? Number(it.lineSubtotal)
          : (price + modifiersPrice) * quantity;
      return {
        ...it,
        price,
        method: getItemMethod(it),
        modifiers: (it?.modifiers || []).map((m) => ({
          ...m,
          name: m?.name || m?.optionName || m?.option || "",
        })),
        lineSubtotal,
      };
    },
    [getItemMethod, getItemUnitPrice],
  );

  /* ============================================================
     SOCKET REALTIME EVENTS
     ============================================================ */
  const loadGroupsForTable = useCallback(
    async ({ restaurantId, tableId, tableCode }) => {
      if (!restaurantId || !(tableId || tableCode)) return [];
      try {
        if (tableId) {
          const { data } = await loadActiveTableSessionOrdersQuery({
            variables: { restaurantId, tableId },
          });
          const payload = data?.activeTableSessionOrders;
          const activeOrders = Array.isArray(payload?.orders)
            ? payload.orders
            : [];
          if (payload) {
            const sortedOrders = [...activeOrders].sort(
              (a, b) =>
                new Date(a?.createdAt || 0).getTime() -
                new Date(b?.createdAt || 0).getTime(),
            );

            const mergedItems = sortedOrders.flatMap((o, orderIdx) =>
              (Array.isArray(o?.items) ? o.items : []).map((i, itemIdx) => ({
                ...mapServerItemToUi(i),
                sourceOrderId: o.id,
                sourceOrderCode: o.orderCode,
                sourceOrderStatus: o.currentStatus,
                sourceOrderCreatedAt: o.createdAt || null,
                batchIndex: orderIdx + 1,
                isExisting: true,
                isNew: false,
                _edited: false,
                _lineId: `session_${o.id}_${i._id || i.dishId || itemIdx}`,
              })),
            );

            setCurrentOrder?.(mergedItems);

            // Quan trọng: không giữ orderId/orderCode cũ sau khi session active đã rỗng/đổi
            setCurrentOrderCode?.(payload?.session?.orderCode || null);
            setCurrentOrderId?.(null);

            if (setTableOrders) {
              setTableOrders((prev) => {
                const next = { ...(prev || {}) };

                const keys = [
                  tableId,
                  tableCode,
                  payload.tableId,
                  payload.tableCode,
                  payload.tableCode
                    ? String(payload.tableCode).toUpperCase()
                    : null,
                ].filter(Boolean);

                keys.forEach((key) => {
                  next[key] = mergedItems;
                });

                return next;
              });
            }

            setGroups([]);
            setActiveGroup(null);
            return [];
          }
        }
      } catch (e) {
        console.warn(
          "activeTableSessionOrders failed, fallback to ordersGroupedByTable",
          {
            restaurantId,
            tableId,
            tableCode,
            error: e,
          },
        );
      }

      const { data } = await loadGroupsQuery({
        variables: { restaurantId, tableId, tableCode },
      });

      const rawGroups = data?.ordersGroupedByTable || [];

      // Chỉ giữ các group còn active (không phải đã hoàn tất/hủy)
      // Chỉ giữ các group còn active, không lấy order đã completed/paid
      const inactiveStatuses = new Set([
        "COMPLETED",
        "ORDER_COMPLETED",
        "CANCELLED",
        "ORDER_CANCELLED",
        "FAILED",
        "PAID",
      ]);

      const gs = rawGroups.filter((g) => {
        const st = String(g.latestStatus || "").toUpperCase();
        return !inactiveStatuses.has(st);
      });

      setGroups(gs);

      // Nếu không còn group active thì đây là bàn trống.
      // Tuyệt đối không fallback sang rawGroups lịch sử đã thanh toán.
      if (!gs.length) {
        setActiveGroup(null);
        setCurrentOrder?.([]);
        setCurrentOrderCode?.(null);
        setCurrentOrderId?.(null);

        if (setTableOrders) {
          setTableOrders((prev) => {
            const next = { ...(prev || {}) };

            const keys = [
              tableId,
              tableCode,
              tableCode ? String(tableCode).toUpperCase() : null,
            ].filter(Boolean);

            keys.forEach((key) => {
              next[key] = [];
            });

            return next;
          });
        }

        return [];
      }

      // Fallback grouped query: không chọn 1 latest group nữa.
      // Phải gom tất cả active groups của cùng bàn.
      const sortedGroups = [...gs].sort((a, b) => {
        const ta = new Date(
          a.orders?.[a.orders.length - 1]?.createdAt || 0,
        ).getTime();
        const tb = new Date(
          b.orders?.[b.orders.length - 1]?.createdAt || 0,
        ).getTime();
        return ta - tb;
      });

      const latest = sortedGroups[sortedGroups.length - 1] || null;
      setActiveGroup(latest || null);

      const allOrders = sortedGroups
        .flatMap((g) => (Array.isArray(g.orders) ? g.orders : []))
        .sort(
          (a, b) =>
            new Date(a?.createdAt || 0).getTime() -
            new Date(b?.createdAt || 0).getTime(),
        );

      const uiItems = allOrders.flatMap((order, orderIdx) =>
        (Array.isArray(order.items) ? order.items : []).map((i, itemIdx) => {
          const base = mapServerItemToUi(i);

          return {
            ...base,
            sourceOrderId: order.id,
            sourceOrderCode: order.orderCode,
            sourceOrderStatus: order.currentStatus,
            sourceOrderCreatedAt: order.createdAt || null,
            batchIndex: orderIdx + 1,
            isExisting: true,
            isNew: false,
            _edited: false,
            _lineId: `grp_${order.id || order.orderCode}_${i._id || i.dishId || itemIdx}`,
          };
        }),
      );

      setCurrentOrder?.(uiItems);

      if (setTableOrders) {
        setTableOrders((prev) => {
          const next = { ...(prev || {}) };

          const keys = [
            tableId,
            tableCode,
            latest?.tableId,
            latest?.tableCode,
            latest?.tableCode ? String(latest.tableCode).toUpperCase() : null,
          ].filter(Boolean);

          keys.forEach((key) => {
            next[key] = uiItems;
          });

          return next;
        });
      }

      return gs;
    },
    [
      loadActiveTableSessionOrdersQuery,
      loadGroupsQuery,
      mapServerItemToUi,
      setCurrentOrder,
      setCurrentOrderCode,
      setCurrentOrderId,
      setTableOrders,
    ],
  );

  useSocketOrder(restaurantId, {
    onAny: async (evt) => {
      const { type, order } = evt || {};
      if (!order) return;

      // Merge vào Apollo cache (best-effort)
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
      } catch (e) {
        void e;
      }

      // Nếu đang xem theo bàn → reload group để cập nhật gộp món
      if (
        currentOrderType === "dine_in" &&
        (currentTable?.id || currentTable?.code) &&
        restaurantId
      ) {
        try {
          await loadGroupsForTable({
            restaurantId,
            tableId: currentTable.id,
            tableCode: currentTable.code,
          });
        } catch (e) {
          void e;
        }
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
                    (e) => e.node.id !== order.id,
                  ),
                },
              },
            });
          }
        } catch (e) {
          void e;
        }
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
      { subtotal: 0, discount: 0, tax: 0, service: 0 },
    );

    const base = Math.max(0, newTotals.subtotal - newTotals.discount);
    newTotals.tax = 0;
    newTotals.service = 0;
    newTotals.total = base;
    setTotals(newTotals);
  }, [currentOrder]);

  const makeLineId = useCallback(
    () =>
      `line_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,
    [],
  );

  const normalizeOutgoingItem = useCallback((it, idx) => {
    const dishId = it.dishId || it.id || it.dish_id || null;
    const menuId = it.menuId || it.menuItemId || it.menu_id || null;
    const categoryId = it.categoryId || it.category_id || null;
    const servingKey =
      it.servingKey || it.variantKey || it.servingVariantKey || null;

    if (!dishId || !menuId || !categoryId || !servingKey) {
      return {
        _invalid: true,
        _index: idx,
        original: it,
        reason: "missing_ids",
      };
    }

    const unit = it.unit || "portion";
    const rawQty = it.quantity != null ? it.quantity : 1;
    const hasServingVariant = it.servingVariant && it.servingVariant.mode;

    let quantity;
    let weightGrams = null;
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
      weightGrams = Math.round(quantity * 1000);
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
      basePrice: hasServingVariant ? null : Math.round(it.price || 0),
      note: it.description || it.note || "",
      priority: String(it.priority || "MEDIUM").toUpperCase(),
      quantity,
      proofImages: it.proofImages || [],
      servingKey,
      servingVariant: hasServingVariant
        ? {
            key: it.servingVariant.key || servingKey,
            name: it.servingVariant.name,
            price: Number(it.servingVariant.price ?? it.price ?? 0),
            mode: it.servingVariant.mode,
            sellQty: it.servingVariant.sellQty ?? null,
            sellUnit: it.servingVariant.sellUnit ?? null,
          }
        : null,
      weightGrams: weightGrams,
      selectedModifiers: (it.modifiers || [])
        .map((m) => ({
          groupId: m.groupId,
          optionId: m.optionId || m.id,
        }))
        .filter((m) => m.groupId && m.optionId),
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
            priority
            restaurantId
            updatedAt
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
              weightGrams
              status
              image
              proofImages
              modifiers {
                groupId
                groupName
                optionId
                optionName
              }
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
              : e,
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
      } catch (e) {
        void e;
      }

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
      } catch (e) {
        void e;
      }
    },
    [apollo],
  );

  /* ============================================================
     5) GỘP MÓN THEO ĐỢT (dine-in)
     ============================================================ */
  const norm = (v) => String(v ?? "").trim();

  const normalizeProofKey = (proofImages) => {
    const arr = Array.isArray(proofImages) ? proofImages.filter(Boolean) : [];
    return arr.length ? JSON.stringify([...arr].sort()) : "no_proof";
  };

  const normalizeModsKey = (mods) => {
    const arr = Array.isArray(mods) ? mods : [];
    if (!arr.length) return "no_mods";
    return arr
      .map((m) => `${norm(m.groupId)}:${norm(m.optionId || m.id)}`)
      .filter(Boolean)
      .sort()
      .join("|");
  };

  const makeLineSignature = ({
    dishId,
    unit,
    variantName,
    variantKey,
    note,
    proofImages,
    modifiers,
  }) => {
    const variantSig = norm(variantKey || "") || norm(variantName || "");
    return [
      norm(dishId),
      norm(unit || "portion"),
      variantSig, // ✅ ưu tiên variantKey nếu có
      norm(note || ""),
      normalizeProofKey(proofImages),
      normalizeModsKey(modifiers),
    ].join("__");
  };

  const itemSignature = (it) => {
    const mods =
      (it.modifiers || [])
        .map((m) => `${m.groupId || ""}:${m.optionId || m.id || ""}`)
        .sort()
        .join("|") || "";

    const unit = it.unit || "portion";
    const method = getItemMethod(it);
    const dishId = it.dishId || it.id || it.name;
    const note = (it.note || "").trim();

    let proofKey = "no_proof";
    if (Array.isArray(it.proofImages) && it.proofImages.length > 0) {
      proofKey = JSON.stringify([...it.proofImages].sort());
    }

    return `${dishId}-${unit}-${method}-${mods}-${note}-${proofKey}`;
  };

  const mergeGroupItems = useCallback(
    (group) => {
      if (!group?.orders?.length)
        return {
          items: [],
          totals: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            service: 0,
            grandTotal: 0,
          },
        };

      const orders = [...group.orders].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );

      const map = new Map();
      const totalsAgg = {
        subtotal: 0,
        discount: 0,
        tax: 0,
        service: 0,
        grandTotal: 0,
      };

      for (const ord of orders) {
        const t = ord.totals || {};
        totalsAgg.subtotal += Number(t.subtotal || 0);
        totalsAgg.discount += Number(t.discount || 0);
        totalsAgg.tax += Number(t.tax || 0);
        totalsAgg.service += Number(t.service || 0);
        totalsAgg.grandTotal += Number(t.grandTotal || 0);

        for (const it of ord.items || []) {
          const key = itemSignature(it);

          const prev = map.get(key) || {
            ...it,
            quantity: 0,
            lineSubtotal: 0,
            isExisting: true,
            isNew: false,
            _edited: false,
            proofImages: it.proofImages || [],
            image: it.image || "",
            createdAt: it.createdAt || ord.createdAt,
          };

          prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);

          const currentItemTotal =
            (getItemUnitPrice(it) + Number(it.modifiersPrice || 0)) *
            Number(it.quantity || 0);
          prev.lineSubtotal = (prev.lineSubtotal || 0) + currentItemTotal;

          map.set(key, prev);
        }
      }

      for (const k of Object.keys(totalsAgg))
        totalsAgg[k] = Math.round(totalsAgg[k]);
      return { items: Array.from(map.values()), totals: totalsAgg };
    },
    [getItemMethod, getItemUnitPrice],
  );

  /** Tổng gộp của group đang active (dine-in) */
  const mergedCurrent = useMemo(
    () =>
      activeGroup
        ? mergeGroupItems(activeGroup)
        : {
            items: [],
            totals: {
              subtotal: 0,
              discount: 0,
              tax: 0,
              service: 0,
              grandTotal: 0,
            },
          },
    [activeGroup, mergeGroupItems],
  );

  /* ============================================================
     7) STATUS HELPERS (ID-based)
     ============================================================ */

  const VALID_ITEM_STATUS = useRef(
    new Set([
      "pending",
      "preparing",
      "ready",
      "served",
      "cancelled",
      "returned", // khớp schema ItemStatus mới
    ]),
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

          if (
            currentOrderType === "dine_in" &&
            (currentTable?.id || currentTable?.code) &&
            restaurantId
          ) {
            await loadGroupsForTable({
              restaurantId,
              tableId: currentTable.id,
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
      currentOrderType,
      currentTable?.id,
      currentTable?.code,
      loadGroupsForTable,
    ],
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
            i === itemKey,
        );
        if (idx >= 0) {
          prevStatus = currentOrder[idx]?.status ?? "pending";
          setCurrentOrder((prev) =>
            (prev || []).map((it, i) =>
              i === idx ? { ...it, status, _edited: true } : it,
            ),
          );
          if (setTableOrders && currentTable?.code) {
            setTableOrders((prev) => ({
              ...prev,
              [currentTable.code]: (prev?.[currentTable.code] || []).map(
                (it, i) => (i === idx ? { ...it, status, _edited: true } : it),
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

        if (
          currentOrderType === "dine_in" &&
          (currentTable?.id || currentTable?.code) &&
          restaurantId
        ) {
          await loadGroupsForTable({
            restaurantId,
            tableId: currentTable.id,
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
              i === idx ? { ...it, status: prevStatus, _edited: false } : it,
            ),
          );
          if (setTableOrders && currentTable?.code) {
            setTableOrders((prev) => ({
              ...prev,
              [currentTable.code]: (prev?.[currentTable.code] || []).map(
                (it, i) =>
                  i === idx
                    ? { ...it, status: prevStatus, _edited: false }
                    : it,
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
      currentOrderType,
      loadGroupsForTable,
      writeOrderIntoCache,
    ],
  );

  const changeOrderItemPriority = useCallback(
    async ({ restaurantId, orderId, itemKey, priority, afterSuccess }) => {
      if (!orderId)
        return { success: false, message: "Thiếu orderId để đổi mức ưu tiên." };
      if (!itemKey && itemKey !== 0)
        return { success: false, message: "Thiếu itemKey." };

      try {
        const { data } = await mutUpdateOrderItemPriority({
          variables: {
            input: {
              orderId,
              restaurantId: restaurantId || undefined,
              itemKey: String(itemKey),
              priority: String(priority || "MEDIUM").toUpperCase(),
            },
          },
        });

        const serverOrder = data?.updateOrderItemPriority?.order || null;
        if (serverOrder) writeOrderIntoCache(serverOrder);

        if (
          currentOrderType === "dine_in" &&
          (currentTable?.id || currentTable?.code) &&
          restaurantId
        ) {
          await loadGroupsForTable({
            restaurantId,
            tableId: currentTable.id,
            tableCode: currentTable.code,
          });
        }

        await afterSuccess?.(serverOrder);
        return { success: true, data: serverOrder };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Đổi mức ưu tiên món thất bại.",
        };
      }
    },
    [
      mutUpdateOrderItemPriority,
      writeOrderIntoCache,
      currentOrderType,
      currentTable?.id,
      currentTable?.code,
      loadGroupsForTable,
    ],
  );

  const reviewOrderItemVoid = useCallback(
    async ({ orderId, orderItemId, requestId, approve, note }) => {
      if (!orderId || !orderItemId || !requestId) {
        throw new Error(
          "Thiếu orderId/orderItemId/requestId để duyệt yêu cầu hủy món.",
        );
      }

      const { data } = await mutReviewOrderItemVoid({
        variables: {
          input: {
            orderId,
            orderItemId,
            requestId,
            approve: Boolean(approve),
            note: note || undefined,
          },
        },
      });

      const updatedOrder = data?.reviewOrderItemVoid || null;
      if (updatedOrder) {
        writeOrderIntoCache(updatedOrder);
        if (updatedOrder.restaurantId) {
          await loadOrdersNow({
            variables: { restaurantId: updatedOrder.restaurantId, limit: 100 },
          });
        }
      }

      return updatedOrder;
    },
    [mutReviewOrderItemVoid, writeOrderIntoCache, loadOrdersNow],
  );
  const requestOrderItemReturn = useCallback(
    async ({ orderId, orderItemId, quantity, reason, refundMode }) => {
      const { data } = await mutRequestOrderItemReturn({
        variables: {
          input: { orderId, orderItemId, quantity, reason, refundMode },
        },
      });
      const updatedOrder = data?.requestOrderItemReturn || null;
      if (updatedOrder) {
        writeOrderIntoCache(updatedOrder);
        if (updatedOrder.restaurantId)
          await loadOrdersNow({
            variables: { restaurantId: updatedOrder.restaurantId, limit: 100 },
          });
      }
      return updatedOrder;
    },
    [mutRequestOrderItemReturn, writeOrderIntoCache, loadOrdersNow],
  );
  const reviewOrderItemReturn = useCallback(
    async ({ orderId, orderItemId, requestId, approve, note }) => {
      const { data } = await mutReviewOrderItemReturn({
        variables: {
          input: {
            orderId,
            orderItemId,
            requestId,
            approve: Boolean(approve),
            note: note || undefined,
          },
        },
      });
      const updatedOrder = data?.reviewOrderItemReturn || null;
      if (updatedOrder) {
        writeOrderIntoCache(updatedOrder);
        if (updatedOrder.restaurantId)
          await loadOrdersNow({
            variables: { restaurantId: updatedOrder.restaurantId, limit: 100 },
          });
      }
      return updatedOrder;
    },
    [mutReviewOrderItemReturn, writeOrderIntoCache, loadOrdersNow],
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
    [changeOrderItemStatus, activeGroup],
  );

  /* ============================================================
     8) CLIENT CRUD (add/update/remove/clear)
     ============================================================ */

  const addToOrder = useCallback(
    ({
      menuItem,
      quantity = 1,
      unit = null,
      note = "",
      price = null,
      proofImages = [],
      variantName = "",
      variantKey = "",
      servingKey: servingKeyInput = "",
      cookingOption = "",
      variant = null,
      modifiers = [],
    }) => {
      if (!menuItem) return;
      const variantLabel = variantName || cookingOption || variant?.name || "";
      const itemPrice = Number(
        price ??
          menuItem._displayPrice ??
          menuItem.price ??
          menuItem.basePrice ??
          0,
      );
      const servingKey =
        servingKeyInput ||
        variantKey ||
        variant?.key ||
        menuItem?.defaultServingKey ||
        "";
      const resolvedPrice = Number.isFinite(itemPrice) ? itemPrice : 0;
      const chosenUnit = unit || (menuItem.byWeight ? "kg" : "portion");
      const servingVariant =
        variant && variant.name && variant.mode
          ? {
              name: variant.name,
              price: Number(variant.price ?? itemPrice),
              mode: variant.mode,
            }
          : null;
      const incomingSig = makeLineSignature({
        dishId: menuItem.dishId || menuItem.id,
        unit: chosenUnit,
        variantKey: variantKey || variant?.key,
        variantName: variantLabel,
        note,
        proofImages,
        modifiers,
      });
      let q;
      if (chosenUnit === "kg") {
        const f = parseFloat(quantity);
        q = Number.isFinite(f) && f > 0 ? Math.round(f * 10) / 10 : 0.5;
      } else {
        const n = Math.round(Number(quantity) || 0);
        q = Math.max(1, n);
      }

      // Chỉ gộp món MỚI, không có ảnh minh chứng
      const idx = (currentOrder || []).findIndex((it) => {
        if (it?.isExisting) return false;
        const itSig = makeLineSignature({
          dishId: it.dishId || it.id,
          unit: it.unit,
          variantKey: it.variantKey,
          variantName: it.variantName || it.method || it.cookingOption,
          note: it.note,
          proofImages: it.proofImages,
          modifiers: it.modifiers,
        });
        return itSig === incomingSig;
      });

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
            (resolvedPrice + Number(updated[idx].modifiersPrice || 0)) *
            nextQty,
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
          image: menuItem.image || menuItem.thumbImage,
          unit: chosenUnit,
          price: Number(resolvedPrice),
          modifiersPrice: 0,
          method: variantLabel,
          variantName: variantLabel,
          variantKey: variantKey || variant?.key || "",
          servingKey,
          defaultServingKey: menuItem?.defaultServingKey || "",
          servingVariant,
          note: note,
          quantity: q,
          lineSubtotal: Number(resolvedPrice) * q,
          isNew: true,
          isExisting: false,
          proofImages: proofImages || [],
          createdAt: new Date().toISOString(),
        };
        setCurrentOrder((prev) => [...(prev || []), newItem]);
      }
    },
    [currentOrder, setCurrentOrder, makeLineId],
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
        }),
      );
    },
    [setCurrentOrder],
  );

  const removeItem = useCallback(
    (key) => {
      setCurrentOrder((prev) => {
        if (!prev?.length) return prev;

        const byLine = prev.findIndex((it) => it._lineId === key);
        if (byLine !== -1) {
          return prev.filter((_, i) => i !== byLine);
        }

        const byDish = prev.findIndex((it) => it.dishId === key);
        if (byDish !== -1) return prev.filter((_, i) => i !== byDish);

        const byId = prev.findIndex((it) => it.id === key);
        if (byId !== -1) return prev.filter((_, i) => i !== byId);

        return prev;
      });
    },
    [setCurrentOrder],
  );

  const clearAll = useCallback(() => {
    setCurrentOrder([]);
    if (setTableOrders && currentTable?.code) {
      setTableOrders((prev) => ({ ...prev, [currentTable.code]: [] }));
    }
  }, [setCurrentOrder, setTableOrders, currentTable]);

  /* ============================================================
     9) SAVE / UPSERT
     - dine_in → createOrderForTable
     - delivery/takeaway → createOffPremiseOrder
     ============================================================ */

  const saveOrder = useCallback(
    async (options = {}) => {
      const {
        persist = true,
        pricing: discountPricing = {},
        promotionIds = [],
        restaurantId,
        clearAfterSave = true,
      } = options || {};
      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món ăn nào trong đơn." };
      }
      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId khi lưu order." };
      }

      // Lưu tạm vào local state (bất kể loại đơn)
      if (currentTable?.code && setTableOrders) {
        setTableOrders((prev) => ({
          ...prev,
          [currentTable.code]: currentOrder,
        }));
      }

      if (!persist) {
        return {
          success: true,
          message: "Đã lưu tạm trong POS (chưa gửi server).",
        };
      }

      // Chuẩn hóa danh sách món gửi lên server
      const outgoing = [];
      const skipped = [];
      (currentOrder || []).forEach((it, idx) => {
        // dine-in: chỉ gửi món mới/đã chỉnh sửa
        if (currentOrderType === "dine_in") {
          if (it.isExisting && !it._edited && !it.isNew) return;
        }

        const n = normalizeOutgoingItem(it, idx);
        if (n._invalid) skipped.push(n);
        else outgoing.push(n);
      });

      if (!outgoing.length) {
        return {
          success: true,
          message: "Không có thay đổi để lưu.",
          skipped,
          data: null,
        };
      }

      /* ---------------- DINE-IN ---------------- */
      if (!currentOrderType || currentOrderType === "dine_in") {
        // ❌ Chưa chọn bàn → không cho lưu
        if (!currentTable?.code) {
          return {
            success: false,
            message: "Vui lòng chọn bàn trước khi lưu (dine-in).",
          };
        }

        try {
          const res = await createOrderForTable({
            variables: {
              input: {
                restaurantId,
                tableCode: currentTable.code,

                items: outgoing,
                note: orderNote,
                clientMeta: {
                  savedAt: new Date().toISOString(),
                  ua:
                    typeof navigator !== "undefined" ? navigator.userAgent : "",
                },
              },
            },
          });

          const serverOrder = res?.data?.createOrderForTable?.order || null;

          if (serverOrder) {
            writeOrderIntoCache(serverOrder);
          }

          if (currentTable?.code) {
            await loadGroupsForTable({
              restaurantId,
              tableId: currentTable.id,
              tableCode: currentTable.code,
            });
          }

          return {
            success: true,
            message:
              skipped.length > 0
                ? `Đã lưu đợt mới (dine-in). Bỏ qua ${skipped.length} món không hợp lệ.`
                : "Đã lưu đợt mới (dine-in) lên server.",
            skipped,
            data: serverOrder,
          };
        } catch (err) {
          const messages = err?.graphQLErrors?.length
            ? err.graphQLErrors.map((e) => e.message)
            : [err?.message || "Lưu đơn dine-in thất bại."];
          console.error("createOrderForTable failed:", err);
          return {
            success: false,
            message: messages.join(" | "),
            errors: messages,
          };
        }
      }

      /* ---------------- OFF-PREMISE: DELIVERY / TAKEAWAY ---------------- */
      // Lưu ý: không phụ thuộc tableCode, orderCode
      const cleanCustomer = deliveryCustomer
        ? {
            fullName: (
              deliveryCustomer.fullName ||
              deliveryCustomer.name ||
              ""
            ).trim(),
            name: undefined,
            phone: (deliveryCustomer.phone || "").trim() || undefined,
            email:
              (deliveryCustomer.email || "").trim().toLowerCase() || undefined,
          }
        : null;
      const selectedPayload = deriveSelectedCustomerPayload({
        selectedCandidate: deliveryCustomer,
        conflict: deliveryCustomer?.conflict,
        form: {
          name: cleanCustomer?.fullName,
          phone: cleanCustomer?.phone,
          email: cleanCustomer?.email,
        },
      });

      // map đúng với ShippingInput trên BE
      const shippingPayload = shippingInfo
        ? {
            fullName:
              shippingInfo.fullName ||
              cleanCustomer?.fullName ||
              cleanCustomer?.name ||
              "" ||
              null,
            phone:
              (shippingInfo.phone || cleanCustomer?.phone || "").trim() || null,
            email:
              (shippingInfo.email || cleanCustomer?.email || "")
                .trim()
                .toLowerCase() || null,
            address: shippingInfo.address || null,
            note: shippingInfo.note || null,
            deliveryMethod: shippingInfo.deliveryMethod || null,
            deliveryTime: shippingInfo.deliveryTime || null,
            scheduleDate: shippingInfo.scheduleDate || null,
            scheduleTime: shippingInfo.scheduleTime || null,
          }
        : null;

      const hasShippingAddress =
        String(shippingInfo?.address || "").trim().length > 0;
      if (currentOrderType === "delivery" && !hasShippingAddress) {
        return {
          success: false,
          message: "Đơn giao hàng bắt buộc phải có địa chỉ.",
        };
      }

      // (Mang đi: không bắt buộc address)

      try {
        const res = await createOffPremiseOrder({
          variables: {
            input: {
              restaurantId,
              orderType: currentOrderType, // "delivery" | "takeaway"
              items: outgoing,
              note: orderNote,
              customer: cleanCustomer,
              shipping: shippingPayload,
              userId: selectedPayload.userId,
              customerIdentityMode: selectedPayload.customerIdentityMode,
              clientMeta: {
                savedAt: new Date().toISOString(),
                ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
                tableCode: currentTable?.code || null,
                shippingFE: {
                  distanceKm: shippingInfo?.distanceKm ?? null,
                  deliveryFee: shippingInfo?.deliveryFee ?? null,
                  customerLocation: shippingInfo?.customerLocation || null,
                },
              },
              pricing: buildDiscountPricingInput({
                taxRate: discountPricing?.taxRate ?? 0,
                serviceRate: discountPricing?.serviceRate ?? 0,
                shippingFee: discountPricing?.shippingFee ?? 0,
                voucherCode: discountPricing?.voucherCode ?? "",
              }),
              promotionIds: Array.isArray(promotionIds) ? promotionIds : [],
            },
          },
        });

        const serverOrder = res?.data?.createOffPremiseOrder?.order || null;
        if (serverOrder?.id) {
          setCurrentOrderId?.(serverOrder.id);
        }

        if (serverOrder?.orderCode) {
          setCurrentOrderCode?.(serverOrder.orderCode);
        }
        if (serverOrder) {
          writeOrderIntoCache(serverOrder);
        }

        // Off-premise: có thể giữ cart khi cần mở PaymentModal ngay sau lưu
        if (clearAfterSave) {
          setCurrentOrder?.([]);
        }

        return {
          success: true,
          message:
            skipped.length > 0
              ? `Đã tạo đơn ${currentOrderType} mới. Bỏ qua ${skipped.length} món không hợp lệ.`
              : `Đã tạo đơn ${currentOrderType} mới thành công.`,
          skipped,
          data: serverOrder,
        };
      } catch (err) {
        const messages = err?.graphQLErrors?.length
          ? err.graphQLErrors.map((e) => e.message)
          : [err?.message || "Tạo đơn giao/mang về thất bại."];
        console.error("createOffPremiseOrder failed:", err);
        return {
          success: false,
          message: messages.join(" | "),
          errors: messages,
        };
      }
    },
    [
      currentOrder,
      currentTable,
      currentOrderType,
      orderNote,
      createOrderForTable,
      createOffPremiseOrder,
      setTableOrders,
      normalizeOutgoingItem,
      activeGroup?.orderCode,
      loadGroupsForTable,
      writeOrderIntoCache,
      setCurrentOrder,
      deliveryCustomer,
      shippingInfo,
    ],
  );

  /* ============================================================
     10) PAYMENT FLOW (dine-in + delivery/takeaway)
     ============================================================ */

  const preparePayment = useCallback(
    async ({ restaurantId } = {}) => {
      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId." };
      }

      const isDineIn = !currentOrderType || currentOrderType === "dine_in";

      if (isDineIn) {
        if (!currentOrder?.length) {
          return { success: false, message: "Chưa có món để thanh toán." };
        }

        return {
          success: true,
          data: {
            tableId: currentTable?.id || currentTable?._id || null,
            tableCode: currentTable?.code || null,
            items: currentOrder,
            totals: {
              ...totals,
              grandTotal: totals.total,
            },
          },
        };
      }

      if (!currentOrder?.length) {
        return { success: false, message: "Chưa có món để thanh toán." };
      }

      const saved = await saveOrder({
        persist: true,
        restaurantId,
        clearAfterSave: false,
      });

      if (!saved?.success) return saved;

      const orderId = saved?.data?.id || saved?.data?._id || null;
      lastPreparedOrderIdRef.current = orderId ?? null;

      return {
        success: true,
        data: {
          orderId,
          items: currentOrder,
          totals,
        },
      };
    },
    [
      currentOrderType,
      currentOrder,
      currentTable?.id,
      currentTable?._id,
      currentTable?.code,
      totals,
      saveOrder,
    ],
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
    [totals.total],
  );

  const confirmPayment = useCallback(
    async ({
      restaurantId,
      method = "cash",
      paidAmount = 0,
      note = "",
      externalRef = null,
      pricing = null,
      promotionIds = [],
    } = {}) => {
      if (!restaurantId)
        return { success: false, message: "Thiếu restaurantId." };

      const isDineIn = !currentOrderType || currentOrderType === "dine_in";
      const grand = Number(totals.total || 0);
      const normalizedPromotionIds = Array.isArray(promotionIds)
        ? promotionIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];

      const hasPaymentDiscountPayload =
        Boolean(pricing) || normalizedPromotionIds.length > 0;

      const validationTotal = hasPaymentDiscountPayload
        ? Number(paidAmount || 0)
        : grand;

      const paymentInputExtras = {
        ...(pricing ? { pricing } : {}),
        ...(normalizedPromotionIds.length
          ? { promotionIds: normalizedPromotionIds }
          : {}),
      };
      const valid = validatePayment({
        method,
        paidAmount,
        total: validationTotal,
      });
      if (!valid.ok) return { success: false, message: valid.message };

      const paid = hasPaymentDiscountPayload
        ? Number(paidAmount || 0)
        : method === "cash"
          ? Number(paidAmount || 0)
          : grand;
      const idempotency =
        externalRef ||
        `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        if (isDineIn) {
          const tableId =
            currentTable?.id ||
            currentTable?._id ||
            activeGroup?.tableId ||
            null;
          if (!tableId) {
            return { success: false, message: "Thiếu tableId để thanh toán." };
          }

          const { data } = await mutPayByTable({
            variables: {
              input: {
                restaurantId,
                tableId,
                paidAmount: paid,
                method,
                note,
                externalRef: idempotency,
                includeUnserved: false,
                ...paymentInputExtras,
              },
            },
          });

          const result = data?.payOrdersByTableId || null;

          const tablePendingOrderCodes = Array.isArray(
            result?.pendingOrderCodes,
          )
            ? result.pendingOrderCodes
            : [];

          if (result?.warning === true || tablePendingOrderCodes.length > 0) {
            return {
              success: false,
              message:
                tablePendingOrderCodes.length > 0
                  ? `Không thể thanh toán khi còn order chưa phục vụ xong: ${tablePendingOrderCodes.join(", ")}`
                  : "Backend trả về cảnh báo khi thanh toán. Vui lòng kiểm tra lại trạng thái đơn.",
              data: result,
            };
          }

          if (!result?.invoice && !result?.transaction) {
            return {
              success: false,
              message: "Thanh toán chưa được backend xác nhận.",
              data: result,
            };
          }

          return { success: true, data: result };
        }

        const preparedOrderId = lastPreparedOrderIdRef.current || null;
        if (!preparedOrderId) {
          return {
            success: false,
            message: "Thiếu orderId đã chuẩn bị để thanh toán đơn off-premise.",
          };
        }

        const { data } = await mutPayByOrderIds({
          variables: {
            input: {
              restaurantId,
              orderIds: [preparedOrderId],
              paidAmount: paid,
              method,
              note,
              externalRef: idempotency,
              ...paymentInputExtras,
            },
          },
        });

        const res = data?.payOrdersByOrderIds || null;
        if (!res) {
          return {
            success: false,
            message: "Thanh toán đơn off-premise thất bại.",
          };
        }

        return { success: true, data: res };
      } catch (err) {
        const gqlMessage =
          err?.graphQLErrors?.[0]?.message ||
          err?.networkError?.result?.errors?.[0]?.message ||
          err?.message;

        return {
          success: false,
          message: gqlMessage || "Thanh toán thất bại.",
        };
      }
    },
    [
      currentOrderType,
      totals.total,
      validatePayment,
      mutPayByOrderIds,
      currentTable?.id,
      currentTable?._id,
      activeGroup?.tableId,
      mutPayByTable,
    ],
  );

  const payOrderByIds = useCallback(
    async ({
      restaurantId,
      orderIds = [],
      method = "cash",
      note = "",
    } = {}) => {
      if (!restaurantId) throw new Error("Thiếu restaurantId.");
      if (!Array.isArray(orderIds) || !orderIds.length)
        throw new Error("Thiếu orderIds để thanh toán.");
      const { data } = await mutPayByOrderIds({
        variables: {
          input: {
            restaurantId,
            orderIds,
            method,
            note,
          },
        },
      });
      const res = data?.payOrdersByOrderIds;
      if (!res?.invoice && !res?.transaction)
        throw new Error("Thanh toán theo order thất bại.");
      return res;
    },
    [mutPayByOrderIds],
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

      return confirmPayment({
        restaurantId,
        method,
        paidAmount: method === "cash" ? totals.total : 0,
        note,
        externalRef,
      });
    },
    [preparePayment, confirmPayment, totals.total],
  );
  const createOnlineOrderPayment = useCallback(
    async ({ restaurantId, orderIds = [], provider = "bank_transfer", paymentMethod, pricing, promotionIds = [] }) => {
      const { data } = await mutCreateOrderPayment({ variables: { input: { restaurantId, orderIds, provider, paymentMethod, pricing, promotionIds } } });
      return data?.createOrderPayment || null;
    },
    [mutCreateOrderPayment],
  );
  const resolvePayableOrderIds = useCallback(
    async ({ restaurantId, tableId = null, explicitOrderIds = [], fallbackOrderId = null } = {}) => {
      const fromActiveSession = [];
      if (restaurantId && tableId) {
        try {
          const { data } = await apollo.query({
            query: ACTIVE_TABLE_SESSION_ORDERS,
            variables: { restaurantId, tableId },
            fetchPolicy: "network-only",
          });
          const activeOrders = Array.isArray(data?.activeTableSessionOrders?.orders)
            ? data.activeTableSessionOrders.orders
            : [];
          activeOrders.forEach((o) => {
            const id = String(o?.id || "").trim();
            const status = String(o?.currentStatus || "").toLowerCase();
            if (!id) return;
            if (["cancelled", "completed"].includes(status)) return;
            fromActiveSession.push(id);
          });
        } catch (_) {}
      }
      const fromExplicit = Array.isArray(explicitOrderIds) ? explicitOrderIds : [];
      const fromCurrentOrder = Array.isArray(currentOrder)
        ? currentOrder.map((item) => item?.sourceOrderId || item?.orderId).filter(Boolean)
        : [];
      const prepared = lastPreparedOrderIdRef.current ? [lastPreparedOrderIdRef.current] : [];
      const combined = [...fromActiveSession, ...fromExplicit, ...fromCurrentOrder, fallbackOrderId, ...prepared]
        .map((id) => String(id || "").trim())
        .filter(Boolean);
      return [...new Set(combined)];
    },
    [apollo, currentOrder],
  );

  const getPaymentSession = useCallback(
    async (id) => {
      const { data } = await apollo.query({ query: GET_PAYMENT_SESSION, variables: { id }, fetchPolicy: "network-only" });
      return data?.paymentSession || null;
    },
    [apollo],
  );
  const cancelOnlinePaymentSession = useCallback(
    async ({ paymentId, reason }) => {
      const { data } = await mutCancelPaymentSession({ variables: { input: { paymentId, reason } } });
      return data?.cancelPaymentSession || null;
    },
    [mutCancelPaymentSession],
  );

  /* ============================================================
     11) FETCH tiện ích (dine-in theo bàn)
     ============================================================ */

  const fetchOrderByTable = useCallback(
    async (restaurantId, tableId, tableCode) => {
      if (!restaurantId || !(tableId || tableCode)) {
        return { success: false, message: "missing restaurantId/tableId" };
      }

      try {
        if (tableId) {
          const { data } = await loadActiveTableSessionOrdersQuery({
            variables: { restaurantId, tableId },
          });
          const payload = data?.activeTableSessionOrders;
          if (payload) {
            const allItems = (payload.orders || []).flatMap((order) =>
              (order.items || []).map((it) => ({
                ...it,
                lineSubtotal:
                  it?.lineSubtotal != null
                    ? Number(it.lineSubtotal)
                    : (Number(it.unitPrice || it.price || 0) +
                        Number(it.modifiersPrice || 0)) *
                      Number(it.quantity || 0),
                isExisting: true,
                isNew: false,
              })),
            );
            return {
              success: true,
              data: [
                {
                  orderCode: payload?.session?.orderCode || null,
                  tableCode: payload.tableCode || tableCode || null,
                  tableId: payload.tableId || tableId || null,
                  latestStatus: "ACTIVE",
                  items: allItems,
                  totals: null,
                  user: null,
                },
              ],
            };
          }
        }
      } catch (e) {
        console.warn(
          "activeTableSessionOrders failed, fallback to ordersGroupedByTable",
          e,
        );
      }

      const { data } = await loadGroupsQuery({
        variables: { restaurantId, tableId, tableCode },
      });

      const rawGroups = data?.ordersGroupedByTable || [];

      const activeGroups = rawGroups.filter((g) => {
        const st = (g.latestStatus || "").toUpperCase();
        return ![
          "ORDER_COMPLETED",
          "ORDER_CANCELLED",
          "FAILED",
          "CANCELLED",
        ].includes(st);
      });

      const normalized = activeGroups.map((group) => {
        const merged = mergeGroupItems(group);
        const items = merged.items.map((it) => ({
          ...it,
          lineSubtotal:
            (Number(it.price || 0) + Number(it.modifiersPrice || 0)) *
            Number(it.quantity || 0),
          isExisting: true,
          isNew: false,
          _lineId: `grp_${group.orderCode}_${it._id || it.dishId || it.name || "x"}`,
        }));

        const ordersArr = Array.isArray(group.orders) ? group.orders : [];
        const lastOrder =
          ordersArr.length > 0 ? ordersArr[ordersArr.length - 1] : null;
        const user = lastOrder && lastOrder.user ? lastOrder.user : null;

        return {
          orderCode: group.orderCode,
          tableCode: group.tableCode,
          tableId: group.tableId,
          latestStatus: group.latestStatus,
          items,
          totals: merged.totals,
          user,
        };
      });

      return { success: true, data: normalized };
    },
    [loadActiveTableSessionOrdersQuery, loadGroupsQuery, mergeGroupItems],
  );

  const fetchOrderById = useCallback(
    async (id) => {
      if (!id) return { success: false, message: "Missing order ID" };
      try {
        const res = await loadOrderById({ variables: { id } });
        const order = res?.data?.order ?? null;
        const mapped = order
          ? {
              ...order,
              items: Array.isArray(order.items)
                ? order.items.map(mapServerItemToUi)
                : [],
            }
          : null;
        return { success: true, data: mapped };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    [loadOrderById, mapServerItemToUi],
  );

  /* ============================================================
     12) CUSTOMER helpers (dine-in, theo đợt)
     ============================================================ */

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
        const ok = data?.updateOrderCustomerByCode?.success;
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
    [mutUpdateOrderCustomerByCode, currentTable?.code, loadGroupsForTable],
  );

  /* ============================================================
     13) RETURN
     ============================================================ */

  const mapOrderForUi = useCallback(
    (order) => {
      if (!order) return order;
      const items = Array.isArray(order.items)
        ? order.items.map(mapServerItemToUi)
        : [];
      return { ...order, items };
    },
    [mapServerItemToUi],
  );

  const ordersNow = useMemo(() => {
    const nodes =
      ordersNowData?.ordersByRestaurantNow?.edges?.map((e) => e.node) || [];
    return nodes.map(mapOrderForUi);
  }, [ordersNowData, mapOrderForUi]);

  const ordersAll = useMemo(() => {
    const nodes =
      ordersAllData?.ordersByRestaurant?.edges?.map((e) => e.node) || [];
    return nodes.map(mapOrderForUi);
  }, [ordersAllData, mapOrderForUi]);

  const orderById = useMemo(() => {
    const order = orderByIdData?.order ?? null;
    return order ? mapOrderForUi(order) : null;
  }, [orderByIdData, mapOrderForUi]);

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

    // batch groups (dine-in)
    groups,
    activeGroup,
    setActiveGroup,
    mergedCurrent,
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
    changeOrderItemPriority,

    // back-compat
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
    orderById,
    loadOrders,
    orders,

    // payment API
    preparePayment,
    validatePayment,
    confirmPayment,
    checkoutOrder,
    createOnlineOrderPayment,
    cancelOnlinePaymentSession,
    getPaymentSession,
    resolvePayableOrderIds,
    payOrderByIds,
    payLoading: payLoadingByTable || payLoadingByOrderIds,
    reviewOrderItemVoid,
    requestOrderItemReturn,
    reviewOrderItemReturn,

    // customer (dine-in, theo orderCode)
    updateOrderCustomerByCode,
  };
}
