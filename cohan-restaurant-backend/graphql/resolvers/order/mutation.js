// src/graphql/resolvers/order/mutation.js

import mongoose from "mongoose";

import {
  Order,
  Recipe,
  Reservation,
  TableCustomer,
  Warehouse,
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
      weightGrams: it.weightGrams ?? null, // nếu sau này có bán theo kg
      servingKey: it.servingKey ?? null,
      servingMode: it.servingMode ?? null,
      preparationMethodName: it.method ?? null, // map method -> preparationMethodName
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
  // 1) Ưu tiên orderCode được truyền vào (FE biết trước)
  if (requestedOrderCode && String(requestedOrderCode).trim()) {
    return String(requestedOrderCode).trim();
  }

  // 2) Nếu có Reservation còn hiệu lực => dùng reservation.orderCode
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

  // 3) Nếu bàn đã có order trước đó => lấy orderCode của order ĐẦU TIÊN
  const firstOrder = await Order.findOne(
    {
      restaurantId: toId(restaurantId),
      tableCode,
    },
    { orderCode: 1, createdAt: 1 }
  )
    .sort({ createdAt: 1, _id: 1 })
    .session?.(session);

  if (firstOrder?.orderCode) return firstOrder.orderCode;

  // 4) Không có gì => sinh mới
  return generateOrderCode("POS", new Date(), tableCode || null);
}

/** Helper: upsert TableCustomer theo bàn + orderCode (cho phép nhận session) */
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

/** Helper: chọn warehouseId (FE truyền hoặc default) */
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

export const OrderMutation = {
  /**
   * ============================================================
   * CREATE OR APPEND TABLE ORDER (Batch-based) + RESERVE INVENTORY
   * - Mỗi lần gọi món tạo 1 order mới, nhưng giữ orderCode đầu tiên
   * - Sử dụng transaction:
   *    + Tạo Order
   *    + (tùy chọn) Upsert TableCustomer
   *    + Reserve inventory (reserveForOrderTx – transaction riêng)
   *   Nếu reserve thất bại → rollback Order.
   * ============================================================
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
      warehouseId, // optional (nếu không có → default warehouse)
    } = input || {};

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }

    // 1) Resolve bàn (ngoài transaction cũng được)
    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    // 2) Tìm Reservation active cho bàn này (nếu có)
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

    // 3) Chuẩn hóa items & gắn recipeId (không cần session)
    const normalizedItems = [];
    for (const i of items) {
      const n = normalizeItem(i); // dùng dishId, quantity, method, ...
      if (n.dishId) {
        const recipe = await Recipe.findOne(
          { menuItemId: n.dishId },
          { _id: 1 }
        ).lean();
        if (recipe) n.recipeId = recipe._id;
      }
      normalizedItems.push(n);
    }

    // 4) Tính totals
    const totals = computeTotals(normalizedItems);

    // 5) userId
    let finalUserId = null;
    if (activeReservation?.userId) {
      finalUserId = activeReservation.userId;
    } else {
      finalUserId = await ensureUserForOrder(userId, effectiveCustomer);
    }

    // 6) Tìm/sinh orderCode
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
        // 7) Tạo Order trong transaction
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
                  note: "Created new batch order",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = newOrder;

        // 8) Lưu / cập nhật TableCustomer trong cùng transaction
        if (
          effectiveCustomer &&
          (effectiveCustomer.fullName ||
            effectiveCustomer.name ||
            effectiveCustomer.phone ||
            effectiveCustomer.email)
        ) {
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

        // 9) Reserve inventory (transaction riêng bên trong service)
        const linesForInventory = buildInventoryLinesFromItems(normalizedItems);

        if (linesForInventory.length) {
          const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId
          );

          // Nếu reserveForOrderTx throw → rollback Order (transaction bên ngoài)
          await reserveForOrderTx({
            restaurantId,
            warehouseId: effectiveWarehouseId,
            orderCode: effectiveOrderCode,
            lines: linesForInventory,
          });
        }
      });

      await session.endSession();

      // 10) Ngoài transaction: set trạng thái bàn + realtime
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

  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note, warehouseId } = input || {};

    if (!id) throw new Error("Missing order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: toId(id) };
    if (restaurantId) {
      filter.restaurantId = toId(restaurantId);
    }

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const prevStatus = order.currentStatus;
    const linesForInventory = buildInventoryLinesFromItems(order.items);

    // INVENTORY: xử lý trước khi ghi status order
    if (linesForInventory.length) {
      const wasReservable = RESERVABLE_STATUSES.includes(prevStatus);

      // COMMIT reservation
      if (wasReservable && COMMIT_STATUSES.includes(status)) {
        const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
          order.restaurantId || restaurantId,
          warehouseId
        );

        await commitReservationForOrderTx({
          restaurantId: order.restaurantId,
          warehouseId: effectiveWarehouseId,
          orderCode: order.orderCode,
          lines: linesForInventory,
        });
      }

      // CANCEL reservation
      if (wasReservable && status === "cancelled") {
        const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
          order.restaurantId || restaurantId,
          warehouseId
        );

        await cancelReservationForOrderTx({
          restaurantId: order.restaurantId,
          warehouseId: effectiveWarehouseId,
          orderCode: order.orderCode,
          lines: linesForInventory,
        });
      }
    }

    // Nếu tới đây mà không lỗi → inventory OK → cập nhật status
    order.currentStatus = status;
    order.statusTimeline = [
      ...(order.statusTimeline || []),
      {
        status,
        at: new Date(),
        note,
        byUserId: ctx?.user?.id,
      },
    ];

    await order.save();

    await emitOrderEvent(
      ctx,
      order.restaurantId || restaurantId,
      "ORDER_STATUS_CHANGED",
      order
    );

    return order.toJSON();
  },

  async updateOrderItemStatus(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, status, note } = input || {};
    if (!orderId || !itemKey || !status)
      throw new Error("Missing fields (orderId, itemKey, status)");

    const filter = { _id: toId(orderId) };
    if (restaurantId) {
      filter.restaurantId = toId(restaurantId);
    }

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const idx = order.items.findIndex((it, index) => {
      const dk1 = it?._id && String(it._id) === String(itemKey);
      const dk2 = it?.dishId && String(it.dishId) === String(itemKey);
      const dk3 = it?.clientKey && String(it.clientKey) === String(itemKey);
      const dk4 = String(index) === String(itemKey);
      return dk1 || dk2 || dk3 || dk4;
    });

    if (idx === -1) throw new Error("Item not found in order");

    order.items[idx].status = status;
    order.items[idx].statusTimeline = [
      ...(order.items[idx].statusTimeline || []),
      { status, at: new Date(), note, byUserId: ctx?.user?.id },
    ];

    await order.save();

    await emitOrderEvent(
      ctx,
      order.restaurantId || restaurantId,
      "ORDER_ITEM_STATUS_CHANGED",
      order
    );

    return { order: order.toJSON() };
  },
  async updateOrderCustomerByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    if (!restaurantId || !orderCode) throw new Error("Missing fields");

    const finalUserId = await ensureUserForOrder(userId, customer);

    // 1) Cập nhật Orders
    const res = await Order.updateMany(
      {
        restaurantId: toId(restaurantId),
        orderCode,
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } }
    );

    // 2) Upsert TableCustomer theo orderCode
    const anyOrder = await Order.findOne({
      restaurantId: toId(restaurantId),
      orderCode,
    })
      .select({ tableId: 1, tableCode: 1 })
      .lean();

    await upsertTableCustomerFromOrder({
      restaurantId,
      tableId: anyOrder?.tableId,
      tableCode: anyOrder?.tableCode,
      orderCode,
      customer,
      note: undefined,
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
    const linesForInventory = buildInventoryLinesFromItems(order.items);

    // INVENTORY: nếu trước đó còn ở trạng thái reservable → trả lại kho (cancel reservation)
    if (RESERVABLE_STATUSES.includes(prevStatus) && linesForInventory.length) {
      const effectiveWarehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        warehouseId
      );

      await cancelReservationForOrderTx({
        restaurantId,
        warehouseId: effectiveWarehouseId,
        orderCode: order.orderCode,
        lines: linesForInventory,
      });
    }

    // Sau khi inventory OK → cập nhật order
    order.currentStatus = "cancelled";
    order.statusTimeline = [
      ...(order.statusTimeline || []),
      {
        status: "cancelled",
        at: new Date(),
        note: reason || "Cancelled by user",
        byUserId: ctx?.user?.id,
      },
    ];
    await order.save();

    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", order);
    await markTableStatus(restaurantId, order.tableCode, "available");

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };
