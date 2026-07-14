import mongoose from "mongoose";
import { Reservation } from "../../../models/index.js";
import {
  OrderCoreRecoveryQuery as LegacyOrderCoreRecoveryQuery,
} from "./queryCoreRecoveryLegacy.js";

const TERMINAL_RESERVATION_STATUSES = new Set([
  "cancelled",
  "completed",
  "no_show",
]);
const NON_SERVICEABLE_RESERVATION_STATUSES = new Set(["pending_payment"]);

const isPaidOrder = (order) => {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const orderPaymentStatus = String(
    order?.orderPaymentStatus || "",
  ).toLowerCase();

  return paymentStatus === "paid" || orderPaymentStatus === "paid";
};

const getOrderReservationId = (order) => {
  const reservationId =
    order?.reservationId || order?.clientMeta?.reservationId || null;
  return reservationId ? String(reservationId) : null;
};

const isDetachedReservationPreorder = (order) =>
  Boolean(
    getOrderReservationId(order) &&
      !order?.parentOrderId &&
      !order?.rootOrderId,
  );

const filterActiveOrders = (orders = []) =>
  (Array.isArray(orders) ? orders : []).filter(
    (order) => !isPaidOrder(order) && !isDetachedReservationPreorder(order),
  );

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const orderKey = (order) =>
  String(order?.id || order?._id || order?.orderCode || "");

const toTime = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

function isFutureReservationOrder(order, reservation, now = new Date()) {
  if (!getOrderReservationId(order) || !reservation) return false;
  if (normalizeStatus(reservation.status) === "seated") return false;

  const scheduledAt = toTime(reservation.timeTo);
  const nowAt = toTime(now);
  return scheduledAt !== null && nowAt !== null && scheduledAt > nowAt;
}

function enrichOrderWithReservation(order, reservation) {
  if (!reservation) return order;
  const scheduledAt = reservation.timeTo
    ? new Date(reservation.timeTo).toISOString()
    : null;
  const reservationId =
    getOrderReservationId(order) || String(reservation._id || "") || null;

  return {
    ...order,
    reservationId,
    customerInfo: {
      ...(order?.customerInfo || {}),
      name:
        reservation.customerName || order?.customerInfo?.name || null,
      phone:
        reservation.customerPhone || order?.customerInfo?.phone || null,
      email:
        reservation.customerEmail || order?.customerInfo?.email || null,
      note: reservation.note || order?.customerInfo?.note || null,
      partySize:
        reservation.partySize ?? order?.customerInfo?.partySize ?? null,
      timeTo: scheduledAt || order?.customerInfo?.timeTo || null,
    },
    clientMeta: {
      ...(order?.clientMeta || {}),
      reservationId,
      reservationStatus: reservation.status || null,
      reservationTimeTo: scheduledAt,
      reservationOrderCode: reservation.orderCode || null,
    },
  };
}

function classifyOrdersByReservationSchedule(
  orders = [],
  reservationById = new Map(),
  now = new Date(),
) {
  const activeOrders = [];
  const futureOrders = [];

  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order || isPaidOrder(order)) continue;
    const reservationId = getOrderReservationId(order);
    if (!reservationId) {
      activeOrders.push(order);
      continue;
    }

    const reservation = reservationById.get(reservationId) || null;
    if (!reservation) {
      if (!isDetachedReservationPreorder(order)) activeOrders.push(order);
      continue;
    }

    const status = normalizeStatus(reservation.status);
    if (TERMINAL_RESERVATION_STATUSES.has(status)) continue;

    const enriched = enrichOrderWithReservation(order, reservation);
    if (isFutureReservationOrder(order, reservation, now)) {
      futureOrders.push(enriched);
      continue;
    }

    if (NON_SERVICEABLE_RESERVATION_STATUSES.has(status)) continue;
    activeOrders.push(enriched);
  }

  return { activeOrders, futureOrders };
}

async function loadReservationMap(orders = []) {
  const ids = [
    ...new Set(
      (Array.isArray(orders) ? orders : [])
        .map(getOrderReservationId)
        .filter((id) => id && mongoose.isValidObjectId(id)),
    ),
  ];
  if (!ids.length) return new Map();

  const reservations = await Reservation.find({ _id: { $in: ids } })
    .select({
      _id: 1,
      orderCode: 1,
      timeTo: 1,
      status: 1,
      customerName: 1,
      customerPhone: 1,
      customerEmail: 1,
      partySize: 1,
      note: 1,
    })
    .lean();

  return new Map(
    reservations.map((reservation) => [String(reservation._id), reservation]),
  );
}

async function partitionOrdersByReservationSchedule(orders = [], now = new Date()) {
  const reservationById = await loadReservationMap(orders);
  return classifyOrdersByReservationSchedule(orders, reservationById, now);
}

async function activeTableSessionOrders(parent, args, ctx, info) {
  const result = await LegacyOrderCoreRecoveryQuery.activeTableSessionOrders(
    parent,
    args,
    ctx,
    info,
  );
  const { activeOrders } = await partitionOrdersByReservationSchedule(
    result?.orders,
  );

  return {
    ...result,
    orders: activeOrders,
  };
}

async function ordersGroupedByTable(parent, args, ctx, info) {
  const groups = await LegacyOrderCoreRecoveryQuery.ordersGroupedByTable(
    parent,
    args,
    ctx,
    info,
  );
  const allOrders = (Array.isArray(groups) ? groups : []).flatMap((group) =>
    Array.isArray(group?.orders) ? group.orders : [],
  );
  const { activeOrders } = await partitionOrdersByReservationSchedule(allOrders);
  const activeById = new Map(
    activeOrders.map((order) => [orderKey(order), order]),
  );

  return (Array.isArray(groups) ? groups : [])
    .map((group) => {
      const orders = (Array.isArray(group?.orders) ? group.orders : [])
        .map((order) => activeById.get(orderKey(order)) || null)
        .filter(Boolean);
      return {
        ...group,
        orders,
        count: orders.length,
        latestStatus:
          orders[orders.length - 1]?.currentStatus ||
          group?.latestStatus ||
          null,
      };
    })
    .filter((group) => group.orders.length > 0);
}

async function ordersByRestaurantNow(parent, args, ctx, info) {
  const requestedLimit = Math.max(1, Math.min(200, Number(args?.limit) || 20));
  const expandedLimit = Math.min(200, Math.max(requestedLimit, requestedLimit * 3));
  const result = await LegacyOrderCoreRecoveryQuery.ordersByRestaurantNow(
    parent,
    { ...args, limit: expandedLimit },
    ctx,
    info,
  );
  const sourceEdges = Array.isArray(result?.edges) ? result.edges : [];
  const { activeOrders } = await partitionOrdersByReservationSchedule(
    sourceEdges.map((edge) => edge?.node).filter(Boolean),
  );
  const activeById = new Map(
    activeOrders.map((order) => [orderKey(order), order]),
  );
  const filteredEdges = sourceEdges
    .map((edge) => {
      const node = activeById.get(orderKey(edge?.node));
      return node ? { ...edge, node } : null;
    })
    .filter(Boolean);
  const visibleEdges = filteredEdges.slice(0, requestedLimit);

  return {
    ...result,
    edges: visibleEdges,
    pageInfo: {
      ...(result?.pageInfo || {}),
      endCursor:
        visibleEdges[visibleEdges.length - 1]?.cursor ||
        result?.pageInfo?.endCursor ||
        null,
      hasNextPage:
        filteredEdges.length > requestedLimit ||
        Boolean(result?.pageInfo?.hasNextPage),
    },
  };
}

async function futureReservationOrders(parent, args, ctx, info) {
  const safeLimit = Math.max(1, Math.min(200, Number(args?.limit) || 100));
  const result = await LegacyOrderCoreRecoveryQuery.ordersByRestaurantNow(
    parent,
    {
      restaurantId: args?.restaurantId,
      limit: 200,
      cursor: null,
    },
    ctx,
    info,
  );
  const sourceOrders = (Array.isArray(result?.edges) ? result.edges : [])
    .map((edge) => edge?.node)
    .filter(Boolean);
  const { futureOrders } = await partitionOrdersByReservationSchedule(
    sourceOrders,
  );

  return [...futureOrders]
    .sort((left, right) => {
      const leftTime = toTime(left?.customerInfo?.timeTo) || 0;
      const rightTime = toTime(right?.customerInfo?.timeTo) || 0;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return orderKey(left).localeCompare(orderKey(right));
    })
    .slice(0, safeLimit);
}

export const orderCoreRecoveryInternals = {
  classifyOrdersByReservationSchedule,
  enrichOrderWithReservation,
  filterActiveOrders,
  getOrderReservationId,
  isDetachedReservationPreorder,
  isFutureReservationOrder,
  isPaidOrder,
};

export const OrderCoreRecoveryQuery = {
  ...LegacyOrderCoreRecoveryQuery,
  activeTableSessionOrders,
  ordersGroupedByTable,
  ordersByRestaurantNow,
  futureReservationOrders,
};
