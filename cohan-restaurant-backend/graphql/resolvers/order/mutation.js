/* eslint-disable no-empty */
import mongoose from "mongoose";
import {
  Order,
  PaymentTransaction,
  User,
  Table,
  EventLog,
  Recipe,
  Reservation,
  TableDraft, // dùng draft theo tableId
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

  if (email) {
    const foundByEmail = await User.findOne({
      email: email.trim(),
      isGuest: true,
    }).select({ _id: 1 });
    if (foundByEmail) return foundByEmail._id;
  }

  const guest = new User({
    fullName: (fullName || "Guest").trim(),
    phone: phone || undefined,
    email: email || undefined,
    isGuest: true,
    status: "active",
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // TTL 30 ngày
  });
  await guest.save();
  return guest._id;
}

/** Resolve table (code + id) — ƯU TIÊN tableId, fallback tableCode */
async function resolveTable(restaurantId, { tableId, tableCode }) {
  let table = null;

  if (tableId && mongoose.isValidObjectId(tableId)) {
    table = await Table.findOne(
      { _id: toId(tableId), restaurantId: toId(restaurantId) },
      { _id: 1, code: 1 }
    ).lean();
  } else if (tableCode) {
    table = await Table.findOne(
      { restaurantId: toId(restaurantId), code: tableCode },
      { _id: 1, code: 1 }
    ).lean();
  }

  if (!table) {
    throw new Error("Table not found");
  }
  return { tableId: String(table._id), tableCode: table.code };
}

// 🔎 Tìm reservation đã xác nhận cho 1 bàn theo tableId
async function findActiveReservationForTableId(restaurantId, tableId) {
  if (!tableId) return null;
  const resv = await Reservation.findOne({
    restaurantId: toId(restaurantId),
    tableId: toId(tableId),
    status: { $in: ["confirmed", "seated"] },
  })
    .sort({ timeTo: -1 })
    .lean();
  return resv;
}

/** Lấy draft theo restaurant + tableId (ưu tiên tableId) */
async function findTableDraftByTableId(restaurantId, tableId) {
  if (!tableId) return null;
  try {
    const doc = await TableDraft.findOne({
      restaurantId: toId(restaurantId),
      tableId: toId(tableId),
    })
      .sort({ updatedAt: -1 })
      .lean();
    return doc || null;
  } catch {
    return null;
  }
}

/** map draft -> customer object */
function customerFromDraft(d) {
  if (!d) return null;
  const fullName =
    (d.customerName || d.customerFullName || d.fullName || "").trim() || null;
  const phone = (d.customerPhone || d.phone || "").trim() || null;
  const email = (d.customerEmail || d.email || "").trim().toLowerCase() || null;
  const note = (d.note || "").trim() || null;
  return fullName || phone || email || note
    ? { fullName, phone, email, note }
    : null;
}

export const OrderMutation = {
  // POS upsert
  async upsertTableOrder(_, { input }, ctx) {
    // 👈 thêm ctx
    const {
      restaurantId,
      // ƯU TIÊN tableId, vẫn nhận tableCode để tương thích
      tableId: rawTableId,
      tableCode: rawTableCode,
      orderCode,
      items,
      note,
      customer, // có thì mới được phép tạo/ghép user
      clientMeta,
      replaceItems,
      userId: explicitUserId, // ưu tiên nếu có
    } = input;

    if (!restaurantId) throw new Error("restaurantId is required");

    // Resolve table 1 lần —> luôn có {tableId, tableCode}
    const { tableId, tableCode } = await resolveTable(restaurantId, {
      tableId: rawTableId,
      tableCode: rawTableCode,
    });

    // normalize items array
    const normalizedItems = Array.isArray(items)
      ? items.map(normalizeItem)
      : [];

    if (!Array.isArray(items) || (items.length === 0 && !replaceItems)) {
      throw new Error("No items to upsert");
    }
    if (Array.isArray(items) && items.length === 0 && replaceItems) {
      const hasCustomer = !!(
        customer &&
        (customer.phone || customer.email || customer.fullName)
      );
      // cho phép rỗng nếu có reservation confirmed theo tableId
      const resv = await findActiveReservationForTableId(restaurantId, tableId);
      if (!hasCustomer && !resv) {
        throw new Error(
          "Cannot save empty order without customer information. Provide customer phone/email or fullName."
        );
      }
    }

    // --- GHÉP KHÁCH TỪ DRAFT THEO tableId nếu FE không gửi ---
    let effectiveCustomer = customer || null;
    const draft = !effectiveCustomer
      ? await findTableDraftByTableId(restaurantId, tableId)
      : null;
    if (!effectiveCustomer) {
      const fromDraft = customerFromDraft(draft);
      if (fromDraft) effectiveCustomer = fromDraft;
    }

    // 🔗 Reservation (để gán reservationId / orderCode) — KHÔNG gán userId từ reservation
    const reservation =
      (await findActiveReservationForTableId(restaurantId, tableId)) || null;

    // ----------------------------------------------------------------
    // XÁC ĐỊNH userId THEO YÊU CẦU:
    // - Nếu có explicitUserId => dùng luôn (không tạo gì thêm)
    // - Nếu không có explicitUserId nhưng có customer => ensure/find/create (guest) theo customer
    // - Nếu không có cả 2 => để undefined (KHÔNG tạo user)
    // ----------------------------------------------------------------
    let userId = undefined;
    if (explicitUserId && mongoose.isValidObjectId(explicitUserId)) {
      userId = toId(explicitUserId);
    } else if (effectiveCustomer) {
      // chỉ khi có customer mới tìm/ tạo guest
      userId = await ensureUserForOrder(null, effectiveCustomer);
    } // else: để undefined

    // determine effective orderCode (ưu tiên reservation.orderCode)
    const effectiveOrderCode = reservation?.orderCode || orderCode || null;

    // Chỉ coi các order đang hoạt động (không completed/cancelled)
    const ACTIVE_ORDER_FILTER = {
      currentStatus: { $nin: ["completed", "cancelled"] },
    };

    // try to find existing order by code hoặc by tableCode (Order lưu tableCode)
    let existingOrder = null;
    if (effectiveOrderCode) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        orderCode: effectiveOrderCode,
        ...ACTIVE_ORDER_FILTER,
      });
    }
    if (!existingOrder) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        tableCode, // đã resolve từ tableId
        ...ACTIVE_ORDER_FILTER,
      });
    }

    // Đính kèm recipeId
    const itemsWithRecipeId = await Promise.all(
      normalizedItems.map(async (item) => {
        const recipe = await Recipe.findOne(
          { menuItemId: item.dishId, restaurantId: toId(restaurantId) },
          { _id: 1 }
        ).lean();
        return { ...item, recipeId: recipe ? recipe._id : null };
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
        tableCode, // Order vẫn dùng code để hiển thị
        orderType: "dine_in",
        shipping: { address: tableCode },
        userId, // có thì lưu, không có thì để trống
        reservationId: reservation ? toId(reservation._id) : undefined,
        items: itemsWithRecipeId,
        totals,
        note: note || effectiveCustomer?.note || "",
        currentStatus: "confirmed",
        payment: { method: "cash", status: "pending" },
        statusTimeline: [
          {
            status: "confirmed",
            at: new Date(),
            byUserId: userId, // log theo explicitUserId/guest nếu có
            note: reservation
              ? "Order created from confirmed reservation"
              : "Created from POS",
          },
        ],
        clientMeta,
      });

      // reservation -> seated
      if (reservation && reservation.status === "confirmed") {
        try {
          await Reservation.updateOne(
            { _id: reservation._id },
            { $set: { status: "seated" } }
          );
        } catch {}
      }
    } else {
      // update existing order
      if (replaceItems) {
        const totals = computeTotals(itemsWithRecipeId);
        existingOrder.items = itemsWithRecipeId;
        existingOrder.totals = totals;
        if (note || effectiveCustomer?.note) {
          existingOrder.note = note || effectiveCustomer?.note;
        }
        // chỉ gán userId nếu chưa có và ta có userId hợp lệ
        if (userId && !existingOrder.userId) existingOrder.userId = userId;
        if (reservation && !existingOrder.reservationId) {
          existingOrder.reservationId = toId(reservation._id);
        }
        doc = await existingOrder.save();

        try {
          await EventLog.create({
            restaurantId: toId(restaurantId),
            tableId: toId(tableId),
            orderId: doc._id,
            actorUserId: userId, // dùng explicit/guest nếu có; không có thì để undefined
            verb:
              Array.isArray(items) && items.length === 0
                ? "order.save_empty"
                : "order.replace_items",
            object: { kind: "Order", id: doc._id, code: doc.orderCode },
            source: (clientMeta && clientMeta.source) || "pos",
            userAgent: (clientMeta && clientMeta.ua) || "",
            meta: { note: note || effectiveCustomer?.note || null, clientMeta },
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
        if (note || effectiveCustomer?.note) {
          existingOrder.note = note || effectiveCustomer?.note;
        }
        if (userId && !existingOrder.userId) existingOrder.userId = userId;
        if (reservation && !existingOrder.reservationId) {
          existingOrder.reservationId = toId(reservation._id);
        }
        doc = await existingOrder.save();
      }

      // reservation -> seated
      if (reservation && reservation.status === "confirmed") {
        try {
          await Reservation.updateOne(
            { _id: reservation._id },
            { $set: { status: "seated" } }
          );
        } catch {}
      }
    }

    // ✅ cập nhật trạng thái bàn sang occupied bằng tableId (best-effort)
    await Table.updateOne(
      { _id: toId(tableId), restaurantId: toId(restaurantId) },
      { $set: { status: "occupied" } }
    ).catch(() => {});

    // ✅ XÓA NHÁP SAU KHI LƯU ORDER THÀNH CÔNG — theo tableId
    try {
      await TableDraft.deleteMany({
        restaurantId: toId(restaurantId),
        tableId: toId(tableId),
      });
    } catch (e) {
      console.warn("TableDraft delete failed:", e?.message || e);
    }

    // 🔔 publish sự kiện
    try {
      const payload = {
        type: isNewOrder ? "ORDER_CREATED" : "ORDER_UPDATED",
        order: doc.toJSON(),
      };
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload,
      });
    } catch {}

    return { isNewOrder, order: doc.toJSON() };
  },

  // tạo order (khách đặt từ ngoài)
  async createOrder(_, { input }, ctx) {
    // 👈 thêm ctx
    const {
      orderCode,
      userId,
      restaurantId,
      reservationId,
      orderType,
      // có thể truyền tableId hoặc tableCode
      tableId: rawTableId,
      tableCode: rawTableCode,
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

    // Resolve table (để lấy tableCode nếu có tableId)
    let tableCodeResolved = rawTableCode || null;
    if (!tableCodeResolved && rawTableId) {
      const t = await Table.findOne(
        { _id: toId(rawTableId), restaurantId: toId(restaurantId) },
        { code: 1 }
      ).lean();
      tableCodeResolved = t?.code || null;
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
      tableCode: tableCodeResolved || undefined,
      shipping: tableCodeResolved ? { address: tableCodeResolved } : shipping,
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

    if (rawTableId) {
      await Table.updateOne(
        { _id: toId(rawTableId), restaurantId: toId(restaurantId) },
        { $set: { status: "occupied" } }
      ).catch(() => {});
      // clear draft nếu có (theo tableId)
      try {
        await TableDraft.deleteMany({
          restaurantId: toId(restaurantId),
          tableId: toId(rawTableId),
        });
      } catch {}
    }

    await createPaymentTxn(doc, paymentMethod);

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: { type: "ORDER_CREATED", order: doc.toJSON() },
      });
    } catch {}

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

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: { type: "ORDER_STATUS_CHANGED", order: doc.toJSON() },
      });
    } catch {}

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

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: { type: "ORDER_CANCELLED", order: doc.toJSON() },
      });
    } catch {}

    return doc.toJSON();
  },

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
        // Với updateByCode này, vẫn chỉ biết code; table state sẽ giữ nguyên logic cũ
        await Table.updateOne(
          { restaurantId: doc.restaurantId, code: doc.tableCode },
          {
            $set: { status: status === "cancelled" ? "available" : "occupied" },
          }
        );
      }
    } catch {}

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

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: {
          type:
            status === "completed"
              ? "ORDER_COMPLETED"
              : status === "cancelled"
              ? "ORDER_CANCELLED"
              : "ORDER_STATUS_CHANGED",
          order: doc.toJSON(),
        },
      });
    } catch {}

    return { order: doc.toJSON() };
  },

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

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: {
          type: "ORDER_ITEM_STATUS_CHANGED",
          order: doc.toJSON(),
        },
      });
    } catch {}

    return { order: doc.toJSON() };
  },

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
        byUserId: userId ? userId : undefined,
      },
    ];
    await doc.save();

    // 🔔 publish
    try {
      await ctx?.pubsub?.publish({
        topic: `ORDER_EVENTS_${String(doc.restaurantId)}`,
        payload: { type: "ORDER_CUSTOMER_ATTACHED", order: doc.toJSON() },
      });
    } catch {}

    return { order: doc.toJSON() };
  },
};
