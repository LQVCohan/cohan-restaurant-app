// src/graphql/resolvers/order/mutation.js (UPDATED - servingKey required, BY_WEIGHT grams integer)
import mongoose from "mongoose";

import {
  Order,
  Reservation,
  TableCustomer,
  Warehouse,
} from "../../../models/index.js";

import { normalizeItem, computeTotals, toId } from "./helper/orderUtils.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { ensureUserForOrder, resolveTable } from "./helper/userUtils.js";
import { markTableStatus } from "./helper/tableUtils.js";
import { createOrderTrackingEvent } from "./helper/tracking.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";

const RESERVABLE_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
];
const COMMIT_STATUSES = ["preparing", "ready", "served", "completed"];

const CANCELLED_ITEM_STATUSES = ["cancelled", "returned"];

/** =========================
 * Standard unit guards
 * ========================= */
function assertPositiveIntegerGrams(v, field = "weightGrams") {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(
      `${field} must be a positive integer (grams). Có lỗi trong chuyển đổi sang đơn vị chuẩn.`
    );
  }
  return n;
}

function assertPositiveNumber(v, field = "quantity") {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be > 0`);
  return n;
}

/** =========================
 * Inventory line builders (NEW STANDARD)
 * - REQUIRED servingKey
 * - BY_WEIGHT requires weightGrams integer (grams)
 * - NO servingVariantId fallback anymore
 * ========================= */
function buildInventoryLineFromItem(it) {
  if (!it) return null;

  const menuItemId = it.dishId;
  if (!menuItemId) return null;

  // ✅ chuẩn mới: chỉ dùng servingKey (ổn định theo recipe.key)
  const servingKey = it.servingKey ? String(it.servingKey).trim() : "";
  if (!servingKey) {
    throw new Error(
      "servingKey is required for inventory. Có lỗi trong chuyển đổi sang đơn vị chuẩn."
    );
  }

  const mode = it.servingVariant?.mode ?? null;

  // ✅ BY_WEIGHT: quantity luôn = 1, weightGrams bắt buộc integer
  if (mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
    return {
      menuItemId,
      quantity: 1,
      weightGrams: grams,
      servingKey,

      // optional debug
      servingMode: "BY_WEIGHT",
      preparationMethodName: it.servingVariant?.name ?? null,
    };
  }

  // PORTION (hoặc fallback basePrice): quantity > 0
  const qty = assertPositiveNumber(it.quantity ?? 1, "quantity");

  // weightGrams không bắt buộc, nhưng nếu có truyền thì cũng phải integer grams (để không phát sinh lệch chuẩn)
  let gramsOrNull = null;
  if (it.weightGrams != null) {
    gramsOrNull = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
  }

  return {
    menuItemId,
    quantity: qty,
    weightGrams: gramsOrNull,
    servingKey,

    // optional debug
    servingMode: it.servingVariant?.mode ?? null,
    preparationMethodName: it.servingVariant?.name ?? null,
  };
}

function buildInventoryLinesFromItems(items = []) {
  return (items || [])
    .filter((it) => it && !CANCELLED_ITEM_STATUSES.includes(it.status))
    .map(buildInventoryLineFromItem)
    .filter(Boolean);
}

/** =========================
 * Find / create orderCode
 * ========================= */
async function findOrCreateOrderCode({
  restaurantId,
  tableId,
  tableCode,
  requestedOrderCode,
  session,
}) {
  if (requestedOrderCode && String(requestedOrderCode).trim()) {
    return String(requestedOrderCode).trim();
  }

  const activeResQuery = Reservation.findOne(
    {
      restaurantId: toId(restaurantId),
      tableId: toId(tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    },
    { orderCode: 1 }
  ).sort({ createdAt: -1 });

  if (session) activeResQuery.session(session);
  const activeRes = await activeResQuery.lean();

  if (activeRes?.orderCode) return activeRes.orderCode;

  const firstOrderQuery = Order.findOne(
    {
      restaurantId: toId(restaurantId),
      tableCode,
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
    },
    { orderCode: 1, createdAt: 1 }
  ).sort({ createdAt: 1, _id: 1 });

  if (session) firstOrderQuery.session(session);
  const firstOrder = await firstOrderQuery.lean();

  if (firstOrder?.orderCode) return firstOrder.orderCode;

  return generateOrderCode("POS", new Date(), tableCode || null);
}

/** =========================
 * Upsert TableCustomer
 * ========================= */
async function upsertTableCustomerFromOrder({
  restaurantId,
  tableId,
  tableCode,
  orderCode,
  customer,
  note,
  session,
}) {
  if (!restaurantId || (!tableId && !tableCode && !orderCode)) return;

  const rid = toId(restaurantId);
  if (!rid) return;

  const tid = tableId ? toId(tableId) : null;

  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : tableCode
      ? { restaurantId: rid, tableCode: String(tableCode) }
      : { restaurantId: rid, orderCode: String(orderCode) };

  const fullName = (customer?.fullName || customer?.name || "").trim() || null;
  const phone = customer?.phone ? String(customer.phone).trim() : null;
  const email = customer?.email ? String(customer.email).trim() : null;

  const update = {
    $set: {
      restaurantId: rid,
      ...(tid != null ? { tableId: tid } : {}),
      ...(tableCode ? { tableCode: String(tableCode) } : {}),
      ...(orderCode ? { orderCode: String(orderCode) } : {}),
      customerName: fullName,
      customerPhone: phone,
      customerEmail: email,
      note: note ?? null,
      updatedAt: new Date(),
    },
    $setOnInsert: { createdAt: new Date() },
  };

  await TableCustomer.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    session: session || undefined,
  }).lean();
}

/** =========================
 * Resolve warehouse id (session-aware)
 * ========================= */
async function resolveWarehouseIdOrDefault(
  restaurantId,
  warehouseIdInput,
  session
) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for warehouse resolution");

  if (warehouseIdInput) {
    const wid = toId(warehouseIdInput);
    if (!wid) throw new Error("Invalid warehouseId");
    return wid;
  }

  const q = Warehouse.findOne({ restaurantId: rid, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });

  if (session) q.session(session);

  const wh = await q.lean();
  if (!wh) throw new Error("No warehouse found for this restaurant");
  return wh._id;
}

/** =========================
 * Shipping builder (off-premise)
 * ========================= */
function buildShippingForOffPremise(orderType, shipping = {}, customer = {}) {
  const s = shipping || {};
  const c = customer || {};
  const baseLocation = s.location || s.customerLocation || null;

  return {
    fullName: s.fullName || c.fullName || c.name || null,
    phone: s.phone || c.phone || null,
    email: s.email || c.email || null,
    address: s.address || null,
    note: s.note || null,

    location: baseLocation
      ? {
          lat: baseLocation.lat ?? null,
          lng: baseLocation.lng ?? null,
          address: baseLocation.address ?? s.address ?? null,
        }
      : undefined,

    distance: s.distance ?? null,
    shippingFee: s.shippingFee ?? 0,

    deliveryMethod: s.deliveryMethod || null,
    deliveryTime: s.deliveryTime || null,
    scheduleDate: s.scheduleDate || null,
    scheduleTime: s.scheduleTime || null,

    customerLocation: s.customerLocation
      ? {
          lat: s.customerLocation.lat ?? null,
          lng: s.customerLocation.lng ?? null,
          address: s.customerLocation.address ?? null,
        }
      : undefined,

    restaurantLocation: s.restaurantLocation
      ? {
          lat: s.restaurantLocation.lat ?? null,
          lng: s.restaurantLocation.lng ?? null,
          address: s.restaurantLocation.address ?? null,
        }
      : undefined,

    driverLocation: s.driverLocation
      ? {
          lat: s.driverLocation.lat ?? null,
          lng: s.driverLocation.lng ?? null,
          address: s.driverLocation.address ?? null,
          accuracy: s.driverLocation.accuracy ?? null,
          speed: s.driverLocation.speed ?? null,
          bearing: s.driverLocation.bearing ?? null,
          updatedAt: s.driverLocation.updatedAt || new Date(),
        }
      : undefined,

    driverName: s.driverName || null,
    driverPhone: s.driverPhone || null,
    driverAvatar: s.driverAvatar || null,
    driverVehiclePlate: s.driverVehiclePlate || null,

    deliveryStatus: s.deliveryStatus || "pending",

    duration: s.duration ?? null,
    eta: s.eta ? new Date(s.eta) : null,

    externalTrackingCode: s.externalTrackingCode || null,
  };
}

export const OrderMutation = {
  /** =========================================
   * CREATE / APPEND TABLE ORDER (dine_in)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOrAppendTableOrder(_, { input }, ctx) {
    const {
      restaurantId,
      tableId,
      tableCode,
      orderCode,
      items,
      note,
      customer,
      userId,
      clientMeta,
      warehouseId,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    const activeReservation = await Reservation.findOne({
      restaurantId: rid,
      tableId: toId(tableInfo.tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const reservationCustomer =
      activeReservation &&
      (activeReservation.customerName ||
        activeReservation.customerPhone ||
        activeReservation.customerEmail)
        ? {
            fullName: activeReservation.customerName || undefined,
            phone: activeReservation.customerPhone || undefined,
            email: activeReservation.customerEmail || undefined,
          }
        : null;

    const effectiveCustomer = reservationCustomer || customer || null;

    // normalizeItem (orderUtils) đã enforce servingKey + integer grams
    const normalizedItems = items.map(normalizeItem);
    const totals = computeTotals(normalizedItems);

    const finalUserId = await ensureUserForOrder(userId, effectiveCustomer);

    const effectiveOrderCode =
      (orderCode && String(orderCode).trim()) ||
      (await findOrCreateOrderCode({
        restaurantId,
        tableId: tableInfo.tableId,
        tableCode: tableInfo.tableCode,
      }));

    const session = await mongoose.startSession();
    let createdOrderDoc = null;

    try {
      await session.withTransaction(async () => {
        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              tableId: toId(tableInfo.tableId),
              tableCode: tableInfo.tableCode,

              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType: "dine_in",
              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: { method: "cash", status: "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: "Created via POS",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = order;

        if (effectiveCustomer) {
          await upsertTableCustomerFromOrder({
            restaurantId,
            tableId: tableInfo.tableId,
            tableCode: tableInfo.tableCode,
            orderCode: effectiveOrderCode,
            customer: effectiveCustomer,
            note,
            session,
          });
        }

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
            session, // ✅ atomic
          });
        }
      });
    } finally {
      await session.endSession();
    }

    await markTableStatus(restaurantId, tableInfo.tableCode, "occupied");
    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);

    return { isNewOrder: true, order: createdOrderDoc.toJSON() };
  },

  /** =========================================
   * CREATE OFF-PREMISE ORDER (takeaway/delivery)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOffPremiseOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      clientMeta,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const normalizedItems = items.map(normalizeItem);
    const totals = computeTotals(normalizedItems);

    const finalUserId = await ensureUserForOrder(userId, customer);

    const prefix = orderType === "delivery" ? "DEL" : "TAKE";
    const effectiveOrderCode = generateOrderCode(prefix, new Date(), null);

    const shippingObj = buildShippingForOffPremise(
      orderType,
      shipping,
      customer
    );

    const session = await mongoose.startSession();
    let createdOrderDoc = null;

    try {
      await session.withTransaction(async () => {
        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType,
              shipping: shippingObj,

              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: { method: "cash", status: "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: "Off-premise order created",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = order;

        if (customer) {
          await upsertTableCustomerFromOrder({
            restaurantId,
            orderCode: effectiveOrderCode,
            customer,
            note,
            session,
          });
        }

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
            session, // ✅ atomic
          });
        }
      });
    } finally {
      await session.endSession();
    }

    if (createdOrderDoc && createdOrderDoc.orderType === "delivery") {
      await createOrderTrackingEvent({
        order: createdOrderDoc,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: null,
          statusTo: "pending",
          note: "Delivery order created",
        },
      });
    }

    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);
    return { order: createdOrderDoc.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER STATUS
   * - inventory commit/cancel + order save in ONE transaction
   * ========================================= */
  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note, warehouseId } = input || {};
    const oid = toId(id);
    if (!oid) throw new Error("Invalid order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (lines.length) {
          const wasReservable = RESERVABLE_STATUSES.includes(prevStatus);

          if (wasReservable && COMMIT_STATUSES.includes(status)) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session
            );

            await commitReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session, // ✅ atomic
            });
          }

          if (wasReservable && status === "cancelled") {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session
            );

            await cancelReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session, // ✅ atomic
            });
          }
        }

        order.currentStatus = status;
        order.statusTimeline.push({
          status,
          at: new Date(),
          note,
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order && order.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: status,
          note,
        },
      });
    }

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_STATUS_CHANGED", {
      order,
      meta: { statusFrom: prevStatus, statusTo: status, note },
    });

    return order.toJSON();
  },

  /** =========================================
   * UPDATE ORDER ITEM STATUS
   * - if order is reservable: cancel/reserve inventory per-item (atomic with save)
   * ========================================= */
  async updateOrderItemStatus(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, status, note } = input || {};
    const oid = toId(orderId);
    if (!oid) throw new Error("Invalid orderId");
    if (!itemKey || !status) throw new Error("Missing fields");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();
    let order = null;
    let prevItemStatus = null;
    let item = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");

        const idx = order.items.findIndex(
          (it, i) =>
            String(it._id) === String(itemKey) ||
            String(it.dishId) === String(itemKey) ||
            String(i) === String(itemKey)
        );
        if (idx === -1) throw new Error("Item not found");

        item = order.items[idx];
        prevItemStatus = item.status;

        const isOrderReservable = RESERVABLE_STATUSES.includes(
          order.currentStatus
        );

        if (isOrderReservable) {
          const fromCancelled =
            CANCELLED_ITEM_STATUSES.includes(prevItemStatus);
          const toCancelled = CANCELLED_ITEM_STATUSES.includes(status);

          const line = buildInventoryLineFromItem(item);

          if (line) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              null,
              session
            );

            if (!fromCancelled && toCancelled) {
              await cancelReservationForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }

            if (fromCancelled && !toCancelled) {
              await reserveForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }
          }
        }

        item.status = status;

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "item_status_changed",
        ctx,
        payload: {
          itemId: item?._id,
          itemName: item?.name,
          itemStatusFrom: prevItemStatus,
          itemStatusTo: status,
          note,
        },
      });
    }

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_ITEM_STATUS_CHANGED", {
      order,
      meta: {
        itemId: item?._id,
        itemName: item?.name,
        statusFrom: prevItemStatus,
        statusTo: status,
        note,
      },
    });

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER CUSTOMER BY CODE
   * ========================================= */
  async updateOrderCustomerByCode(_, { input }) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    const rid = toId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    if (!orderCode) throw new Error("orderCode is required");
    if (!customer) throw new Error("customer is required");

    const finalUserId = await ensureUserForOrder(userId, customer);

    const res = await Order.updateMany(
      {
        restaurantId: rid,
        orderCode: String(orderCode),
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } }
    );

    const one = await Order.findOne({
      restaurantId: rid,
      orderCode: String(orderCode),
      currentStatus: { $nin: ["completed", "cancelled"] },
    })
      .select({ tableId: 1, tableCode: 1 })
      .lean();

    await upsertTableCustomerFromOrder({
      restaurantId,
      tableId: one?.tableId,
      tableCode: one?.tableCode,
      orderCode,
      customer,
      session: null,
    });

    return { success: true, modifiedCount: res.modifiedCount };
  },

  /** =========================================
   * CANCEL ORDER
   * - cancel reservation + save in one transaction
   * ========================================= */
  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    const rid = toId(restaurantId);
    const oid = toId(orderId);
    if (!rid || !oid) throw new Error("Missing/invalid fields");

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne({ _id: oid, restaurantId: rid }).session(
          session
        );
        if (!order) throw new Error("Order not found");

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (RESERVABLE_STATUSES.includes(prevStatus) && lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await cancelReservationForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: order.orderCode,
            lines,
            session, // ✅ atomic
          });
        }

        order.currentStatus = "cancelled";
        order.statusTimeline.push({
          status: "cancelled",
          at: new Date(),
          note: reason || "Cancelled",
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: "cancelled",
          note: reason || "Cancelled",
        },
      });
    }

    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", order);

    if (order?.tableCode) {
      await markTableStatus(restaurantId, order.tableCode, "available");
    }

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };
