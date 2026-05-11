export const ORDER_KIND = Object.freeze({
  TABLE_SESSION: "table_session",
  ORDER_BATCH: "order_batch",
  SPLIT_BILL: "split_bill",
});

export const SESSION_STATUS = Object.freeze({
  OPEN: "open",
  DINING: "dining",
  READY_TO_PAY: "ready_to_pay",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

export const KITCHEN_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CUSTOMER_ATTACHED: "customer_attached",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
  FAILED: "failed",
});

export const ORDER_PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PAYMENT_REQUESTED: "payment_requested",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

export const SPLIT_STATUS = Object.freeze({
  NONE: "none",
  ROOT: "root",
  ROOT_HIDDEN: "root_hidden",
  PARTIAL: "partial",
});

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isBlankStatus(value) {
  return value == null || String(value).trim() === "";
}

function normalizeTableCode(value) {
  return String(value || "").trim().toUpperCase();
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || String(error?.message || "").includes("E11000");
}

async function runLeanQuery(query, { session = null, sort = null } = {}) {
  let chain = query;

  if (session && typeof chain?.session === "function") {
    chain = chain.session(session);
  }

  if (sort && typeof chain?.sort === "function") {
    chain = chain.sort(sort);
  }

  if (typeof chain?.lean === "function") {
    return chain.lean();
  }

  return chain;
}

export const INACTIVE_ORDER_STATUSES = ["completed", "cancelled", "failed"];

export const ACTIVE_SESSION_STATUSES = [
  SESSION_STATUS.OPEN,
  SESSION_STATUS.DINING,
  SESSION_STATUS.READY_TO_PAY,
];

export const ACTIVE_TABLE_SESSION_SORT = Object.freeze({
  openedAt: -1,
  createdAt: -1,
  _id: -1,
});

export function buildActiveTableSessionKey({ restaurantId, tableId }) {
  if (!restaurantId || !tableId) return null;
  return `${String(restaurantId)}:${String(tableId)}:active`;
}

export function activeTableSessionKeyFilter({ restaurantId, tableId }) {
  const activeSessionKey = buildActiveTableSessionKey({ restaurantId, tableId });
  return activeSessionKey ? { activeSessionKey } : {};
}

export function orderBatchOrLegacyFilter() {
  return {
    $or: [
      { orderKind: ORDER_KIND.ORDER_BATCH },
      { orderKind: { $exists: false } },
      { orderKind: null },
    ],
  };
}

export function withOrderBatchOrLegacyFilter(baseFilter = {}) {
  return {
    $and: [baseFilter, orderBatchOrLegacyFilter()],
  };
}

export function activeTableSessionFilter({ restaurantId, tableId }) {
  return {
    restaurantId,
    tableId,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
  };
}

export function activeTableSessionLookupFilter({ restaurantId, tableId, tableCode }) {
  const base = {
    restaurantId,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
  };

  if (tableId) return { ...base, tableId };
  if (tableCode) return { ...base, tableCode };

  return base;
}

export async function ensureActiveTableSessionForDineInOrder({
  OrderModel,
  createOrderCode,
  restaurantId,
  tableId,
  tableCode,
  userId,
  session = null,
  now = new Date(),
}) {
  if (!OrderModel) throw new Error("OrderModel is required");
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!tableId) throw new Error("tableId is required");

  const normalizedTableCode = normalizeTableCode(tableCode);
  if (!normalizedTableCode) {
    throw new Error("tableCode is required");
  }

  const activeSessionKey = buildActiveTableSessionKey({ restaurantId, tableId });
  const byActiveKeyFilter = activeSessionKey
    ? {
        restaurantId,
        activeSessionKey,
        orderKind: ORDER_KIND.TABLE_SESSION,
        sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
        orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
      }
    : null;

  const backfillActiveKeyIfNeeded = async (sessionOrder) => {
    if (!sessionOrder || !activeSessionKey || sessionOrder.activeSessionKey) {
      return sessionOrder;
    }

    try {
      await OrderModel.updateOne(
        { _id: sessionOrder._id, activeSessionKey: { $in: [null, undefined] } },
        { $set: { activeSessionKey } },
        session ? { session } : {},
      );
      return { ...sessionOrder, activeSessionKey };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return sessionOrder;
      }
    }

    if (!byActiveKeyFilter) {
      return sessionOrder;
    }

    const refreshed = await runLeanQuery(OrderModel.findOne(byActiveKeyFilter), {
      session,
      sort: ACTIVE_TABLE_SESSION_SORT,
    });

    return refreshed || sessionOrder;
  };

  if (byActiveKeyFilter) {
    const existingByKey = await runLeanQuery(OrderModel.findOne(byActiveKeyFilter), {
      session,
      sort: ACTIVE_TABLE_SESSION_SORT,
    });

    if (existingByKey) {
      return {
        sessionOrder: existingByKey,
        created: false,
      };
    }
  }

  const lookupFilter = activeTableSessionLookupFilter({
    restaurantId,
    tableId,
    tableCode: normalizedTableCode,
  });

  const existing = await runLeanQuery(OrderModel.findOne(lookupFilter), {
    session,
    sort: ACTIVE_TABLE_SESSION_SORT,
  });

  if (existing) {
    return {
      sessionOrder: await backfillActiveKeyIfNeeded(existing),
      created: false,
    };
  }

  if (typeof createOrderCode !== "function") {
    throw new Error("createOrderCode is required");
  }

  const parentOrderCode = await createOrderCode({
    restaurantId,
    tableId,
    tableCode: normalizedTableCode,
    session,
  });

  try {
    const [created] = await OrderModel.create(
      [
        {
          orderCode: parentOrderCode,
          parentOrderCode: null,
          orderKind: ORDER_KIND.TABLE_SESSION,
          parentOrderId: null,
          rootOrderId: null,
          splitStatus: SPLIT_STATUS.NONE,
          sessionStatus: SESSION_STATUS.OPEN,
          kitchenStatus: KITCHEN_STATUS.DRAFT,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
          activeSessionKey,
          openedAt: now,
          closedAt: null,
          tableId,
          tableCode: normalizedTableCode,
          userId: userId || undefined,
          restaurantId,
          orderType: "dine_in",
          items: [],
          totals: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            service: 0,
            shippingFee: 0,
            grandTotal: 0,
          },
          payment: {
            method: "cash",
            status: "pending",
          },
          currentStatus: KITCHEN_STATUS.PENDING,
          statusTimeline: [
            {
              status: KITCHEN_STATUS.PENDING,
              at: now,
              note: "Opened table session",
            },
          ],
        },
      ],
      session ? { session } : {},
    );

    return {
      sessionOrder: created,
      created: true,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    if (byActiveKeyFilter) {
      const existingByKey = await runLeanQuery(OrderModel.findOne(byActiveKeyFilter), {
        session,
        sort: ACTIVE_TABLE_SESSION_SORT,
      });
      if (existingByKey) {
        return {
          sessionOrder: existingByKey,
          created: false,
        };
      }
    }

    const existingByLookup = await runLeanQuery(OrderModel.findOne(lookupFilter), {
      session,
      sort: ACTIVE_TABLE_SESSION_SORT,
    });

    if (existingByLookup) {
      return {
        sessionOrder: await backfillActiveKeyIfNeeded(existingByLookup),
        created: false,
      };
    }

    throw error;
  }
}

export function childOrdersForSessionFilter({ restaurantId, parentOrderId }) {
  return {
    restaurantId,
    orderKind: ORDER_KIND.ORDER_BATCH,
    $or: [{ parentOrderId }, { rootOrderId: parentOrderId }],
  };
}

export function paymentRequestActiveFilter() {
  return {
    $or: [
      { "payment.status": "payment_requested" },
      { "payment.requestedAt": { $exists: true } },
    ],
  };
}

export function buildClearPaymentRequestUpdate({ now, reason } = {}) {
  return {
    $set: {
      orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
      "payment.status": "pending",
      "payment.requestClearedAt": now || new Date(),
      "payment.requestClearReason": reason || null,
    },
    $unset: {
      "payment.requestedAt": "",
      "payment.requestSource": "",
      "payment.requestedBy": "",
      "payment.requestNote": "",
    },
  };
}

export function resolveSessionStatusAfterClearingPaymentRequest(currentSessionStatus) {
  const normalized = normalizeStatus(currentSessionStatus);

  if (normalized === SESSION_STATUS.READY_TO_PAY) {
    return SESSION_STATUS.DINING;
  }

  if (ACTIVE_SESSION_STATUSES.includes(normalized)) {
    return normalized;
  }

  return SESSION_STATUS.OPEN;
}

export async function clearTablePaymentRequestState({
  OrderModel,
  restaurantId,
  activeSession,
  reason,
  now = new Date(),
  session = null,
  excludeOrderIds = [],
}) {
  if (!OrderModel || !restaurantId || !activeSession?._id) {
    return { session: activeSession || null, orders: [] };
  }

  const sessionOptions = session ? { session } : {};
  const childFilter = {
    $and: [
      childOrdersForSessionFilter({
        restaurantId,
        parentOrderId: activeSession._id,
      }),
      {
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
        "payment.status": { $ne: "paid" },
      },
      paymentRequestActiveFilter(),
    ],
  };

  const normalizedExcludeOrderIds = (excludeOrderIds || []).filter(Boolean);
  if (normalizedExcludeOrderIds.length) {
    childFilter.$and.push({ _id: { $nin: normalizedExcludeOrderIds } });
  }

  await OrderModel.updateMany(
    childFilter,
    buildClearPaymentRequestUpdate({ now, reason }),
    sessionOptions,
  );

  const parentUpdate = buildClearPaymentRequestUpdate({ now, reason });
  parentUpdate.$set.sessionStatus =
    resolveSessionStatusAfterClearingPaymentRequest(activeSession.sessionStatus);

  await OrderModel.updateOne(
    {
      _id: activeSession._id,
      restaurantId,
      orderKind: ORDER_KIND.TABLE_SESSION,
      ...paymentRequestActiveFilter(),
    },
    parentUpdate,
    sessionOptions,
  );

  let sessionQuery = OrderModel.findOne({ _id: activeSession._id });
  if (session) sessionQuery = sessionQuery.session(session);
  const updatedSession = await sessionQuery.lean();

  let ordersQuery = OrderModel.find({
    $and: [
      childOrdersForSessionFilter({
        restaurantId,
        parentOrderId: activeSession._id,
      }),
      {
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
        "payment.status": { $ne: "paid" },
      },
    ],
  }).sort({ createdAt: 1, _id: 1 });
  if (session) ordersQuery = ordersQuery.session(session);
  const updatedOrders = await ordersQuery.lean();

  return {
    session: updatedSession || activeSession || null,
    orders: updatedOrders,
  };
}

export async function clearPaymentRequestAfterNewChildOrderBatchCreated({
  OrderModel,
  order,
  reason,
  now = new Date(),
  session = null,
}) {
  if (!OrderModel || !order) {
    return { cleared: false, session: null, orders: [] };
  }

  if (
    order.orderType !== "dine_in" ||
    order.orderKind !== ORDER_KIND.ORDER_BATCH
  ) {
    return { cleared: false, session: null, orders: [] };
  }

  const parentOrderId = order.parentOrderId || order.rootOrderId;
  if (!parentOrderId || !order.restaurantId) {
    return { cleared: false, session: null, orders: [] };
  }

  let sessionQuery = OrderModel.findOne({
    _id: parentOrderId,
    restaurantId: order.restaurantId,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    ...paymentRequestActiveFilter(),
  });
  if (session) sessionQuery = sessionQuery.session(session);
  const activeSession = await sessionQuery.lean();

  if (!activeSession) {
    return { cleared: false, session: null, orders: [] };
  }

  const clearedState = await clearTablePaymentRequestState({
    OrderModel,
    restaurantId: order.restaurantId,
    activeSession,
    reason,
    now,
    session,
    excludeOrderIds: [order._id].filter(Boolean),
  });

  return {
    cleared: true,
    ...clearedState,
  };
}

const CLOSED_PAYMENT_STATUSES = new Set([
  ORDER_PAYMENT_STATUS.PAID,
  ORDER_PAYMENT_STATUS.REFUNDED,
  ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
]);

export function isTableSession(order) {
  return order?.orderKind === ORDER_KIND.TABLE_SESSION;
}

export function isOrderBatch(order) {
  return !order?.orderKind || order?.orderKind === ORDER_KIND.ORDER_BATCH;
}

export function isSplitBill(order) {
  return order?.orderKind === ORDER_KIND.SPLIT_BILL;
}

export function isSessionActive(order) {
  return (
    isTableSession(order) &&
    ["open", "dining", "ready_to_pay"].includes(
      String(order?.sessionStatus || ""),
    )
  );
}

export function isPaymentClosed(order) {
  const orderPaymentStatus = normalizeStatus(order?.orderPaymentStatus);

  if (
    !isBlankStatus(order?.orderPaymentStatus) &&
    orderPaymentStatus !== ORDER_PAYMENT_STATUS.UNPAID
  ) {
    return CLOSED_PAYMENT_STATUSES.has(orderPaymentStatus);
  }

  const legacyPaymentStatus = normalizeStatus(order?.payment?.status);
  return CLOSED_PAYMENT_STATUSES.has(legacyPaymentStatus);
}

export function isKitchenPayable(order) {
  if (!isOrderBatch(order)) return false;

  const kitchenStatus = normalizeStatus(order?.kitchenStatus);

  if (
    !isBlankStatus(order?.kitchenStatus) &&
    kitchenStatus !== KITCHEN_STATUS.PENDING
  ) {
    return kitchenStatus === KITCHEN_STATUS.SERVED;
  }

  const legacyStatus = normalizeStatus(order?.currentStatus);
  return legacyStatus === KITCHEN_STATUS.SERVED;
}
