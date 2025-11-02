// src/graphql/order/mutation.js
import mongoose from "mongoose";
import {
  Order,
  PaymentTransaction,
  User,
  Table,
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

// 👉 chỗ mấu chốt: quantity có thể là 0.5 nên parseFloat
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
    description: i.description || "",
    quantity: qty,
    modifiers: (i.modifiers || []).map((m) => ({
      optionId: m.optionId,
      optionName: m.optionName,
      groupId: m.groupId,
      price: Number(m.price || 0),
    })),
    lineSubtotal,
  };
}

function computeTotals(items) {
  let subtotal = 0;
  for (const it of items) {
    // nếu item chưa có lineSubtotal thì tự tính lại
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

async function createPaymentTxn(orderDoc, method) {
  const normalized = normalizePaymentMethod(method);
  const amount = orderDoc?.totals?.grandTotal || 0;
  return PaymentTransaction.create({
    restaurantId: orderDoc.restaurantId,
    orderId: orderDoc._id,
    method: normalized,
    currency: "VND",
    amount,
    status: "succeeded",
    provider: normalized === "bank_transfer" ? "vietqr" : undefined,
    paidAt: new Date(),
    message: "Auto-created on confirmed payment",
  });
}

// ✅ tạo / tìm user guest theo phone/email
async function ensureUserForOrder(ctxUserId, explicitUserId, customer) {
  if (ctxUserId) return toId(ctxUserId);
  if (explicitUserId && mongoose.isValidObjectId(explicitUserId)) {
    return toId(explicitUserId);
  }

  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim()?.toLowerCase();
  const fullName = customer?.fullName?.trim();

  if (!phone && !email) return undefined;

  const or = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });

  let user = await User.findOne(or.length ? { $or: or } : { _id: null });

  if (!user) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user = await User.create({
      fullName,
      phone,
      email,
      roleName: "customer",
      isGuest: true,
      guestExpiresAt: expires,
    });
  } else if (!user.roleName) {
    user.roleName = "customer";
    await user.save();
  }

  return user._id;
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
    } = input;

    if (!restaurantId) {
      throw new Error("restaurantId is required");
    }
    if (!tableCode) {
      throw new Error("tableCode is required");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No items to upsert");
    }

    // tìm xem POS này đã nhập customer cho bàn chưa
    const userId = await ensureUserForOrder(ctx?.user?.id, null, customer);

    // 1. tìm order hiện có
    let existingOrder = null;
    if (orderCode) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        orderCode,
      });
    }
    if (!existingOrder) {
      // tìm theo bàn
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        tableCode,
        currentStatus: { $in: ["confirmed", "preparing", "served"] },
      }).sort({ createdAt: -1 });
    }

    const normalizedItems = items.map(normalizeItem);

    let doc;
    let isNewOrder = false;

    if (!existingOrder) {
      isNewOrder = true;
      const totals = computeTotals(normalizedItems);
      doc = await Order.create({
        orderCode:
          orderCode ||
          `POS-${tableCode}-${Date.now().toString(36).toUpperCase()}`,
        restaurantId: toId(restaurantId),
        tableCode,
        orderType: "dine_in",
        shipping: {
          address: tableCode,
        },
        userId,
        items: normalizedItems,
        totals,
        note: note || "",
        currentStatus: "confirmed",
        payment: {
          method: "cash",
          status: "pending",
        },
        statusTimeline: [
          {
            status: "confirmed",
            at: new Date(),
            byUserId: ctx?.user?._id,
            note: "Created from POS",
          },
        ],
        clientMeta,
      });
    } else {
      // append
      const mergedItems = [...(existingOrder.items || []), ...normalizedItems];
      const totals = computeTotals(mergedItems);
      existingOrder.items = mergedItems;
      existingOrder.totals = totals;
      if (note) existingOrder.note = note;
      if (userId && !existingOrder.userId) {
        existingOrder.userId = userId;
      }
      doc = await existingOrder.save();
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

  // tạo order (cho khách đặt từ ngoài)
  async createOrder(_, { input }, ctx) {
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
      ctx?.user?.id,
      userId,
      customer || {
        fullName: shipping?.fullName,
        phone: shipping?.phone,
        email: shipping?.email,
      }
    );

    const normalizedItems = items.map(normalizeItem);
    const totals = computeTotals(normalizedItems);

    const doc = await Order.create({
      orderCode: orderCode || null,
      userId: effectiveUserId,
      restaurantId: toId(restaurantId),
      reservationId: reservationId ? toId(reservationId) : undefined,
      orderType: orderType || mapDeliveryToOrderType(shipping?.deliveryMethod),
      tableCode,
      shipping: tableCode ? { address: tableCode } : shipping, // nếu là POS thì ưu tiên tableCode
      items: normalizedItems,
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

    // nếu là tại bàn -> cập nhật bàn
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
};
