// cohan-restaurant-backend/graphql/resolvers/order/mutation.js

import {
  Order,
  Recipe,
  Reservation,
  TableCustomer, // ✅ model mới chứa thông tin khách
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

  // 4) Không có gì => sinh mới (POS-YYYYMMDD-[TABLE?]-RANDOM)
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
  }).lean();
}

export const OrderMutation = {
  /**
   * ============================================================
   * CREATE OR APPEND TABLE ORDER (Batch-based)
   * - Mỗi lần gọi món tạo 1 order mới, nhưng giữ orderCode đầu tiên
   * - Nếu bàn có Reservation:
   *    + Lấy userId từ Reservation
   *    + Lấy customerName/Phone/Email từ Reservation
   *    + Lấy orderCode từ Reservation (nếu có)
   *    + Upsert TableCustomer theo info này
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
      customer, // có thể null, nếu bàn được mở từ Reservation
      userId,
      clientMeta,
    } = input || {};

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }

    /** 1) Resolve thông tin bàn */
    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    /** 2) Tìm Reservation đang active cho bàn này (nếu có) */
    const activeReservation = await Reservation.findOne({
      restaurantId: toId(restaurantId),
      tableId: toId(tableInfo.tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Chuẩn hóa customer lấy ưu tiên từ Reservation
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

    /** 3) Chuẩn hóa items & gắn recipe nếu có */
    const normalizedItems = [];
    for (const i of items) {
      const n = normalizeItem(i);
      if (n.dishId) {
        const recipe = await Recipe.findOne(
          { dishId: n.dishId },
          { _id: 1 }
        ).lean();
        if (recipe) n.recipeId = recipe._id;
      }
      normalizedItems.push(n);
    }

    /** 4) Tính totals */
    const totals = computeTotals(normalizedItems);

    /** 5) Xác định userId để gắn vào order:
     *  - Ưu tiên dùng reservation.userId nếu có
     *  - Nếu không, fallback sang logic ensureUserForOrder như cũ
     */
    let finalUserId = null;
    if (activeReservation?.userId) {
      finalUserId = activeReservation.userId;
    } else {
      finalUserId = await ensureUserForOrder(userId, effectiveCustomer);
    }

    /** 6) Tìm hoặc sinh orderCode đợt đầu:
     *  - Ưu tiên orderCode từ Reservation (nếu có)
     *  - Sau đó orderCode truyền từ FE
     *  - Sau đó helper findOrCreateOrderCode
     */
    const effectiveOrderCode =
      activeReservation?.orderCode ||
      (orderCode && String(orderCode).trim()) ||
      (await findOrCreateOrderCode({
        restaurantId,
        tableId: tableInfo.tableId,
        tableCode: tableInfo.tableCode,
        requestedOrderCode: null,
      }));

    /** 7) Tạo order mới (một đợt) */
    const newOrder = await Order.create({
      restaurantId: toId(restaurantId),
      tableId: toId(tableInfo.tableId),
      tableCode: tableInfo.tableCode,
      userId: finalUserId ? toId(finalUserId) : undefined,
      orderCode: effectiveOrderCode,
      orderType: "dine_in",
      shipping: { address: tableInfo.tableCode }, // giữ tương thích
      items: normalizedItems,
      totals,
      note,
      currentStatus: "confirmed",
      payment: { method: "cash", status: "pending" },
      statusTimeline: [
        {
          status: "confirmed",
          at: new Date(),
          byUserId: finalUserId ? toId(finalUserId) : undefined,
          note: "Created new batch order",
        },
      ],
      clientMeta,
    });

    /** 8) ✅ Lưu/ cập nhật thông tin khách vào TableCustomer
     *  - Ưu tiên info từ Reservation (đã chuẩn hóa ở trên)
     *  - Nếu không có Reservation thì dùng customer từ input như cũ
     */
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
      });
    }

    /** 9) Set trạng thái bàn & phát realtime */
    await markTableStatus(restaurantId, tableInfo.tableCode, "occupied");
    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", newOrder);

    return { isNewOrder: true, order: newOrder.toJSON() };
  },

  /**
   * ============================================================
   * UPDATE ORDER STATUS (by ID)
   * - ✅ CHỈ cập nhật 1 order theo id
   * - ❌ KHÔNG dùng orderCode để tìm order nữa
   * ============================================================
   */
  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note } = input || {};

    if (!id) throw new Error("Missing order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: toId(id) };
    if (restaurantId) {
      filter.restaurantId = toId(restaurantId);
    }

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

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

  /**
   * ============================================================
   * UPDATE SINGLE ITEM STATUS (by orderId + itemKey)
   * - ✅ Không còn dùng orderCode để tìm order
   * - Tìm đúng 1 Order theo id rồi update item bên trong
   * ============================================================
   */
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

  /**
   * ============================================================
   * ATTACH/UPDATE CUSTOMER BY ORDER CODE
   * - Gán user (guest) cho toàn bộ order cùng code
   * - ✅ Đồng thời upsert TableCustomer theo orderCode
   *
   * (Phần này vẫn dùng orderCode vì logic business muốn
   *  toàn bộ các đợt cùng code dùng chung khách hàng)
   * ============================================================
   */
  async updateOrderCustomerByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    if (!restaurantId || !orderCode) throw new Error("Missing fields");

    const finalUserId = await ensureUserForOrder(userId, customer);

    // 1) Cập nhật Orders như cũ
    const res = await Order.updateMany(
      {
        restaurantId: toId(restaurantId),
        orderCode,
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } }
    );

    // 2) ✅ Đồng thời upsert TableCustomer theo orderCode
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

  /**
   * ============================================================
   * CANCEL SINGLE ORDER BY ID (giữ nguyên hành vi sẵn có)
   * ============================================================
   */
  async cancelOrder(_, { restaurantId, orderId, reason }, ctx) {
    if (!restaurantId || !orderId) throw new Error("Missing fields");

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: toId(restaurantId),
    });
    if (!order) throw new Error("Order not found");

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
