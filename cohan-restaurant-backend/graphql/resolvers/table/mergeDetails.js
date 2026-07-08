import Order from "../../../models/order.model.js";
import Reservation from "../../../models/reservation.model.js";
import Table from "../../../models/table.model.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import * as authorizationService from "../../../src/services/auth/authorization.service.js";

const ACTIVE_ORDER_STATUSES = { $nin: ["completed", "cancelled", "failed"] };
const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];
const MERGE_DETAILS_PERMISSIONS = [
  PERMISSIONS.TABLE_READ,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.RESERVATION_READ,
];

const getId = (value) => String(value?._id || value?.id || value || "");
const normalizeCode = (value) => String(value || "").trim();
const normalizeCodeKey = (value) => normalizeCode(value).toLowerCase();

async function canReadMergeDetails(ctx, restaurantId) {
  if (!ctx?.user || !restaurantId) return false;
  try {
    if (
      typeof authorizationService.requireAnyRestaurantPermission === "function"
    ) {
      await authorizationService.requireAnyRestaurantPermission(
        ctx,
        restaurantId,
        MERGE_DETAILS_PERMISSIONS,
      );
    } else {
      await authorizationService.requireRestaurantPermission(
        ctx,
        restaurantId,
        PERMISSIONS.TABLE_READ,
      );
    }
    return true;
  } catch {
    return false;
  }
}

const getCustomerForSource = (customers, source) =>
  customers.find((customer) => {
    if (customer.tableId && getId(customer.tableId) === getId(source)) return true;
    return normalizeCodeKey(customer.tableCode) === normalizeCodeKey(source.code);
  }) || null;

const getOrderSourceId = (order) =>
  String(order?.clientMeta?.tableMerge?.sourceTableId || order?.tableId || "");

const getSessionKey = (order) =>
  String(
    order?.parentOrderId ||
      order?.rootOrderId ||
      (order?.orderKind === "table_session" ? order?._id : "") ||
      order?.parentOrderCode ||
      order?.orderCode ||
      order?._id ||
      "",
  );

const getSessionCode = (order) =>
  normalizeCode(
    order?.clientMeta?.tableMerge?.sourceSessionCode ||
      order?.parentOrderCode ||
      (order?.orderKind === "table_session" ? order?.orderCode : "") ||
      order?.orderCode,
  );

export async function resolveTableMergeDetails(table, ctx) {
  const sourceIds = Array.isArray(table?.mergedFromTableIds)
    ? [...new Set(table.mergedFromTableIds.map(getId).filter(Boolean))]
    : [];
  if (sourceIds.length < 2) return null;

  const restaurantId = table.restaurantId;
  if (!(await canReadMergeDetails(ctx, restaurantId))) return null;

  const compositeId = getId(table);
  const sourceTables = await Table.find({
    restaurantId,
    _id: { $in: sourceIds },
  })
    .select({ _id: 1, code: 1, status: 1, capacity: 1, position: 1 })
    .lean();
  const sourceCodes = sourceTables.map((source) => normalizeCode(source.code));

  const [customers, orders, reservations] = await Promise.all([
    TableCustomer.find({
      restaurantId,
      $or: [
        { tableId: { $in: sourceIds } },
        { tableCode: { $in: sourceCodes } },
      ],
    }).lean(),
    Order.find({
      restaurantId,
      tableId: { $in: [...sourceIds, compositeId] },
      orderType: "dine_in",
      currentStatus: ACTIVE_ORDER_STATUSES,
    })
      .select({
        _id: 1,
        tableId: 1,
        tableCode: 1,
        orderCode: 1,
        parentOrderCode: 1,
        parentOrderId: 1,
        rootOrderId: 1,
        orderKind: 1,
        currentStatus: 1,
        totals: 1,
        clientMeta: 1,
        createdAt: 1,
      })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    Reservation.find({
      restaurantId,
      $or: [
        { tableId: compositeId },
        { tableId: { $in: sourceIds } },
        { sourceTableId: { $in: sourceIds } },
      ],
      status: { $in: ACTIVE_RESERVATION_STATUSES },
    })
      .select({
        _id: 1,
        tableId: 1,
        sourceTableId: 1,
        sourceTableCode: 1,
        orderCode: 1,
        status: 1,
        customerName: 1,
        customerPhone: 1,
        partySize: 1,
        timeTo: 1,
      })
      .sort({ timeTo: 1 })
      .lean(),
  ]);

  const customerNames = [];
  const sessionMap = new Map();

  for (const order of orders) {
    if (order.orderKind === "table_session") continue;
    const sourceId = getOrderSourceId(order);
    const key = getSessionKey(order);
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        sessionId: key,
        sessionCode: getSessionCode(order),
        sourceTableId: sourceId,
        sourceTableCode:
          normalizeCode(order?.clientMeta?.tableMerge?.sourceTableCode) ||
          normalizeCode(order.tableCode),
        orderCodes: [],
        totalAmount: 0,
      });
    }
    const session = sessionMap.get(key);
    if (order.orderCode && !session.orderCodes.includes(order.orderCode)) {
      session.orderCodes.push(order.orderCode);
    }
    session.totalAmount += Number(order?.totals?.grandTotal || 0);
  }

  const sources = sourceTables
    .slice()
    .sort((a, b) =>
      normalizeCode(a.code).localeCompare(normalizeCode(b.code), "vi", {
        numeric: true,
        sensitivity: "base",
      }),
    )
    .map((source) => {
      const sourceId = getId(source);
      const customer = getCustomerForSource(customers, source);
      const customerName = normalizeCode(customer?.customerName);
      if (customerName && !customerNames.includes(customerName)) {
        customerNames.push(customerName);
      }

      const sourceSessions = [...sessionMap.values()].filter(
        (session) => String(session.sourceTableId) === sourceId,
      );
      const sourceReservation = reservations.find(
        (reservation) =>
          String(reservation.sourceTableId || reservation.tableId) === sourceId,
      );

      return {
        tableId: sourceId,
        tableCode: normalizeCode(source.code),
        status: source.status || "available",
        capacity: Number(source.capacity || 0),
        customer: customer
          ? {
              id: getId(customer),
              name: customerName || null,
              phone: customer.customerPhone || null,
              email: customer.customerEmail || null,
              partySize: Number(customer.partySize || 0),
            }
          : null,
        reservation: sourceReservation
          ? {
              id: getId(sourceReservation),
              orderCode: sourceReservation.orderCode || null,
              status: sourceReservation.status,
              customerName: sourceReservation.customerName || null,
              customerPhone: sourceReservation.customerPhone || null,
              partySize: Number(sourceReservation.partySize || 0),
              timeTo: sourceReservation.timeTo || null,
            }
          : null,
        orderSessions: sourceSessions,
      };
    });

  const orderSessions = [...sessionMap.values()];
  const totalOpenAmount = orderSessions.reduce(
    (sum, session) => sum + Number(session.totalAmount || 0),
    0,
  );

  return {
    isMerged: true,
    tableId: compositeId,
    tableCode: normalizeCode(table.code),
    anchorTableId: getId(table.mergeAnchorTableId) || sourceIds[0],
    sourceTableIds: sourceIds,
    sourceTableCodes: sources.map((source) => source.tableCode),
    sourceCount: sources.length,
    customerNames,
    customerLabel: customerNames.join(" + "),
    customerCount: customerNames.length,
    reservationCount: reservations.length,
    activeOrderSessionCount: orderSessions.length,
    activeOrderCount: orderSessions.reduce(
      (sum, session) => sum + session.orderCodes.length,
      0,
    ),
    totalOpenAmount,
    sources,
    orderSessions,
  };
}
