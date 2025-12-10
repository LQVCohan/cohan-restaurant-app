import mongoose from "mongoose";

import {
  Order,
  Recipe,
  Reservation,
  TableCustomer,
  Warehouse,
  MenuItem,
} from "../../../models/index.js";

import {
  normalizeItem,
  computeTotals,
  ensureUserForOrder,
  resolveTable,
  markTableStatus,
  emitOrderEvent,
  toId,
} from "../order/helper/index.js";
import { createOrderTrackingEvent } from "../order/helper/tracking.js";

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

/** Helper: build lines gửi sang inventory từ items trong Order */
function buildInventoryLinesFromItems(items = []) {
  return (items || [])
    .map((it) => ({
      menuItemId: it.dishId, // dishId = MenuItem._id
      quantity: it.quantity ?? 1,
      weightGrams: it.weightGrams ?? null,
      servingKey: it.servingKey ?? null,
      servingMode: it.servingMode ?? null,
      preparationMethodName: it.method ?? null,
    }))
    .filter((l) => l.menuItemId);
}

/** Helper: tìm orderCode “đợt đầu” cho 1 bàn/reservation */
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

/** Helper: upsert TableCustomer theo bàn + orderCode */
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
    $setOnInsert: {
      createdAt: new Date(),
    },
  };

  await TableCustomer.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    session,
  }).lean();
}

/** Helper: chọn warehouseId */
async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput) {
  const rid = toId(restaurantId);
  if (!rid || !mongoose.isValidObjectId(rid)) {
    throw new Error("Invalid restaurantId for warehouse resolution");
  }

  if (warehouseIdInput) {
    if (!mongoose.isValidObjectId(warehouseIdInput)) {
      throw new Error("Invalid warehouseId");
    }
    return warehouseIdInput;
  }

  const wh = await Warehouse.findOne({
    restaurantId: rid,
    isActive: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!wh) {
    throw new Error("No warehouse found for this restaurant");
  }

  return wh._id;
}

/**
 * Helper: build shipping object cho đơn mang đi / giao hàng
 * Tương ứng với ShippingSchema mới (order-shipping.model.js)
 */
function buildShippingForOffPremise(orderType, shipping = {}, customer = {}) {
  const s = shipping || {};
  const c = customer || {};

  // Location cơ bản (địa chỉ giao)
  const baseLocation = s.location || s.customerLocation || null; // nếu đã có LocationInput thì gán thẳng

  return {
    fullName: s.fullName || c.fullName || c.name || null,
    phone: s.phone || c.phone || null,
    email: s.email || c.email || null,
    address: s.address || null,
    note: s.note || null,

    // location cũ: giữ cho backward-compat, thường = địa chỉ giao hàng
    location: baseLocation
      ? {
          lat: baseLocation.lat ?? null,
          lng: baseLocation.lng ?? null,
          address: baseLocation.address ?? s.address ?? null,
        }
      : undefined,

    // khoảng cách, phí ship (nếu có)
    distance: s.distance ?? null,
    shippingFee: s.shippingFee ?? 0,

    deliveryMethod: s.deliveryMethod || null,
    deliveryTime: s.deliveryTime || null,
    scheduleDate: s.scheduleDate || null,
    scheduleTime: s.scheduleTime || null,

    // Vị trí khách / nhà hàng / tài xế
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

    // Thông tin tài xế
    driverName: s.driverName || null,
    driverPhone: s.driverPhone || null,
    driverAvatar: s.driverAvatar || null,
    driverVehiclePlate: s.driverVehiclePlate || null,

    // Trạng thái giao hàng
    deliveryStatus: s.deliveryStatus || "pending",

    duration: s.duration ?? null,
    eta: s.eta ? new Date(s.eta) : null,

    externalTrackingCode: s.externalTrackingCode || null,
  };
}

export const OrderMutation = {
  /**
   * CREATE OR APPEND TABLE ORDER (Batch-based)
   * (dine_in, không log tracking vì tracking chỉ cho delivery)
   */
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

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }

    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    const activeReservation = await Reservation.findOne({
      restaurantId: toId(restaurantId),
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

    const dishIds = items
      .map((i) => i.dishId || i.id)
      .filter((id) => mongoose.isValidObjectId(id));

    const menuItemsMap = new Map();
    if (dishIds.length > 0) {
      const foundMenuItems = await MenuItem.find(
        { _id: { $in: dishIds } },
        { thumbImage: 1 }
      ).lean();
      foundMenuItems.forEach((m) =>
        menuItemsMap.set(String(m._id), m.thumbImage)
      );
    }

    const recipeMap = new Map();
    if (dishIds.length > 0) {
      const foundRecipes = await Recipe.find(
        { menuItemId: { $in: dishIds } },
        { _id: 1, menuItemId: 1 }
      ).lean();
      foundRecipes.forEach((r) => recipeMap.set(String(r.menuItemId), r._id));
    }

    const normalizedItems = [];
    for (const i of items) {
      const n = normalizeItem(i);

      if (Array.isArray(i.proofImages)) {
        n.proofImages = i.proofImages.filter((img) => typeof img === "string");
      } else {
        n.proofImages = [];
      }

      if (i.image && typeof i.image === "string") {
        n.image = i.image;
      } else if (n.dishId && menuItemsMap.has(String(n.dishId))) {
        const thumb = menuItemsMap.get(String(n.dishId));
        if (thumb) n.image = thumb;
      }

      if (n.dishId && recipeMap.has(String(n.dishId))) {
        n.recipeId = recipeMap.get(String(n.dishId));
      }

      normalizedItems.push(n);
    }

    const totals = computeTotals(normalizedItems);

    let finalUserId = null;
    if (activeReservation?.userId) {
      finalUserId = activeReservation.userId;
    } else {
      finalUserId = await ensureUserForOrder(userId, effectiveCustomer);
    }

    const effectiveOrderCode =
      activeReservation?.orderCode ||
      (orderCode && String(orderCode).trim()) ||
      (await findOrCreateOrderCode({
        restaurantId,
        tableId: tableInfo.tableId,
        tableCode: tableInfo.tableCode,
        requestedOrderCode: null,
      }));

    const session = await mongoose.startSession();

    try {
      let createdOrderDoc = null;

      await session.withTransaction(async () => {
        const [newOrder] = await Order.create(
          [
            {
              restaurantId: toId(restaurantId),
              tableId: toId(tableInfo.tableId),
              tableCode: tableInfo.tableCode,
              userId: finalUserId ? toId(finalUserId) : undefined,

              orderCode: effectiveOrderCode,

              orderType: "dine_in",
              shipping: { address: tableInfo.tableCode },
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
                  note: "New batch created via POS",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = newOrder;

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

        const linesForInventory = buildInventoryLinesFromItems(normalizedItems);
        if (linesForInventory.length) {
          const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId
          );

          await reserveForOrderTx({
            restaurantId,
            warehouseId: effectiveWarehouseId,
            orderCode: effectiveOrderCode,
            lines: linesForInventory,
          });
        }
      });

      await session.endSession();

      if (createdOrderDoc) {
        await markTableStatus(restaurantId, tableInfo.tableCode, "occupied");
        await emitOrderEvent(
          ctx,
          restaurantId,
          "ORDER_CREATED",
          createdOrderDoc
        );
        return { isNewOrder: true, order: createdOrderDoc.toJSON() };
      }

      throw new Error("Failed to create order");
    } catch (err) {
      await session.endSession();
      throw new Error(err.message || "Failed to create order");
    }
  },

  /**
   * CREATE OFF-PREMISE ORDER (TAKEAWAY / DELIVERY)
   * dùng ShippingSchema mới, có vị trí & driver
   */
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

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }

    const dishIds = items
      .map((i) => i.dishId || i.id)
      .filter((id) => mongoose.isValidObjectId(id));

    const menuItemsMap = new Map();
    if (dishIds.length > 0) {
      const foundMenuItems = await MenuItem.find(
        { _id: { $in: dishIds } },
        { thumbImage: 1 }
      ).lean();
      foundMenuItems.forEach((m) =>
        menuItemsMap.set(String(m._id), m.thumbImage)
      );
    }

    const recipeMap = new Map();
    if (dishIds.length > 0) {
      const foundRecipes = await Recipe.find(
        { menuItemId: { $in: dishIds } },
        { _id: 1, menuItemId: 1 }
      ).lean();
      foundRecipes.forEach((r) => recipeMap.set(String(r.menuItemId), r._id));
    }

    const normalizedItems = [];
    for (const i of items) {
      const n = normalizeItem(i);

      if (Array.isArray(i.proofImages)) {
        n.proofImages = i.proofImages.filter((img) => typeof img === "string");
      } else {
        n.proofImages = [];
      }

      if (i.image && typeof i.image === "string") {
        n.image = i.image;
      } else if (n.dishId && menuItemsMap.has(String(n.dishId))) {
        const thumb = menuItemsMap.get(String(n.dishId));
        if (thumb) n.image = thumb;
      }

      if (n.dishId && recipeMap.has(String(n.dishId))) {
        n.recipeId = recipeMap.get(String(n.dishId));
      }

      normalizedItems.push(n);
    }

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
    try {
      let createdOrderDoc = null;

      await session.withTransaction(async () => {
        const [newOrder] = await Order.create(
          [
            {
              restaurantId: toId(restaurantId),
              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType, // "takeaway" | "delivery"
              shipping: shippingObj,
              items: normalizedItems,
              totals,
              note,
              currentStatus: "pending",
              payment: {
                method: "cash",
                status: "pending",
              },
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

        createdOrderDoc = newOrder;

        if (customer) {
          await upsertTableCustomerFromOrder({
            restaurantId,
            orderCode: effectiveOrderCode,
            customer,
            note,
            session,
          });
        }

        const linesForInventory = buildInventoryLinesFromItems(normalizedItems);
        if (linesForInventory.length) {
          const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId
          );

          await reserveForOrderTx({
            restaurantId,
            warehouseId: effectiveWarehouseId,
            orderCode: effectiveOrderCode,
            lines: linesForInventory,
          });
        }
      });

      await session.endSession();

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

      if (createdOrderDoc) {
        await emitOrderEvent(
          ctx,
          restaurantId,
          "ORDER_CREATED",
          createdOrderDoc
        );
        return { order: createdOrderDoc.toJSON() };
      }

      throw new Error("Failed to create off-premise order");
    } catch (err) {
      await session.endSession();
      throw new Error(err.message || "Failed to create off-premise order");
    }
  },

  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note, warehouseId } = input || {};
    if (!id) throw new Error("Missing order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: toId(id) };
    if (restaurantId) filter.restaurantId = toId(restaurantId);

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const prevStatus = order.currentStatus;
    const linesForInventory = buildInventoryLinesFromItems(order.items);

    if (linesForInventory.length) {
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
          lines: linesForInventory,
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
          lines: linesForInventory,
        });
      }
    }

    order.currentStatus = status;
    order.statusTimeline.push({
      status,
      at: new Date(),
      note,
      byUserId: ctx?.user?.id,
    });

    await order.save();

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

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_STATUS_CHANGED", {
      order,
      meta: {
        statusFrom: prevStatus,
        statusTo: status,
        note,
      },
    });
    return order.toJSON();
  },

  async updateOrderItemStatus(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, status, note } = input || {};
    if (!orderId || !itemKey || !status) throw new Error("Missing fields");

    const filter = { _id: toId(orderId) };
    if (restaurantId) filter.restaurantId = toId(restaurantId);

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const idx = order.items.findIndex(
      (it, i) =>
        String(it._id) === itemKey ||
        String(it.dishId) === itemKey ||
        String(i) === itemKey
    );
    if (idx === -1) throw new Error("Item not found");

    const item = order.items[idx];
    const prevItemStatus = item.status;

    item.status = status;

    if (Array.isArray(item.statusTimeline)) {
      item.statusTimeline.push({
        status,
        at: new Date(),
        note,
        byUserId: ctx?.user?.id,
      });
    }

    await order.save();

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

  async updateOrderCustomerByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    const finalUserId = await ensureUserForOrder(userId, customer);

    const res = await Order.updateMany(
      {
        restaurantId: toId(restaurantId),
        orderCode,
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } }
    );

    await upsertTableCustomerFromOrder({
      restaurantId,
      orderCode,
      customer,
      session: null,
    });

    return { success: true, modifiedCount: res.modifiedCount };
  },

  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    if (!restaurantId || !orderId) throw new Error("Missing fields");

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: toId(restaurantId),
    });
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
      byUserId: ctx?.user?.id,
    });

    await order.save();

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

    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", order);
    await markTableStatus(restaurantId, order.tableCode, "available");

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };
