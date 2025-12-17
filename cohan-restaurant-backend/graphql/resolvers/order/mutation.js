// src/graphql/resolvers/order/mutation.js (FINAL)
import mongoose from "mongoose";

import {
  Order,
  Reservation,
  TableCustomer,
  Warehouse,
} from "../../../models/index.js";

import { normalizeItem, computeTotals, toId } from "./helper/orderUtils.js"; // <- chỉnh path nếu khác
import { emitOrderEvent } from "./helper/emitOrderEvent.js"; // <- chỉnh path nếu khác
import { ensureUserForOrder, resolveTable } from "./helper/userUtils.js"; // <- chỉnh path nếu khác
import { markTableStatus } from "./helper/tableUtils.js"; // <- chỉnh path nếu khác
import { createOrderTrackingEvent } from "./helper/tracking.js"; // <- chỉnh path nếu khác
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

/** =========================
 *  Inventory line builder
 *  ========================= */
function buildInventoryLinesFromItems(items = []) {
  return (items || [])
    .map((it) => ({
      menuItemId: it.dishId,
      quantity: it.quantity ?? 1, // PORTION
      weightGrams: it.weightGrams ?? null, // BY_WEIGHT
      servingVariantId: it.servingVariantId, // REQUIRED
      servingVariantMode: it.servingVariant?.mode ?? null, // service check chéo (optional)
    }))
    .filter((l) => l.menuItemId);
}

/** =========================
 *  Find / create orderCode
 *  ========================= */
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

  // Nếu có reservation active → lấy orderCode
  const activeRes = await Reservation.findOne(
    {
      restaurantId: toId(restaurantId),
      tableId: toId(tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    },
    { orderCode: 1 }
  )
    .sort({ createdAt: -1 })
    .session?.(session);

  if (activeRes?.orderCode) return activeRes.orderCode;

  // Nếu bàn đã có “đợt” orderCode đang chạy → reuse
  const firstOrder = await Order.findOne(
    {
      restaurantId: toId(restaurantId),
      tableCode,
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
    },
    { orderCode: 1, createdAt: 1 }
  )
    .sort({ createdAt: 1, _id: 1 })
    .session?.(session);

  if (firstOrder?.orderCode) return firstOrder.orderCode;

  return generateOrderCode("POS", new Date(), tableCode || null);
}

/** =========================
 *  Upsert TableCustomer
 *  ========================= */
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
    session,
  }).lean();
}

/** =========================
 *  Resolve warehouse id
 *  ========================= */
async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for warehouse resolution");

  if (warehouseIdInput) {
    const wid = toId(warehouseIdInput);
    if (!wid) throw new Error("Invalid warehouseId");
    return wid;
  }

  const wh = await Warehouse.findOne({ restaurantId: rid, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!wh) throw new Error("No warehouse found for this restaurant");
  return wh._id;
}

/** =========================
 *  Shipping builder (off-premise)
 *  (giữ nguyên logic cũ, chỉ clean lại)
 *  ========================= */
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
   * - batch-based
   * - reserve inventory
   * - mark table occupied
   * - ưu tiên reservation customer
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

    // active reservation → override customer
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
            warehouseId
          );
          await reserveForOrderTx({
            restaurantId,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
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
   * - reserve inventory
   * - tracking event for delivery
   * ========================================= */
  async createOffPremiseOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType, // "takeaway" | "delivery"
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

              orderType, // takeaway/delivery
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
            warehouseId
          );
          await reserveForOrderTx({
            restaurantId,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
          });
        }
      });
    } finally {
      await session.endSession();
    }

    // tracking chỉ cho delivery
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
   * - commit/cancel inventory reservation
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

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const prevStatus = order.currentStatus;
    const lines = buildInventoryLinesFromItems(order.items);

    if (lines.length) {
      const wasReservable = RESERVABLE_STATUSES.includes(prevStatus);

      if (wasReservable && COMMIT_STATUSES.includes(status)) {
        const whId = await resolveWarehouseIdOrDefault(
          order.restaurantId,
          warehouseId
        );
        await commitReservationForOrderTx({
          restaurantId: order.restaurantId,
          warehouseId: whId,
          orderCode: order.orderCode,
          lines,
        });
      }

      if (wasReservable && status === "cancelled") {
        const whId = await resolveWarehouseIdOrDefault(
          order.restaurantId,
          warehouseId
        );
        await cancelReservationForOrderTx({
          restaurantId: order.restaurantId,
          warehouseId: whId,
          orderCode: order.orderCode,
          lines,
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

    await order.save();

    // tracking event (delivery)
    if (order.orderType === "delivery") {
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

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const idx = order.items.findIndex(
      (it, i) =>
        String(it._id) === String(itemKey) ||
        String(it.dishId) === String(itemKey) ||
        String(i) === String(itemKey)
    );
    if (idx === -1) throw new Error("Item not found");

    const item = order.items[idx];
    const prevItemStatus = item.status;

    item.status = status;

    await order.save();

    if (order.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "item_status_changed",
        ctx,
        payload: {
          itemId: item._id,
          itemName: item.name,
          itemStatusFrom: prevItemStatus,
          itemStatusTo: status,
          note,
        },
      });
    }

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_ITEM_STATUS_CHANGED", {
      order,
      meta: {
        itemId: item._id,
        itemName: item.name,
        statusFrom: prevItemStatus,
        statusTo: status,
        note,
      },
    });

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER CUSTOMER BY CODE
   * - attach / ensure user
   * - upsert TableCustomer
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
   * - cancel reservation inventory
   * - mark table available
   * ========================================= */
  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    const rid = toId(restaurantId);
    const oid = toId(orderId);
    if (!rid || !oid) throw new Error("Missing/invalid fields");

    const order = await Order.findOne({ _id: oid, restaurantId: rid });
    if (!order) throw new Error("Order not found");

    const prevStatus = order.currentStatus;
    const lines = buildInventoryLinesFromItems(order.items);

    if (RESERVABLE_STATUSES.includes(prevStatus) && lines.length) {
      const whId = await resolveWarehouseIdOrDefault(restaurantId, warehouseId);
      await cancelReservationForOrderTx({
        restaurantId,
        warehouseId: whId,
        orderCode: order.orderCode,
        lines,
      });
    }

    order.currentStatus = "cancelled";
    order.statusTimeline.push({
      status: "cancelled",
      at: new Date(),
      note: reason || "Cancelled",
      byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
    });

    await order.save();

    if (order.orderType === "delivery") {
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
    if (order.tableCode)
      await markTableStatus(restaurantId, order.tableCode, "available");

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };
