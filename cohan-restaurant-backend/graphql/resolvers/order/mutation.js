import mongoose from "mongoose";
import {
  Order,
  PaymentTransaction,
  User,
  Table,
  EventLog,
  Recipe,
  Reservation, // <-- NEW
} from "../../../models/index.js";

const toId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const mapDeliveryToOrderType = (deliveryMethod) => {
  if (deliveryMethod === "dinein") return "dine_in";
  if (deliveryMethod === "pickup") return "takeaway";
  return "delivery";
};

const normalizePaymentMethod = (m) =>
  m === "transfer" ? "bank_transfer" : m || "cash";

// 👉 quantity có thể là 0.5 nên parseFloat
function normalizeItem(i) {
  const qty = parseFloat(i.quantity ?? 1);
  const price = Number(i.price || 0);
  const modifiersPrice = Number(i.modifiersPrice || 0);
  const lineSubtotal = Math.round(price * qty + modifiersPrice * qty);

  return {
    dishId: i.dishId ?? i.id,
    menuId: i.menuId,
    categoryId: i.categoryId,
    name: i.name,
    unit: i.unit || "portion",
    price,
    modifiersPrice,
    method: i.method || i.cookingMethod || "",
    methodDelta: Number(i.methodDelta || 0),
    note: i.description || "",
    quantity: qty,
    modifiers: (i.modifiers || []).map((m) => ({
      optionId: m.optionId,
      optionName: m.optionName,
      groupId: m.groupId,
      price: Number(m.price || 0),
    })),
    lineSubtotal,
    status: i.status || "pending",
  };
}

function computeTotals(items) {
  let subtotal = 0;
  for (const it of items) {
    const line =
      it.lineSubtotal != null
        ? Number(it.lineSubtotal)
        : Number(it.price || 0) * Number(it.quantity || 0);
    subtotal += line;
  }
  const tax = Math.round(subtotal * 0.1);
  const service = Math.round(subtotal * 0.05);
  const discount = 0;
  const grandTotal = subtotal + tax + service - discount;
  return { subtotal, discount, tax, service, grandTotal };
}

async function createPaymentTxn(orderDoc, method, session) {
  const normalized = normalizePaymentMethod(method);
  const amount = orderDoc?.totals?.grandTotal || 0;
  return PaymentTransaction.create(
    [
      {
        restaurantId: orderDoc.restaurantId,
        orderId: orderDoc._id,
        method: normalized,
        currency: "VND",
        amount,
        status: "succeeded",
        provider: normalized === "bank_transfer" ? "vietqr" : undefined,
        paidAt: new Date(),
        message: "Auto-created on confirmed payment",
      },
    ],
    { session }
  );
}

// ✅ tạo / tìm user guest theo phone/email
async function ensureUserForOrder(userId, customer) {
  if (userId) return userId;
  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim()?.toLowerCase();
  const fullName = customer?.fullName?.trim();
  if (phone) {
    const foundByPhone = await User.findOne({
      phone: phone.trim(),
      isGuest: true,
    }).select({ _id: 1 });
    if (foundByPhone) return foundByPhone._id;
  }

  // Sau đó email
  if (email) {
    const foundByEmail = await User.findOne({
      email: email.trim(),
      isGuest: true,
    }).select({ _id: 1 });
    if (foundByEmail) return foundByEmail._id;
  }

  // Không có -> tạo guest
  const guest = new User({
    fullName: (fullName || "Guest").trim(),
    phone: phone?.trim() || undefined,
    email: email?.trim() || undefined,
    isGuest: true,
    status: "active",
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // TTL 30 ngày
  });
  await guest.save();
  return guest._id;
}

// 🔎 Tìm reservation đã xác nhận cho 1 bàn
async function findActiveReservationForTable(restaurantId, tableCode) {
  const table = await Table.findOne(
    { restaurantId: toId(restaurantId), code: tableCode },
    { _id: 1 }
  ).lean();
  if (!table) return null;

  const resv = await Reservation.findOne({
    restaurantId: toId(restaurantId),
    tableId: table._id,
    status: { $in: ["confirmed", "seated"] },
  })
    .sort({ timeTo: -1 })
    .lean();
  return resv;
}

export const OrderMutation = {
  // POS upsert
  async upsertTableOrder(_, { input }, ctx) {
    const {
      restaurantId,
      tableCode,
      orderCode,
      items,
      note,
      customer,
      clientMeta,
      replaceItems,
      userId: explicitUserId,
    } = input;

    if (!restaurantId) {
      throw new Error("restaurantId is required");
    }
    if (!tableCode) {
      throw new Error("tableCode is required");
    }

    // normalize items array
    const normalizedItems = Array.isArray(items)
      ? items.map(normalizeItem)
      : [];

    // (Logic kiểm tra items rỗng giữ nguyên)
    if (!Array.isArray(items) || (items.length === 0 && !replaceItems)) {
      throw new Error("No items to upsert");
    }
    if (Array.isArray(items) && items.length === 0 && replaceItems) {
      const hasCustomer = !!(
        customer &&
        (customer.phone || customer.email || customer.fullName)
      );
      // cho phép case replaceItems rỗng nếu có reservation confirmed (không ép buộc customer)
      const resv = await findActiveReservationForTable(restaurantId, tableCode);
      if (!hasCustomer && !resv) {
        throw new Error(
          "Cannot save empty order without customer information. Provide customer phone/email or fullName."
        );
      }
    }

    // 🔗 kiểm tra reservation confirmed trên bàn
    const reservation =
      (await findActiveReservationForTable(restaurantId, tableCode)) || null;

    // determine effective user
    const userId = reservation
      ? toId(reservation.userId)
      : await ensureUserForOrder(explicitUserId || ctx?.user?.id, customer);

    // determine effective orderCode (ưu tiên reservation.orderCode)
    const effectiveOrderCode = reservation?.orderCode || orderCode || null;

    // Chỉ coi các order đang hoạt động (không completed/cancelled)
    const ACTIVE_ORDER_FILTER = {
      currentStatus: { $nin: ["completed", "cancelled"] },
    };

    // try to find existing order by code (ưu tiên code từ reservation) hoặc by table
    let existingOrder = null;
    if (effectiveOrderCode) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        orderCode: effectiveOrderCode,
        ...ACTIVE_ORDER_FILTER, // ⬅️ lọc trạng thái
      });
    }
    if (!existingOrder) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        tableCode,
        ...ACTIVE_ORDER_FILTER, // ⬅️ lọc trạng thái
      });
    }

    // Đính kèm recipeId
    const itemsWithRecipeId = await Promise.all(
      normalizedItems.map(async (item) => {
        const recipe = await Recipe.findOne(
          { menuItemId: item.dishId, restaurantId: toId(restaurantId) },
          { _id: 1 }
        ).lean();

        return {
          ...item,
          recipeId: recipe ? recipe._id : null,
        };
      })
    );

    let doc = null;
    let isNewOrder = false;

    if (!existingOrder) {
      // create new order
      isNewOrder = true;
      const totals = computeTotals(itemsWithRecipeId);
      doc = await Order.create({
        orderCode:
          effectiveOrderCode ||
          `POS-${tableCode}-${Date.now().toString(36).toUpperCase()}`,
        restaurantId: toId(restaurantId),
        tableCode,
        orderType: "dine_in",
        shipping: { address: tableCode },
        userId,
        reservationId: reservation ? toId(reservation._id) : undefined,
        items: itemsWithRecipeId,
        totals,
        note: note || "",
        currentStatus: "confirmed",
        payment: { method: "cash", status: "pending" },
        statusTimeline: [
          {
            status: "confirmed",
            at: new Date(),
            byUserId: ctx?.user?._id,
            note: reservation
              ? "Order created from confirmed reservation"
              : "Created from POS",
          },
        ],
        clientMeta,
      });

      // Nếu có reservation confirmed -> chuyển sang 'seated'
      if (reservation && reservation.status === "confirmed") {
        try {
          await Reservation.updateOne(
            { _id: reservation._id },
            { $set: { status: "seated" } }
          );
        } catch (e) {
          // ignore
        }
      }
    } else {
      // update existing order
      if (replaceItems) {
        const totals = computeTotals(itemsWithRecipeId);
        existingOrder.items = itemsWithRecipeId;
        existingOrder.totals = totals;
        if (note) existingOrder.note = note;
        if (userId && !existingOrder.userId) existingOrder.userId = userId;
        if (reservation && !existingOrder.reservationId) {
          existingOrder.reservationId = toId(reservation._id);
        }
        doc = await existingOrder.save();

        try {
          await EventLog.create({
            restaurantId: toId(restaurantId),
            tableId: undefined,
            orderId: doc._id,
            actorUserId: toId(ctx?.user?.id),
            verb:
              Array.isArray(items) && items.length === 0
                ? "order.save_empty"
                : "order.replace_items",
            object: { kind: "Order", id: doc._id, code: doc.orderCode },
            source: (clientMeta && clientMeta.source) || "pos",
            userAgent:
              (clientMeta && clientMeta.ua) ||
              ctx?.req?.headers["user-agent"] ||
              "",
            meta: { note: note || null, clientMeta },
            status: "success",
          });
        } catch (e) {
          console.warn("EventLog.create failed:", e.message);
        }
      } else {
        // append
        const mergedItems = [
          ...(existingOrder.items || []),
          ...itemsWithRecipeId,
        ];
        const totals = computeTotals(mergedItems);
        existingOrder.items = mergedItems;
        existingOrder.totals = totals;
        if (note) existingOrder.note = note;
        if (userId && !existingOrder.userId) existingOrder.userId = userId;
        if (reservation && !existingOrder.reservationId) {
          existingOrder.reservationId = toId(reservation._id);
        }
        doc = await existingOrder.save();
      }

      // nếu có reservation confirmed thì chuyển seated
      if (reservation && reservation.status === "confirmed") {
        try {
          await Reservation.updateOne(
            { _id: reservation._id },
            { $set: { status: "seated" } }
          );
        } catch {}
      }
    }

    // ✅ cập nhật trạng thái bàn sang occupied
    await Table.updateOne(
      {
        restaurantId: toId(restaurantId),
        code: tableCode,
      },
      {
        $set: { status: "occupied" },
      }
    ).catch(() => {});

    return {
      isNewOrder,
      order: doc.toJSON(),
    };
  },

  // tạo order (khách đặt từ ngoài)
  async createOrder(_, { input }) {
    const {
      orderCode,
      userId,
      restaurantId,
      reservationId,
      orderType,
      tableCode,
      shipping,
      items,
      note,
      paymentMethod,
      customer,
    } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Order must contain items");
    }

    const effectiveUserId = await ensureUserForOrder(
      userId,
      customer || {
        fullName: shipping?.fullName,
        phone: shipping?.phone,
        email: shipping?.email,
      }
    );

    const normalizedItems = items.map(normalizeItem);

    const itemsWithRecipeId = await Promise.all(
      normalizedItems.map(async (item) => {
        const recipe = await Recipe.findOne(
          { menuItemId: item.menuId, restaurantId: toId(restaurantId) },
          { _id: 1 }
        ).lean();
        return { ...item, recipeId: recipe ? recipe._id : null };
      })
    );

    const totals = computeTotals(itemsWithRecipeId);

    const doc = await Order.create({
      orderCode: orderCode || null,
      userId: effectiveUserId,
      restaurantId: toId(restaurantId),
      reservationId: reservationId ? toId(reservationId) : undefined,
      orderType: orderType || mapDeliveryToOrderType(shipping?.deliveryMethod),
      tableCode,
      shipping: tableCode ? { address: tableCode } : shipping,
      items: itemsWithRecipeId,
      totals,
      note,
      currentStatus: "confirmed",
      payment: {
        method: paymentMethod,
        status: "paid",
        paidAmount: totals.grandTotal,
        currency: "VND",
        paidAt: new Date(),
      },
      statusTimeline: [
        { status: "confirmed", at: new Date(), byUserId: effectiveUserId },
      ],
    });

    if (tableCode) {
      await Table.updateOne(
        { restaurantId: toId(restaurantId), code: tableCode },
        { $set: { status: "occupied" } }
      ).catch(() => {});
    }

    await createPaymentTxn(doc, paymentMethod);
    return doc.toJSON();
  },

  async updateOrderStatus(_, { input }, ctx) {
    const { id, status, note } = input;
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid order id");
    const doc = await Order.findById(id);
    if (!doc) throw new Error("Order not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    doc.currentStatus = status;
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      { status, at: new Date(), note, byUserId },
    ];
    await doc.save();
    return doc.toJSON();
  },

  async cancelOrder(_, { id, reason }, ctx) {
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid order id");
    const doc = await Order.findById(id);
    if (!doc) throw new Error("Order not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    doc.currentStatus = "cancelled";
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      { status: "cancelled", at: new Date(), note: reason, byUserId },
    ];
    await doc.save();

    const paid =
      doc.payment?.status === "paid" && (doc.totals?.grandTotal || 0) > 0;
    if (paid) {
      await PaymentTransaction.create({
        restaurantId: doc.restaurantId,
        orderId: doc._id,
        method: normalizePaymentMethod(doc.payment?.method || "cash"),
        currency: "VND",
        amount: doc.totals?.grandTotal || 0,
        status: "refunded",
        message: reason || "Order cancelled - refunded",
        paidAt: new Date(),
      });
    }

    return doc.toJSON();
  },

  // -----------------------------------------------------------------
  // ĐỔI TRẠNG THÁI ORDER THEO orderCode + restaurantId
  // -----------------------------------------------------------------
  async updateOrderStatusByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, status, note } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!orderCode) throw new Error("orderCode is required");

    const ORDER_STATUS_SET = new Set([
      "pending",
      "preparing",
      "ready",
      "served",
      "cancelled",
      "completed",
    ]);
    if (!ORDER_STATUS_SET.has(status)) {
      throw new Error("Invalid order status");
    }

    const doc = await Order.findOne({
      restaurantId: toId(restaurantId),
      orderCode,
    });
    if (!doc) throw new Error("Order not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    doc.currentStatus = status;
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      { status, at: new Date(), note, byUserId },
    ];
    await doc.save();

    try {
      if (
        (status === "served" ||
          status === "completed" ||
          status === "cancelled") &&
        doc.tableCode
      ) {
        await Table.updateOne(
          { restaurantId: doc.restaurantId, code: doc.tableCode },
          {
            $set: { status: status === "cancelled" ? "available" : "occupied" },
          }
        );
      }
    } catch (e) {}

    try {
      await EventLog.create({
        restaurantId: doc.restaurantId,
        orderId: doc._id,
        actorUserId: byUserId,
        verb: "order.update_status_by_code",
        object: { kind: "Order", id: doc._id, code: doc.orderCode },
        source: "api",
        userAgent: ctx?.req?.headers?.["user-agent"] || "",
        meta: { from: "byCode", toStatus: status, note },
        status: "success",
      });
    } catch {}

    return { order: doc.toJSON() };
  },

  // -----------------------------------------------------------------
  // ĐỔI TRẠNG THÁI 1 MÓN THEO orderCode + restaurantId
  // -----------------------------------------------------------------
  async updateOrderItemStatusByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, itemKey, status, note } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!orderCode) throw new Error("orderCode is required");
    if (itemKey == null) throw new Error("itemKey is required");

    const ITEM_STATUS_SET = new Set([
      "pending",
      "preparing",
      "ready",
      "served",
      "cancelled",
    ]);
    if (!ITEM_STATUS_SET.has(status)) {
      throw new Error("Invalid item status");
    }

    const doc = await Order.findOne({
      restaurantId: toId(restaurantId),
      orderCode,
    });
    if (!doc) throw new Error("Order not found");

    const keyStr = String(itemKey);
    let idx = -1;
    for (let i = 0; i < (doc.items || []).length; i++) {
      const it = doc.items[i] || {};
      if (it.dishId && String(it.dishId) === keyStr) {
        idx = i;
        break;
      }
    }
    if (idx === -1) throw new Error("Order item not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    const prev = doc.items[idx]?.status || "pending";
    doc.items[idx].status = status;

    const itemRef = {
      itemIndex: idx,
      dishId: doc.items[idx]?.dishId || null,
      name: doc.items[idx]?.name || null,
      from: prev,
      to: status,
    };
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      {
        status: `${status}`,
        at: new Date(),
        note: note || JSON.stringify(itemRef),
        byUserId,
      },
    ];

    await doc.save();

    try {
      await EventLog.create({
        restaurantId: doc.restaurantId,
        orderId: doc._id,
        actorUserId: byUserId,
        verb: "order_item.update_status_by_code",
        object: {
          kind: "OrderItem",
          id: doc._id,
          code: doc.orderCode,
          itemIndex: idx,
          dishId: doc.items[idx]?.dishId || null,
        },
        source: "api",
        userAgent: ctx?.req?.headers?.["user-agent"] || "",
        meta: { from: prev, to: status, note, itemRef },
        status: "success",
      });
    } catch {}

    return { order: doc.toJSON() };
  },

  // -----------------------------------------------------------------
  // NEW: Cập nhật khách hàng (user) của order theo restaurantId + orderCode
  // -----------------------------------------------------------------
  async updateOrderCustomerByCode(_, { input }, ctx) {
    const { restaurantId, orderCode, customer } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!orderCode) throw new Error("orderCode is required");
    if (!customer) throw new Error("customer is required");

    const doc = await Order.findOne({
      restaurantId: toId(restaurantId),
      orderCode,
    });
    if (!doc) throw new Error("Order not found");

    const userId = await ensureUserForOrder(null, customer);
    if (!userId) throw new Error("Cannot resolve user for customer");

    doc.userId = userId;
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      {
        status: "customer_attached",
        at: new Date(),
        note: `Attach customer to order: ${customer.fullName || ""}`,
        byUserId:
          ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
            ? toId(ctx.user.id)
            : undefined,
      },
    ];
    await doc.save();

    return { order: doc.toJSON() };
  },
};
